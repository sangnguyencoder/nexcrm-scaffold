begin;

-- 1) Campaign status: cho phép trạng thái sent_with_errors khi gửi một phần thành công.
alter table public.campaigns
  drop constraint if exists campaigns_status_check;

alter table public.campaigns
  add constraint campaigns_status_check
  check (status in ('draft', 'scheduled', 'sending', 'sent', 'sent_with_errors', 'cancelled'));

-- 2) Rate limit table + RPC để giới hạn 1 campaign / org / phút.
create table if not exists public.campaign_send_rate_limits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  action text not null default 'send_campaign',
  actor_id uuid,
  window_start timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_campaign_send_rate_limits_window unique (org_id, action, window_start),
  constraint fk_campaign_send_rate_limits_actor
    foreign key (org_id, actor_id)
    references public.profiles(org_id, id)
    on delete set null
);

create index if not exists idx_campaign_send_rate_limits_org_created_at
  on public.campaign_send_rate_limits(org_id, created_at desc);

create or replace function public.acquire_campaign_send_rate_limit(
  p_org_id uuid,
  p_actor_id uuid default null,
  p_action text default 'send_campaign'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_window_start timestamptz;
begin
  if p_org_id is null then
    raise exception 'org_id is required for campaign rate limit';
  end if;

  v_action := coalesce(nullif(btrim(p_action), ''), 'send_campaign');
  v_window_start := date_trunc('minute', now());

  perform pg_advisory_xact_lock(
    hashtextextended(p_org_id::text || ':' || v_action || ':' || v_window_start::text, 0)
  );

  insert into public.campaign_send_rate_limits(org_id, action, actor_id, window_start)
  values (p_org_id, v_action, p_actor_id, v_window_start)
  on conflict (org_id, action, window_start) do nothing;

  return found;
end;
$$;

grant execute on function public.acquire_campaign_send_rate_limit(uuid, uuid, text) to authenticated;
grant execute on function public.acquire_campaign_send_rate_limit(uuid, uuid, text) to service_role;

alter table public.campaign_send_rate_limits enable row level security;

drop policy if exists campaign_send_rate_limits_select on public.campaign_send_rate_limits;
drop policy if exists campaign_send_rate_limits_insert on public.campaign_send_rate_limits;
drop policy if exists campaign_send_rate_limits_update on public.campaign_send_rate_limits;
drop policy if exists campaign_send_rate_limits_delete on public.campaign_send_rate_limits;

create policy campaign_send_rate_limits_select on public.campaign_send_rate_limits
  for select to authenticated
  using (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'director'])
  );

create policy campaign_send_rate_limits_insert on public.campaign_send_rate_limits
  for insert to authenticated
  with check (false);

create policy campaign_send_rate_limits_update on public.campaign_send_rate_limits
  for update to authenticated
  using (false)
  with check (false);

create policy campaign_send_rate_limits_delete on public.campaign_send_rate_limits
  for delete to authenticated
  using (false);

-- 3) Harden handle_new_user: bắt buộc org_id, chỉ auto-create org khi metadata allow_org_autocreate=true.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_base_slug text;
  v_slug text;
  v_name text;
  v_role text;
  v_suffix integer := 0;
  v_allow_org_autocreate boolean := false;
  v_org_raw text;
begin
  if exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;

  v_org_raw := coalesce(new.raw_user_meta_data ->> 'org_id', '');
  if v_org_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_org_id := v_org_raw::uuid;
  else
    v_org_id := null;
  end if;

  v_allow_org_autocreate := lower(coalesce(new.raw_user_meta_data ->> 'allow_org_autocreate', 'false'))
    in ('1', 'true', 'yes');

  v_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'organization_name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    split_part(new.email, '@', 1)
  );

  if v_org_id is not null and not exists (
    select 1 from public.organizations where id = v_org_id and deleted_at is null
  ) then
    raise exception 'org_id % does not exist or is deleted', v_org_id;
  end if;

  if v_org_id is null then
    if not v_allow_org_autocreate then
      raise exception 'org_id is required in user metadata for member provisioning';
    end if;

    v_base_slug := nullif(public.slugify(v_name), '');
    if v_base_slug is null then
      v_base_slug := 'org';
    end if;

    v_slug := v_base_slug;
    while exists (
      select 1
      from public.organizations
      where lower(slug) = lower(v_slug)
        and deleted_at is null
    ) loop
      v_suffix := v_suffix + 1;
      v_slug := v_base_slug || '-' || v_suffix;
    end loop;

    insert into public.organizations (name, slug, plan)
    values (v_name, v_slug, 'free')
    returning id into v_org_id;

    insert into public.app_settings (org_id)
    values (v_org_id)
    on conflict (org_id) do nothing;
  end if;

  v_role := nullif(new.raw_user_meta_data ->> 'role', '');
  if v_role not in ('super_admin', 'admin', 'director', 'sales', 'cskh', 'marketing') then
    v_role := case when v_allow_org_autocreate then 'admin' else 'sales' end;
  end if;

  insert into public.profiles (id, org_id, full_name, role)
  values (
    new.id,
    v_org_id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    v_role
  )
  on conflict (id) do nothing;

  insert into public.app_settings (org_id)
  values (v_org_id)
  on conflict (org_id) do nothing;

  return new;
