begin;

-- Mục tiêu: Sales xem được số liệu Pipeline (read-only) trong toàn tổ chức.
-- Không mở rộng quyền update/delete để tránh vượt quyền thao tác dữ liệu.

drop policy if exists deals_select on public.deals;
create policy deals_select on public.deals
  for select to authenticated
  using (
    public.has_org_access(org_id)
    and deleted_at is null
    and (
      public.has_any_role(array['super_admin', 'admin', 'director', 'sales'])
      or (public.get_user_role() = 'cskh' and assigned_to = auth.uid())
    )
  );

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated
  using (
    public.has_org_access(org_id)
    and deleted_at is null
    and (
      public.has_any_role(array['super_admin', 'admin', 'director', 'sales'])
      or (
        public.get_user_role() = 'cskh'
        and assigned_to = auth.uid()
      )
    )
  );

commit;
