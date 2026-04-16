begin;

-- Re-assert update policies để tránh drift môi trường khiến super_admin/admin
-- không cập nhật/xóa mềm được deals/tasks.

drop policy if exists deals_update on public.deals;
create policy deals_update on public.deals
  for update to authenticated
  using (
    public.has_org_access(org_id)
    and (
      public.has_any_role(array['super_admin', 'admin'])
      or (public.get_user_role() = 'sales' and assigned_to = auth.uid())
    )
  )
  with check (
    public.has_org_access(org_id)
    and (
      public.has_any_role(array['super_admin', 'admin'])
      or (public.get_user_role() = 'sales' and assigned_to = auth.uid())
    )
  );

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (
    public.has_org_access(org_id)
    and (
      public.has_any_role(array['super_admin', 'admin'])
      or (
        public.has_any_role(array['sales', 'cskh'])
        and assigned_to = auth.uid()
      )
    )
  )
  with check (
    public.has_org_access(org_id)
    and (
      public.has_any_role(array['super_admin', 'admin'])
      or (
        public.has_any_role(array['sales', 'cskh'])
        and assigned_to = auth.uid()
      )
    )
  );

commit;
