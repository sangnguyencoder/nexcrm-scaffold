begin;

drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions
  for select to authenticated
  using (
    has_org_access(org_id)
    and deleted_at is null
    and has_any_role(array['super_admin', 'admin', 'director', 'sales', 'cskh', 'marketing'])
  );

drop policy if exists support_tickets_select on public.support_tickets;
create policy support_tickets_select on public.support_tickets
  for select to authenticated
  using (
    has_org_access(org_id)
    and deleted_at is null
    and has_any_role(array['super_admin', 'admin', 'director', 'sales', 'cskh', 'marketing'])
  );

drop policy if exists deals_select on public.deals;
create policy deals_select on public.deals
  for select to authenticated
  using (
    has_org_access(org_id)
    and deleted_at is null
    and has_any_role(array['super_admin', 'admin', 'director', 'sales', 'marketing'])
  );

drop policy if exists deals_insert on public.deals;
create policy deals_insert on public.deals
  for insert to authenticated
  with check (
    has_org_access(org_id)
    and has_any_role(array['super_admin', 'admin', 'sales'])
  );

drop policy if exists deals_update on public.deals;
create policy deals_update on public.deals
  for update to authenticated
  using (
    has_org_access(org_id)
    and has_any_role(array['super_admin', 'admin', 'sales'])
  )
  with check (
    has_org_access(org_id)
    and has_any_role(array['super_admin', 'admin', 'sales'])
  );

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated
  using (
    has_org_access(org_id)
    and deleted_at is null
    and has_any_role(array['super_admin', 'admin', 'director', 'sales', 'cskh', 'marketing'])
  );

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (
    has_org_access(org_id)
    and has_any_role(array['super_admin', 'admin', 'sales', 'cskh'])
  );

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (
    has_org_access(org_id)
    and has_any_role(array['super_admin', 'admin', 'sales', 'cskh'])
  )
  with check (
    has_org_access(org_id)
    and has_any_role(array['super_admin', 'admin', 'sales', 'cskh'])
  );

commit;
