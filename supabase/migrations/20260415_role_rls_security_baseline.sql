create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles as p
  where p.id = auth.uid()
  limit 1
$$;

grant execute on function public.current_profile_role() to authenticated;

drop view if exists public.profiles_directory;
create view public.profiles_directory as
select
  p.id,
  p.full_name,
  p.role,
  p.department,
  p.avatar_url,
  p.is_active,
  p.created_at,
  p.updated_at
from public.profiles as p
where coalesce(p.is_active, true) = true;

grant select on public.profiles_directory to authenticated;

alter table if exists public.profiles enable row level security;
alter table if exists public.app_settings enable row level security;
alter table if exists public.audit_logs enable row level security;

drop policy if exists "authenticated_all" on public.profiles;
drop policy if exists "profiles_select_self_or_lead" on public.profiles;
drop policy if exists "profiles_insert_admin_only" on public.profiles;
drop policy if exists "profiles_update_admin_only" on public.profiles;
drop policy if exists "profiles_delete_admin_only" on public.profiles;

create policy "profiles_select_self_or_lead"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.current_profile_role() in ('super_admin', 'admin', 'director')
);

create policy "profiles_insert_admin_only"
on public.profiles
for insert
to authenticated
with check (
  public.current_profile_role() in ('super_admin', 'admin')
);

create policy "profiles_update_admin_only"
on public.profiles
for update
to authenticated
using (
  public.current_profile_role() in ('super_admin', 'admin')
)
with check (
  public.current_profile_role() in ('super_admin', 'admin')
);

create policy "profiles_delete_admin_only"
on public.profiles
for delete
to authenticated
using (
  public.current_profile_role() in ('super_admin', 'admin')
);

drop policy if exists "authenticated_all" on public.app_settings;
drop policy if exists "app_settings_select_all" on public.app_settings;
drop policy if exists "app_settings_insert_default" on public.app_settings;
drop policy if exists "app_settings_update_admin_only" on public.app_settings;
drop policy if exists "app_settings_delete_admin_only" on public.app_settings;

create policy "app_settings_select_all"
on public.app_settings
for select
to authenticated
using (true);

create policy "app_settings_insert_default"
on public.app_settings
for insert
to authenticated
with check (id = 'default');

create policy "app_settings_update_admin_only"
on public.app_settings
for update
to authenticated
using (
  public.current_profile_role() in ('super_admin', 'admin')
)
with check (
  public.current_profile_role() in ('super_admin', 'admin')
);

create policy "app_settings_delete_admin_only"
on public.app_settings
for delete
to authenticated
using (
  public.current_profile_role() in ('super_admin', 'admin')
);

drop policy if exists "authenticated_all" on public.audit_logs;
drop policy if exists "audit_logs_select_scoped" on public.audit_logs;
drop policy if exists "audit_logs_insert_authenticated" on public.audit_logs;
drop policy if exists "audit_logs_update_admin_only" on public.audit_logs;
drop policy if exists "audit_logs_delete_admin_only" on public.audit_logs;

create policy "audit_logs_select_scoped"
on public.audit_logs
for select
to authenticated
using (
  public.current_profile_role() in ('super_admin', 'admin', 'director')
  or entity_type in ('customer_note', 'ticket_status')
);

create policy "audit_logs_insert_authenticated"
on public.audit_logs
for insert
to authenticated
with check (
  user_id is null
  or user_id = auth.uid()
  or public.current_profile_role() in ('super_admin', 'admin')
);

create policy "audit_logs_update_admin_only"
on public.audit_logs
for update
to authenticated
using (
  public.current_profile_role() in ('super_admin', 'admin')
)
with check (
  public.current_profile_role() in ('super_admin', 'admin')
);

create policy "audit_logs_delete_admin_only"
on public.audit_logs
for delete
to authenticated
using (
  public.current_profile_role() in ('super_admin', 'admin')
);
