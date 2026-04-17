begin;

alter table if exists public.profiles
  add column if not exists email text;

alter table if exists public.profiles
  add column if not exists department text;

alter table if exists public.profiles
  alter column department set default 'Chưa phân bổ';

update public.profiles as p
set
  email = lower(u.email),
  department = coalesce(
    nullif(btrim(p.department), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'department'), ''),
    'Chưa phân bổ'
  ),
  full_name = coalesce(
    nullif(btrim(p.full_name), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(lower(u.email), '@', 1), ''),
    'user-' || left(u.id::text, 8)
  ),
  updated_at = now()
from auth.users as u
where u.id = p.id
  and (
    p.email is distinct from lower(u.email)
    or coalesce(btrim(p.department), '') = ''
    or coalesce(btrim(p.full_name), '') = ''
  );

create unique index if not exists idx_profiles_email_unique
  on public.profiles (lower(email))
  where email is not null and deleted_at is null;

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

  insert into public.profiles (
    id,
    org_id,
    email,
    full_name,
    role,
    department,
    is_active,
    created_at,
    updated_at
  )
  select
    u.id,
    coalesce(
      case
        when coalesce(u.raw_user_meta_data ->> 'org_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          and exists (
            select 1
            from public.organizations as o
            where o.id = (u.raw_user_meta_data ->> 'org_id')::uuid
              and o.deleted_at is null
          )
        then (u.raw_user_meta_data ->> 'org_id')::uuid
        else null
      end,
      v_default_org_id
    ) as org_id,
    lower(u.email),
    coalesce(
      nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(lower(u.email), '@', 1), ''),
      'user-' || left(u.id::text, 8)
    ) as full_name,
    case
      when lower(coalesce(u.raw_user_meta_data ->> 'role', '')) in ('super_admin', 'admin', 'director', 'sales', 'cskh', 'marketing')
        then lower(u.raw_user_meta_data ->> 'role')
      else 'sales'
    end as role,
    coalesce(
      nullif(btrim(u.raw_user_meta_data ->> 'department'), ''),
      'Chưa phân bổ'
    ) as department,
    true,
    now(),
    now()
  from auth.users as u
  left join public.profiles as p on p.id = u.id
  where p.id is null;
end
$$;

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
  v_department text;
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

  v_department := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'department'), ''),
    'Chưa phân bổ'
  );

  insert into public.profiles (id, org_id, email, full_name, role, department, is_active)
  values (
    new.id,
    v_org_id,
    lower(new.email),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    v_role,
    v_department,
    true
  )
  on conflict (id) do update
  set
    email = excluded.email,
    department = coalesce(nullif(btrim(public.profiles.department), ''), excluded.department),
    updated_at = now();

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

drop policy if exists customers_update on public.customers;

create policy customers_update on public.customers
  for update to authenticated
  using (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'director', 'sales'])
  )
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'director', 'sales'])
  );

commit;
