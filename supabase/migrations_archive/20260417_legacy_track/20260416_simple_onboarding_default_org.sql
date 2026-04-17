begin;

-- 1) Ensure default single-tenant organization exists for simple onboarding.
do $$
declare
  v_default_org_id uuid;
begin
  select id
  into v_default_org_id
  from public.organizations
  where slug = 'nexcrm-default'
    and deleted_at is null
  order by created_at asc nulls last
  limit 1;

  if v_default_org_id is null then
    update public.organizations
    set
      name = 'NexCRM Default',
      plan = coalesce(plan, 'free'),
      deleted_at = null,
      updated_at = now()
    where slug = 'nexcrm-default'
      and deleted_at is not null
    returning id into v_default_org_id;
  end if;

  if v_default_org_id is null then
    insert into public.organizations (name, slug, plan)
    values ('NexCRM Default', 'nexcrm-default', 'free')
    returning id into v_default_org_id;
  end if;

  if not exists (
    select 1
    from public.app_settings
    where org_id = v_default_org_id
  ) then
    insert into public.app_settings (org_id)
    values (v_default_org_id);
  end if;
end;
$$;

-- 2) Compatibility hardening: remove duplicated app_settings by org_id, keep latest record.
with ranked as (
  select
    id,
    row_number() over (
      partition by org_id
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from public.app_settings
)
delete from public.app_settings as s
using ranked as r
where s.id = r.id
  and r.rn > 1;

-- 3) Ensure unique constraint/index exists on app_settings.org_id.
do $$
declare
  v_org_id_attnum smallint;
begin
  select attnum
  into v_org_id_attnum
  from pg_attribute
  where attrelid = 'public.app_settings'::regclass
    and attname = 'org_id'
    and not attisdropped;

  if v_org_id_attnum is null then
    raise exception 'Column app_settings.org_id not found.';
  end if;

  if not exists (
    select 1
    from pg_index i
    join pg_class t on t.oid = i.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'app_settings'
      and i.indisunique
      and i.indpred is null
      and i.indkey::int2[] = array[v_org_id_attnum]::int2[]
  ) then
    create unique index if not exists idx_app_settings_org_id_unique
      on public.app_settings (org_id);
  end if;
end;
$$;

-- 4) Simplified onboarding: metadata optional, fallback to default org.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_default_org_id uuid;
  v_org_raw text;
  v_role text;
begin
  if exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;

  select id
  into v_default_org_id
  from public.organizations
  where slug = 'nexcrm-default'
    and deleted_at is null
  order by created_at asc nulls last
  limit 1;

  if v_default_org_id is null then
    insert into public.organizations (name, slug, plan)
    values ('NexCRM Default', 'nexcrm-default', 'free')
    returning id into v_default_org_id;
  end if;

  if not exists (
    select 1
    from public.app_settings
    where org_id = v_default_org_id
  ) then
    insert into public.app_settings (org_id)
    values (v_default_org_id);
  end if;

  v_org_raw := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'org_id', '')), '');
  if v_org_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_org_id := v_org_raw::uuid;
  else
    v_org_id := null;
  end if;

  if v_org_id is not null and not exists (
    select 1
    from public.organizations
    where id = v_org_id
      and deleted_at is null
  ) then
    v_org_id := null;
  end if;

  v_org_id := coalesce(v_org_id, v_default_org_id);

  v_role := lower(coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'sales'));
  if v_role not in ('super_admin', 'admin', 'director', 'sales', 'cskh', 'marketing') then
    v_role := 'sales';
  end if;

  insert into public.profiles (id, org_id, full_name, role, is_active)
  values (
    new.id,
    v_org_id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    v_role,
    true
  )
  on conflict (id) do nothing;

  if not exists (
    select 1
    from public.app_settings
    where org_id = v_org_id
  ) then
    insert into public.app_settings (org_id)
    values (v_org_id);
  end if;

  return new;
exception
  when others then
    raise exception 'handle_new_user failed: %', sqlerrm;
end;
$$;

commit;
