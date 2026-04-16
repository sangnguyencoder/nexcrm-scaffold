begin;

alter table if exists public.profiles
  add column if not exists email text;

alter table if exists public.profiles
  add column if not exists department text;

alter table if exists public.profiles
  alter column department set default 'Chưa phân bổ';

do $$
declare
  v_default_org_id uuid;
begin
  select id
  into v_default_org_id
  from public.organizations
  where deleted_at is null
  order by created_at asc nulls last
  limit 1;

  if v_default_org_id is null then
    insert into public.organizations (name, slug, plan)
    values ('NexCRM Default', 'nexcrm-default', 'free')
    returning id into v_default_org_id;
  end if;

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

  insert into public.profiles (
    id,
    org_id,
    email,
    full_name,
    role,
    department,
    avatar_url,
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
    ),
    case
      when lower(coalesce(u.raw_user_meta_data ->> 'role', '')) in ('super_admin', 'admin', 'director', 'sales', 'cskh', 'marketing')
        then lower(u.raw_user_meta_data ->> 'role')
      else 'sales'
    end,
    coalesce(
      nullif(btrim(u.raw_user_meta_data ->> 'department'), ''),
      'Chưa phân bổ'
    ),
    null,
    true,
    now(),
    now()
  from auth.users as u
  left join public.profiles as p on p.id = u.id
  where p.id is null;
end
$$;

create unique index if not exists idx_profiles_email_unique
  on public.profiles (lower(email))
  where email is not null and deleted_at is null;

create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default_org_id uuid;
  v_org_id uuid;
  v_full_name text;
  v_role text;
  v_department text;
begin
  select id
  into v_default_org_id
  from public.organizations
  where deleted_at is null
  order by created_at asc nulls last
  limit 1;

  if v_default_org_id is null then
    insert into public.organizations (name, slug, plan)
    values ('NexCRM Default', 'nexcrm-default', 'free')
    returning id into v_default_org_id;
  end if;

  if coalesce(new.raw_user_meta_data ->> 'org_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and exists (
      select 1
      from public.organizations as o
      where o.id = (new.raw_user_meta_data ->> 'org_id')::uuid
        and o.deleted_at is null
    ) then
    v_org_id := (new.raw_user_meta_data ->> 'org_id')::uuid;
  else
    v_org_id := v_default_org_id;
  end if;

  v_full_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(lower(new.email), '@', 1), ''),
    'user-' || left(new.id::text, 8)
  );

  v_role := lower(coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'sales'));
  if v_role not in ('super_admin', 'admin', 'director', 'sales', 'cskh', 'marketing') then
    v_role := 'sales';
  end if;

  v_department := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'department'), ''),
    'Chưa phân bổ'
  );

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
  values (
    new.id,
    v_org_id,
    lower(new.email),
    v_full_name,
    v_role,
    v_department,
    true,
    now(),
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    department = coalesce(nullif(btrim(public.profiles.department), ''), excluded.department),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_auth_users_sync_profile on auth.users;

create trigger trg_auth_users_sync_profile
after insert or update of email, raw_user_meta_data
on auth.users
for each row
execute function public.sync_profile_from_auth_user();

commit;