exception
  when others then
    raise exception 'handle_new_user failed: %', sqlerrm;
end;
$$;

-- 4) Race-safe code generation: sequence + advisory lock theo org.
create or replace function public.generate_customer_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.customer_code is null or btrim(new.customer_code) = '' then
    perform pg_advisory_xact_lock(
      hashtextextended(coalesce(new.org_id::text, 'global') || ':customer_code', 0)
    );
    new.customer_code := format(
      'KH-%s-%s',
      to_char(coalesce(new.created_at, now()), 'YYYY'),
      lpad(nextval('public.customer_code_seq')::text, 4, '0')
    );
  end if;
  return new;
exception
  when others then
    raise exception 'generate_customer_code failed: %', sqlerrm;
end;
$$;

create or replace function public.generate_ticket_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.ticket_code is null or btrim(new.ticket_code) = '' then
    perform pg_advisory_xact_lock(
      hashtextextended(coalesce(new.org_id::text, 'global') || ':ticket_code', 0)
    );
    new.ticket_code := format(
      'TK-%s-%s',
      to_char(coalesce(new.created_at, now()), 'YYYY'),
      lpad(nextval('public.ticket_code_seq')::text, 4, '0')
    );
  end if;
  return new;
exception
  when others then
    raise exception 'generate_ticket_code failed: %', sqlerrm;
end;
$$;

-- 5) Re-assert customer stats trigger: loại trừ cancelled/refunded cho cả status + payment_status.
create or replace function public.recalculate_customer_stats(p_org_id uuid, p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_org_id is null or p_customer_id is null then
    return;
  end if;

  update public.customers as c
  set
    total_spent = coalesce(stats.total_spent, 0),
    total_orders = coalesce(stats.total_orders, 0),
    last_order_at = stats.last_order_at,
    updated_at = now()
  from (
    select
      t.org_id,
      t.customer_id,
      sum(
        case
          when t.deleted_at is null
            and t.status not in ('cancelled', 'refunded')
            and t.payment_status not in ('cancelled', 'refunded')
          then t.total_amount
          else 0
        end
      ) as total_spent,
      count(*) filter (
        where t.deleted_at is null
          and t.status not in ('cancelled', 'refunded')
          and t.payment_status not in ('cancelled', 'refunded')
      ) as total_orders,
      max(t.transaction_at) filter (
        where t.deleted_at is null
          and t.status not in ('cancelled', 'refunded')
          and t.payment_status not in ('cancelled', 'refunded')
      ) as last_order_at
    from public.transactions as t
    where t.org_id = p_org_id
      and t.customer_id = p_customer_id
    group by t.org_id, t.customer_id
  ) as stats
  where c.org_id = p_org_id
    and c.id = p_customer_id
    and c.org_id = stats.org_id
    and c.id = stats.customer_id;

  update public.customers
  set
    total_spent = 0,
    total_orders = 0,
    last_order_at = null,
    updated_at = now()
  where org_id = p_org_id
    and id = p_customer_id
    and not exists (
      select 1
      from public.transactions
      where org_id = p_org_id
        and customer_id = p_customer_id
        and deleted_at is null
        and status not in ('cancelled', 'refunded')
        and payment_status not in ('cancelled', 'refunded')
    );
end;
$$;

create or replace function public.update_customer_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_customer_stats(old.org_id, old.customer_id);
    return old;
  end if;

  perform public.recalculate_customer_stats(new.org_id, new.customer_id);

  if tg_op = 'UPDATE' and old.customer_id is distinct from new.customer_id then
    perform public.recalculate_customer_stats(old.org_id, old.customer_id);
  end if;

  return new;
exception
  when others then
    raise exception 'update_customer_stats failed: %', sqlerrm;
end;
$$;

-- 6) Soft-delete cascade từ customers sang các bảng liên quan để tránh orphan logic.
create or replace function public.cascade_customer_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_at timestamptz;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.deleted_at is null and new.deleted_at is not null then
    v_deleted_at := new.deleted_at;

    update public.customer_notes
    set deleted_at = coalesce(deleted_at, v_deleted_at),
        updated_at = now()
    where org_id = new.org_id
      and customer_id = new.id
      and deleted_at is null;

    update public.customer_tags
    set deleted_at = coalesce(deleted_at, v_deleted_at),
        updated_at = now()
    where org_id = new.org_id
      and customer_id = new.id
      and deleted_at is null;

    update public.transactions
    set deleted_at = coalesce(deleted_at, v_deleted_at),
        updated_at = now()
    where org_id = new.org_id
      and customer_id = new.id
      and deleted_at is null;

    update public.support_tickets
    set deleted_at = coalesce(deleted_at, v_deleted_at),
        updated_at = now()
    where org_id = new.org_id
      and customer_id = new.id
      and deleted_at is null;

    update public.deals
    set deleted_at = coalesce(deleted_at, v_deleted_at),
        updated_at = now()
    where org_id = new.org_id
      and customer_id = new.id
      and deleted_at is null;

    update public.tasks
    set deleted_at = coalesce(deleted_at, v_deleted_at),
        updated_at = now()
    where org_id = new.org_id
      and customer_id = new.id
      and deleted_at is null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_cascade_customer_soft_delete on public.customers;
