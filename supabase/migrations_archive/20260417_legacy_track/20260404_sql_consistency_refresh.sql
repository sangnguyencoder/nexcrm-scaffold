create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

alter table if exists notifications drop constraint if exists notifications_entity_type_check;
alter table if exists notifications
add constraint notifications_entity_type_check
check (entity_type in ('ticket','customer','campaign','transaction','task','deal','automation','system'));

alter table if exists app_settings
  alter column notification_settings set default '[
    {"key":"ticket_new","label":"Ticket mới","description":"Nhận thông báo khi có ticket mới phát sinh.","enabled":true},
    {"key":"ticket_update","label":"Cập nhật ticket","description":"Nhận thông báo khi ticket được cập nhật trạng thái.","enabled":true},
    {"key":"customer_new","label":"Khách hàng mới","description":"Nhận thông báo khi có khách hàng mới trong hệ thống.","enabled":true},
    {"key":"campaign_done","label":"Chiến dịch gửi xong","description":"Nhận thông báo khi chiến dịch marketing hoàn tất.","enabled":true},
    {"key":"task_due","label":"Nhiệm vụ đến hạn","description":"Nhận thông báo khi có follow-up mới hoặc quá hạn.","enabled":true},
    {"key":"deal_stage","label":"Cập nhật pipeline","description":"Nhận thông báo khi cơ hội bán hàng đổi giai đoạn.","enabled":true}
  ]'::jsonb;

alter table if exists app_settings
  alter column integrations set default '{
    "pos_webhook_url":"https://demo.nexcrm.vn/webhooks/pos-sync",
    "last_sync":"2024-01-21T09:30:00.000Z",
    "pos_status":"active",
    "email_provider":{"provider":null,"enabled":false,"from_name":"NexCRM","from_email":"hello@demo.nexcrm.vn","reply_to":""},
    "sms_provider":{"provider":null,"enabled":false,"sender_id":"NexCRM","from_number":""}
  }'::jsonb;

insert into app_settings (id)
values ('default')
on conflict (id) do nothing;

create sequence if not exists customer_code_seq;
select setval(
  'customer_code_seq',
  greatest(
    coalesce(
      (
        select max((regexp_match(customer_code, '([0-9]{4})$'))[1]::bigint)
        from customers
        where customer_code is not null
      ),
      1
    ),
    1
  ),
  coalesce(
    (
      select max((regexp_match(customer_code, '([0-9]{4})$'))[1]::bigint)
      from customers
      where customer_code is not null
    ),
    0
  ) > 0
);

create sequence if not exists ticket_code_seq;
select setval(
  'ticket_code_seq',
  greatest(
    coalesce(
      (
        select max((regexp_match(ticket_code, '([0-9]{4})$'))[1]::bigint)
        from support_tickets
        where ticket_code is not null
      ),
      1
    ),
    1
  ),
  coalesce(
    (
      select max((regexp_match(ticket_code, '([0-9]{4})$'))[1]::bigint)
      from support_tickets
      where ticket_code is not null
    ),
    0
  ) > 0
);

grant usage, select on sequence customer_code_seq to anon, authenticated;
grant usage, select on sequence ticket_code_seq to anon, authenticated;

