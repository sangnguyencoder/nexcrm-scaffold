begin;

do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and upper(cmd) = 'UPDATE'
  loop
    execute format('drop policy if exists %I on public.customers', v_policy.policyname);
  end loop;
end
$$;

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

create or replace function public.app_soft_delete_customer(p_customer_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor_id uuid;
  v_actor_org_id uuid;
  v_actor_role text;
  v_deleted_at timestamptz;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'Bạn chưa đăng nhập hợp lệ.';
  end if;

  select p.org_id, p.role
  into v_actor_org_id, v_actor_role
  from public.profiles as p
  where p.id = v_actor_id
    and p.deleted_at is null
    and p.is_active = true
  limit 1;

  if v_actor_org_id is null then
    raise exception 'Không tìm thấy hồ sơ người dùng hoặc tài khoản đã bị vô hiệu hóa.';
  end if;

  if v_actor_role not in ('super_admin', 'admin', 'director', 'sales') then
    raise exception 'Bạn không có quyền xóa mềm khách hàng. Chỉ Sales/Director/Admin/Super Admin được phép thực hiện.';
  end if;

  v_deleted_at := now();

  update public.customers
  set
    deleted_at = v_deleted_at,
    customer_type = 'inactive',
    updated_at = v_deleted_at
  where id = p_customer_id
    and deleted_at is null
    and (
      v_actor_role = 'super_admin'
      or org_id = v_actor_org_id
    )
  returning deleted_at into v_deleted_at;

  if v_deleted_at is null then
    raise exception 'Không tìm thấy khách hàng hoặc khách hàng đã bị xóa mềm.';
  end if;

  return v_deleted_at;
end;
$$;

grant execute on function public.app_soft_delete_customer(uuid) to authenticated, service_role;

commit;
