alter table if exists campaigns
  add column if not exists click_count int default 0;

create table if not exists app_settings (
  id text primary key default 'default',
  company_name text not null default 'NexCRM Demo',
  logo_url text,
  plan text not null default 'Free' check (plan in ('Free')),
  notification_settings jsonb not null default '[
    {"key":"ticket_new","label":"Ticket mới","description":"Nhận thông báo khi có ticket mới phát sinh.","enabled":true},
    {"key":"ticket_update","label":"Cập nhật ticket","description":"Nhận thông báo khi ticket được cập nhật trạng thái.","enabled":true},
    {"key":"customer_new","label":"Khách hàng mới","description":"Nhận thông báo khi có khách hàng mới trong hệ thống.","enabled":true},
    {"key":"campaign_done","label":"Chiến dịch gửi xong","description":"Nhận thông báo khi chiến dịch marketing hoàn tất.","enabled":false}
  ]'::jsonb,
  integrations jsonb not null default '{
    "pos_webhook_url":"https://demo.nexcrm.vn/webhooks/pos-sync",
    "last_sync":"2024-01-21T09:30:00.000Z",
    "pos_status":"active",
    "email_provider":null,
    "sms_provider":null
  }'::jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into app_settings (id)
values ('default')
on conflict (id) do nothing;

alter table if exists app_settings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'app_settings'
      and policyname = 'authenticated_all'
  ) then
    create policy "authenticated_all" on app_settings
    for all to authenticated using (true) with check (true);
  end if;
end $$;
