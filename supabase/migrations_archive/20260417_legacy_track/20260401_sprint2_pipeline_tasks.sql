create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  customer_id uuid not null references customers(id) on delete cascade,
  owner_id uuid not null references profiles(id),
  stage text not null default 'lead' check (stage in ('lead','qualified','proposal','negotiation','won','lost')),
  value decimal(15,2) not null default 0,
  probability int not null default 20 check (probability between 0 and 100),
  expected_close_at timestamptz,
  description text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  entity_type text not null check (entity_type in ('customer','ticket','transaction','deal')),
  entity_id uuid not null,
  assigned_to uuid references profiles(id),
  status text not null default 'todo' check (status in ('todo','in_progress','done','overdue')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table if exists deals enable row level security;
alter table if exists tasks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'deals' and policyname = 'authenticated_all'
  ) then
    create policy "authenticated_all" on deals
    for all to authenticated using (true) with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tasks' and policyname = 'authenticated_all'
  ) then
    create policy "authenticated_all" on tasks
    for all to authenticated using (true) with check (true);
  end if;
end $$;