create or replace function generate_customer_code() returns trigger as $$
begin
  if new.customer_code is null or btrim(new.customer_code) = '' then
    new.customer_code := 'KH-' || to_char(coalesce(new.created_at, now()), 'YYYY') || '-' || lpad(nextval('customer_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_customer_code on customers;
create trigger trg_customer_code
before insert on customers
for each row execute function generate_customer_code();

create or replace function generate_ticket_code() returns trigger as $$
begin
  if new.ticket_code is null or btrim(new.ticket_code) = '' then
    new.ticket_code := 'TK-' || to_char(coalesce(new.created_at, now()), 'YYYY') || '-' || lpad(nextval('ticket_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_ticket_code on support_tickets;
create trigger trg_ticket_code
before insert on support_tickets
for each row execute function generate_ticket_code();

create or replace function public.sync_customer_rollup(target_customer_id uuid)
returns void
language plpgsql
as $$
begin
  if target_customer_id is null then
    return;
  end if;

  update customers
  set
    total_spent = (
      select coalesce(sum(total_amount), 0)
      from transactions
      where customer_id = target_customer_id
        and status = 'completed'
    ),
    total_orders = (
      select count(*)
      from transactions
      where customer_id = target_customer_id
        and status = 'completed'
    ),
    last_order_at = (
      select max(created_at)
      from transactions
      where customer_id = target_customer_id
        and status = 'completed'
    ),
    updated_at = now()
  where id = target_customer_id;
end;
$$;

create or replace function update_customer_stats() returns trigger as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_customer_rollup(old.customer_id);
    return old;
  end if;

  perform public.sync_customer_rollup(new.customer_id);

  if tg_op = 'UPDATE' and old.customer_id is distinct from new.customer_id then
    perform public.sync_customer_rollup(old.customer_id);
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_customer_stats on transactions;
create trigger trg_customer_stats
after insert or update or delete on transactions
for each row execute function update_customer_stats();

create index if not exists idx_audit_logs_created_at
  on audit_logs (created_at desc);

create index if not exists idx_audit_logs_entity_created_at
  on audit_logs (entity_type, created_at desc);

create index if not exists idx_audit_logs_user_created_at
  on audit_logs (user_id, created_at desc);

alter table if exists audit_logs enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_logs'
      and policyname = 'authenticated_all'
  ) then
    create policy "authenticated_all" on audit_logs
    for all to authenticated using (true) with check (true);
  end if;
end $$;

create or replace function get_dashboard_snapshot(p_range text default '7days')
returns table (
  total_customers bigint,
  new_customers_month bigint,
  total_revenue_month numeric,
  total_orders_month bigint,
  open_tickets bigint,
  resolved_tickets_month bigint,
  revenue_chart jsonb,
  customer_type_distribution jsonb,
  top_customers jsonb,
  urgent_tickets jsonb
)
language sql
stable
as $$
with bounds as (
  select
    case
      when p_range = 'today' then date_trunc('day', now())
      when p_range = '30days' then date_trunc('day', now()) - interval '29 days'
      else date_trunc('day', now()) - interval '6 days'
    end as range_start,
    date_trunc('month', now()) as month_start
),
customer_base as (
  select
    id,
    full_name,
    coalesce(customer_code, '') as customer_code,
    coalesce(customer_type, 'new') as customer_type,
    coalesce(total_spent, 0) as total_spent,
    created_at
  from customers
  where deleted_at is null
    and is_active = true
),
ticket_base as (
  select
    id,
    title,
    coalesce(priority, 'medium') as priority,
    customer_id,
    coalesce(status, 'open') as status,
    resolved_at,
    created_at
  from support_tickets
  where deleted_at is null
),
revenue_data as (
  select
    date_trunc('day', t.created_at) as period,
    sum(t.total_amount) as revenue,
    count(*)::bigint as orders
  from transactions t
  cross join bounds b
  where t.status = 'completed'
    and t.created_at >= b.range_start
  group by 1
),
revenue_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'period', to_char(period, 'YYYY-MM-DD'),
        'revenue', revenue,
        'orders', orders
      )
      order by period
    ),
    '[]'::jsonb
  ) as data
  from revenue_data
),
distribution_seed as (
  select * from (
    values
      ('VIP', 'vip', '#3b82f6', 1),
      ('Thân thiết', 'loyal', '#10b981', 2),
      ('Tiềm năng', 'potential', '#f59e0b', 3),
      ('Mới', 'new', '#8b92a5', 4),
      ('Không hoạt động', 'inactive', '#ef4444', 5)
  ) as seed(label, code, color, sort_order)
),
distribution_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'type', seed.label,
        'count', coalesce(counts.total, 0),
        'color', seed.color
      )
      order by seed.sort_order
    ),
    '[]'::jsonb
  ) as data
  from distribution_seed seed
  left join lateral (
    select count(*)::bigint as total
    from customer_base c
    where c.customer_type = seed.code
  ) counts on true
),
top_customers_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'full_name', c.full_name,
        'customer_code', c.customer_code,
        'customer_type', c.customer_type,
        'total_spent', c.total_spent
      )
      order by c.total_spent desc, c.created_at desc
    ),
    '[]'::jsonb
  ) as data
  from (
    select *
    from customer_base
    order by total_spent desc, created_at desc
    limit 5
  ) c
),
urgent_tickets_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'title', t.title,
        'priority', t.priority,
        'customer_id', t.customer_id,
        'customer_name', coalesce(c.full_name, 'Khách hàng không xác định'),
        'created_at', t.created_at
      )
      order by t.created_at desc
    ),
    '[]'::jsonb
  ) as data
  from (
    select *
    from ticket_base
    where priority in ('urgent', 'high')
    order by created_at desc
    limit 5
  ) t
  left join customer_base c on c.id = t.customer_id
)
select
  (select count(*) from customer_base) as total_customers,
  (select count(*) from customer_base c cross join bounds b where c.created_at >= b.month_start) as new_customers_month,
  (
    select coalesce(sum(t.total_amount), 0)
    from transactions t
    cross join bounds b
    where t.status = 'completed'
      and t.created_at >= b.month_start
  ) as total_revenue_month,
  (
    select count(*)
    from transactions t
    cross join bounds b
    where t.status = 'completed'
      and t.created_at >= b.month_start
  ) as total_orders_month,
  (
    select count(*)
    from ticket_base
    where status in ('open', 'in_progress', 'pending')
  ) as open_tickets,
  (
    select count(*)
    from ticket_base t
    cross join bounds b
    where t.resolved_at is not null
      and t.resolved_at >= b.month_start
  ) as resolved_tickets_month,
  (select data from revenue_json) as revenue_chart,
  (select data from distribution_json) as customer_type_distribution,
  (select data from top_customers_json) as top_customers,
  (select data from urgent_tickets_json) as urgent_tickets;
$$;

grant execute on function public.get_dashboard_snapshot(text) to anon, authenticated;
grant execute on function public.resolve_login_identifier(text) to anon, authenticated;
