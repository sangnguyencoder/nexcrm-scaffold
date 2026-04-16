create table if not exists public.pos_sync_logs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'pos',
  event_id text not null,
  event_type text not null default 'order.created',
  order_external_id text,
  customer_phone text,
  customer_email text,
  status text not null default 'received'
    check (status in ('received', 'processing', 'success', 'failed', 'duplicate')),
  payload jsonb not null default '{}'::jsonb,
  validation_errors jsonb,
  error_message text,
  customer_id uuid references public.customers(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_pos_sync_logs_event_id
  on public.pos_sync_logs (event_id);

create index if not exists idx_pos_sync_logs_created_at
  on public.pos_sync_logs (created_at desc);

create index if not exists idx_pos_sync_logs_status_created_at
  on public.pos_sync_logs (status, created_at desc);

create index if not exists idx_pos_sync_logs_order_external_id
  on public.pos_sync_logs (order_external_id);

create or replace function public.set_pos_sync_logs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_pos_sync_logs_updated_at on public.pos_sync_logs;
create trigger trg_pos_sync_logs_updated_at
before update on public.pos_sync_logs
for each row
execute function public.set_pos_sync_logs_updated_at();

alter table public.pos_sync_logs enable row level security;

drop policy if exists "pos_sync_logs_select_leads" on public.pos_sync_logs;
create policy "pos_sync_logs_select_leads"
on public.pos_sync_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles as p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'admin', 'director')
  )
);
