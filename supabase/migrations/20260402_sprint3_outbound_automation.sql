alter table campaigns
add column if not exists failed_count int default 0;

create table if not exists outbound_messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  automation_rule_id uuid references automation_rules(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  channel text not null check (channel in ('email','sms')),
  provider text,
  recipient text not null,
  subject text,
  content text not null,
  status text not null default 'queued' check (status in ('queued','sent','delivered','opened','clicked','failed')),
  error_message text,
  metadata jsonb default '{}'::jsonb,
  opened_at timestamptz,
  clicked_at timestamptz,
  sent_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table outbound_messages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'outbound_messages'
      and policyname = 'authenticated_all'
  ) then
    create policy "authenticated_all" on outbound_messages
      for all to authenticated using (true) with check (true);
  end if;
end
$$;

alter table notifications drop constraint if exists notifications_entity_type_check;
alter table notifications
add constraint notifications_entity_type_check
check (entity_type in ('ticket','customer','campaign','transaction','task','deal','automation'));

update app_settings
set notification_settings = jsonb_build_array(
  jsonb_build_object('key','ticket_new','label','Ticket mới','description','Nhận thông báo khi có ticket mới phát sinh.','enabled',true),
  jsonb_build_object('key','ticket_update','label','Cập nhật ticket','description','Nhận thông báo khi ticket được cập nhật trạng thái.','enabled',true),
  jsonb_build_object('key','customer_new','label','Khách hàng mới','description','Nhận thông báo khi có khách hàng mới trong hệ thống.','enabled',true),
  jsonb_build_object('key','campaign_done','label','Chiến dịch gửi xong','description','Nhận thông báo khi chiến dịch marketing hoàn tất.','enabled',true),
  jsonb_build_object('key','task_due','label','Nhiệm vụ đến hạn','description','Nhận thông báo khi có follow-up mới hoặc quá hạn.','enabled',true),
  jsonb_build_object('key','deal_stage','label','Cập nhật pipeline','description','Nhận thông báo khi cơ hội bán hàng đổi giai đoạn.','enabled',true)
),
integrations = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          coalesce(integrations, '{}'::jsonb),
          '{email_provider}',
          coalesce(integrations->'email_provider', '{"provider":null,"enabled":false,"from_name":"NexCRM","from_email":"","reply_to":""}'::jsonb),
          true
        ),
        '{sms_provider}',
        coalesce(integrations->'sms_provider', '{"provider":null,"enabled":false,"sender_id":"NexCRM","from_number":""}'::jsonb),
        true
      ),
      '{last_sync}',
      to_jsonb(coalesce(integrations->>'last_sync', '2024-01-21T09:30:00.000Z')),
      true
    ),
    '{pos_status}',
    to_jsonb(coalesce(integrations->>'pos_status', 'active')),
    true
  ),
  '{pos_webhook_url}',
  to_jsonb(coalesce(integrations->>'pos_webhook_url', 'https://demo.nexcrm.vn/webhooks/pos-sync')),
  true
)
where id = 'default';
