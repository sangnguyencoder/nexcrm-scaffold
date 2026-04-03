create extension if not exists pg_trgm;

create sequence if not exists customer_code_seq;
select setval(
  'customer_code_seq',
  greatest(
    coalesce(
      (
        select max(nullif(right(customer_code, 4), '')::bigint)
        from customers
        where customer_code is not null
      ),
      0
    ),
    0
  ),
  true
);

create or replace function generate_customer_code() returns trigger as $$
begin
  if new.customer_code is null or btrim(new.customer_code) = '' then
    new.customer_code := 'KH-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('customer_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create sequence if not exists ticket_code_seq;
select setval(
  'ticket_code_seq',
  greatest(
    coalesce(
      (
        select max(nullif(right(ticket_code, 4), '')::bigint)
        from support_tickets
        where ticket_code is not null
      ),
      0
    ),
    0
  ),
  true
);

create or replace function generate_ticket_code() returns trigger as $$
begin
  if new.ticket_code is null or btrim(new.ticket_code) = '' then
    new.ticket_code := 'TK-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('ticket_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create index if not exists idx_customers_active_created_at
  on customers (created_at desc)
  where deleted_at is null and is_active = true;

create index if not exists idx_customers_active_customer_type_created_at
  on customers (customer_type, created_at desc)
  where deleted_at is null and is_active = true;

create index if not exists idx_customers_assigned_to_created_at
  on customers (assigned_to, created_at desc)
  where deleted_at is null;

create index if not exists idx_customers_search_trgm
  on customers
  using gin ((coalesce(full_name, '') || ' ' || coalesce(phone, '') || ' ' || coalesce(email, '')) gin_trgm_ops)
  where deleted_at is null;

create index if not exists idx_transactions_customer_created_at
  on transactions (customer_id, created_at desc);

create index if not exists idx_transactions_status_created_at
  on transactions (status, created_at desc);

create index if not exists idx_transactions_payment_method_created_at
  on transactions (payment_method, created_at desc);

create index if not exists idx_deals_stage_created_at
  on deals (stage, created_at desc);

create index if not exists idx_deals_owner_stage_created_at
  on deals (owner_id, stage, created_at desc);

create index if not exists idx_deals_customer_created_at
  on deals (customer_id, created_at desc);

create index if not exists idx_deals_title_trgm
  on deals using gin (title gin_trgm_ops);

create index if not exists idx_tasks_entity_lookup
  on tasks (entity_type, entity_id, created_at desc);

create index if not exists idx_tasks_assigned_status_due_at
  on tasks (assigned_to, status, due_at);

create index if not exists idx_tasks_open_due_at
  on tasks (due_at)
  where status <> 'done';

create index if not exists idx_support_tickets_status_created_at
  on support_tickets (status, created_at desc)
  where deleted_at is null;

create index if not exists idx_support_tickets_priority_created_at
  on support_tickets (priority, created_at desc)
  where deleted_at is null;

create index if not exists idx_support_tickets_assigned_status
  on support_tickets (assigned_to, status, created_at desc)
  where deleted_at is null;

create index if not exists idx_support_tickets_customer_created_at
  on support_tickets (customer_id, created_at desc)
  where deleted_at is null;

create index if not exists idx_support_tickets_title_trgm
  on support_tickets using gin (title gin_trgm_ops)
  where deleted_at is null;

create index if not exists idx_notifications_user_unread_created_at
  on notifications (user_id, is_read, created_at desc);

create index if not exists idx_outbound_messages_campaign_created_at
  on outbound_messages (campaign_id, created_at desc);

create index if not exists idx_outbound_messages_automation_created_at
  on outbound_messages (automation_rule_id, created_at desc);

create index if not exists idx_outbound_messages_status_created_at
  on outbound_messages (status, created_at desc);

create index if not exists idx_campaigns_status_created_at
  on campaigns (status, created_at desc);

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
      ('Than thiet', 'loyal', '#10b981', 2),
      ('Tiem nang', 'potential', '#f59e0b', 3),
      ('Moi', 'new', '#8b92a5', 4),
      ('Khong hoat dong', 'inactive', '#ef4444', 5)
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
        'customer_name', coalesce(c.full_name, 'Khach hang khong xac dinh'),
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