create trigger trg_cascade_customer_soft_delete
after update on public.customers
for each row execute function public.cascade_customer_soft_delete();

-- 7) Index bổ sung cho query pattern tenant + assignee.
create index if not exists idx_customers_org_assigned_to_active
  on public.customers(org_id, assigned_to)
  where deleted_at is null;

create index if not exists idx_deals_org_assigned_to_active
  on public.deals(org_id, assigned_to)
  where deleted_at is null;

create index if not exists idx_tasks_org_assigned_to_active
  on public.tasks(org_id, assigned_to)
  where deleted_at is null;

-- 8) Dọn policy legacy quá rộng nếu còn sót.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and policyname = 'authenticated_all'
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      v_policy.policyname,
      v_policy.schemaname,
      v_policy.tablename
    );
  end loop;
end;
$$;

-- 9) Re-assert policies cho bảng nhạy cảm.
drop policy if exists outbound_messages_select on public.outbound_messages;
drop policy if exists outbound_messages_insert on public.outbound_messages;
drop policy if exists outbound_messages_update on public.outbound_messages;
drop policy if exists outbound_messages_delete on public.outbound_messages;

create policy outbound_messages_select on public.outbound_messages
  for select to authenticated
  using (public.has_org_access(org_id) and deleted_at is null);

create policy outbound_messages_insert on public.outbound_messages
  for insert to authenticated
  with check (false);

create policy outbound_messages_update on public.outbound_messages
  for update to authenticated
  using (false)
  with check (false);

create policy outbound_messages_delete on public.outbound_messages
  for delete to authenticated
  using (false);

drop policy if exists audit_logs_select on public.audit_logs;
drop policy if exists audit_logs_insert on public.audit_logs;
drop policy if exists audit_logs_update on public.audit_logs;
drop policy if exists audit_logs_delete on public.audit_logs;

create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (
    public.has_org_access(org_id)
    and deleted_at is null
    and public.has_any_role(array['super_admin', 'admin', 'director'])
  );

create policy audit_logs_insert on public.audit_logs
  for insert to authenticated
  with check (false);

create policy audit_logs_update on public.audit_logs
  for update to authenticated
  using (false)
  with check (false);

create policy audit_logs_delete on public.audit_logs
  for delete to authenticated
  using (false);

drop policy if exists app_settings_select on public.app_settings;
drop policy if exists app_settings_insert on public.app_settings;
drop policy if exists app_settings_update on public.app_settings;
drop policy if exists app_settings_delete on public.app_settings;

create policy app_settings_select on public.app_settings
  for select to authenticated
  using (public.has_org_access(org_id) and deleted_at is null);

create policy app_settings_insert on public.app_settings
  for insert to authenticated
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin'])
  );

create policy app_settings_update on public.app_settings
  for update to authenticated
  using (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin'])
  )
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin'])
  );

create policy app_settings_delete on public.app_settings
  for delete to authenticated
  using (false);

-- 10) Security-definer RPC để client ghi audit an toàn (không mở INSERT trực tiếp trên audit_logs).
create or replace function public.app_create_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_old_data jsonb default null,
  p_new_data jsonb default null,
  p_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_user_id uuid;
  v_id uuid;
begin
  v_org_id := public.get_user_org();
  if v_org_id is null then
    raise exception 'Không xác định được org_id của người dùng hiện tại.';
  end if;

  if p_user_id is not null
     and p_user_id <> auth.uid()
     and not public.has_any_role(array['super_admin', 'admin']) then
    v_user_id := auth.uid();
  else
    v_user_id := coalesce(p_user_id, auth.uid());
  end if;

  insert into public.audit_logs (
    org_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data
  )
  values (
    v_org_id,
    v_user_id,
    coalesce(nullif(btrim(p_action), ''), 'UPDATE'),
    coalesce(nullif(btrim(p_entity_type), ''), 'system'),
    p_entity_id,
    p_old_data,
    p_new_data
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.app_create_audit_log(text, text, uuid, jsonb, jsonb, uuid) to authenticated;

commit;
