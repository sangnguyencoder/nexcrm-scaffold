create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'sales' check (role in ('super_admin','admin','director','sales','cskh','marketing')),
  department text,
  avatar_url text,
  is_active boolean default true,
  last_login_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  customer_code text unique,
  full_name text not null,
  phone text,
  email text,
  address text,
  province text,
  date_of_birth date,
  gender text check (gender in ('male','female','other')),
  customer_type text default 'new' check (customer_type in ('new','potential','loyal','vip','inactive')),
  source text check (source in ('direct','marketing','referral','pos','online','other')),
  assigned_to uuid references profiles(id),
  total_spent decimal(15,2) default 0,
  total_orders int default 0,
  last_order_at timestamptz,
  is_active boolean default true,
  deleted_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  invoice_code text,
  items jsonb not null default '[]',
  subtotal decimal(15,2) default 0,
  discount decimal(15,2) default 0,
  tax decimal(15,2) default 0,
  total_amount decimal(15,2) not null default 0,
  payment_method text check (payment_method in ('cash','card','transfer','qr','other')),
  payment_status text default 'paid' check (payment_status in ('pending','paid','partial','refunded','cancelled')),
  status text default 'completed' check (status in ('pending','processing','completed','cancelled','refunded')),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table deals (
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

create table tasks (
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

create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_code text unique,
  customer_id uuid not null references customers(id),
  title text not null,
  description text,
  category text check (category in ('complaint','feedback','inquiry','return','other')),
  priority text default 'medium' check (priority in ('low','medium','high','urgent')),
  channel text check (channel in ('phone','email','direct','chat','social','other')),
  assigned_to uuid references profiles(id),
  status text default 'open' check (status in ('open','in_progress','pending','resolved','closed')),
  first_response_at timestamptz,
  resolved_at timestamptz,
  due_date timestamptz,
  satisfaction_score int check (satisfaction_score between 1 and 5),
  resolution_note text,
  created_by uuid references profiles(id),
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  author_id uuid not null references profiles(id),
  content text not null,
  is_internal boolean default false,
  created_at timestamptz default now()
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  channel text not null check (channel in ('email','sms','both')),
  subject text,
  content text not null,
  target_segment jsonb default '{}',
  recipient_count int default 0,
  status text default 'draft' check (status in ('draft','scheduled','sending','sent','cancelled')),
  sent_count int default 0,
  opened_count int default 0,
  click_count int default 0,
  failed_count int default 0,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  message text,
  type text default 'info' check (type in ('info','success','warning','error')),
  entity_type text check (entity_type in ('ticket','customer','campaign','transaction','task','deal','automation')),
  entity_id uuid,
  is_read boolean default false,
  read_at timestamptz,
  created_at timestamptz default now()
);

create table outbound_messages (
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

create table automation_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_active boolean default true,
  trigger_type text not null check (trigger_type in ('birthday','inactive_days','after_purchase','new_customer')),
  trigger_config jsonb default '{}',
  action_type text not null check (action_type in ('send_email','send_sms')),
  action_config jsonb default '{}',
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table app_settings (
  id text primary key default 'default',
  company_name text not null default 'NexCRM Demo',
  logo_url text,
  plan text not null default 'Free' check (plan in ('Free')),
  notification_settings jsonb not null default '[
    {"key":"ticket_new","label":"Ticket mới","description":"Nhận thông báo khi có ticket mới phát sinh.","enabled":true},
    {"key":"ticket_update","label":"Cập nhật ticket","description":"Nhận thông báo khi ticket được cập nhật trạng thái.","enabled":true},
    {"key":"customer_new","label":"Khách hàng mới","description":"Nhận thông báo khi có khách hàng mới trong hệ thống.","enabled":true},
    {"key":"campaign_done","label":"Chiến dịch gửi xong","description":"Nhận thông báo khi chiến dịch marketing hoàn tất.","enabled":true},
    {"key":"task_due","label":"Nhiệm vụ đến hạn","description":"Nhận thông báo khi có follow-up mới hoặc quá hạn.","enabled":true},
    {"key":"deal_stage","label":"Cập nhật pipeline","description":"Nhận thông báo khi cơ hội bán hàng đổi giai đoạn.","enabled":true}
  ]'::jsonb,
  integrations jsonb not null default '{
    "pos_webhook_url":"https://demo.nexcrm.vn/webhooks/pos-sync",
    "last_sync":"2024-01-21T09:30:00.000Z",
    "pos_status":"active",
    "email_provider":{"provider":null,"enabled":false,"from_name":"NexCRM","from_email":"","reply_to":""},
    "sms_provider":{"provider":null,"enabled":false,"sender_id":"NexCRM","from_number":""}
  }'::jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz default now()
);

create or replace function generate_customer_code() returns trigger as $$
declare seq int;
begin
  select count(*) + 1 into seq from customers;
  new.customer_code := 'KH-' || to_char(now(), 'YYYY') || '-' || lpad(seq::text, 4, '0');
  return new;
end;
$$ language plpgsql;

create trigger trg_customer_code
before insert on customers
for each row execute function generate_customer_code();

create or replace function generate_ticket_code() returns trigger as $$
declare seq int;
begin
  select count(*) + 1 into seq from support_tickets;
  new.ticket_code := 'TK-' || to_char(now(), 'YYYY') || '-' || lpad(seq::text, 4, '0');
  return new;
end;
$$ language plpgsql;

create trigger trg_ticket_code
before insert on support_tickets
for each row execute function generate_ticket_code();

create or replace function update_customer_stats() returns trigger as $$
begin
  update customers set
    total_spent = (select coalesce(sum(total_amount),0) from transactions where customer_id = new.customer_id and status='completed'),
    total_orders = (select count(*) from transactions where customer_id = new.customer_id and status='completed'),
    last_order_at = (select max(created_at) from transactions where customer_id = new.customer_id and status='completed'),
    updated_at = now()
  where id = new.customer_id;
  return new;
end;
$$ language plpgsql;

create trigger trg_customer_stats
after insert or update on transactions
for each row execute function update_customer_stats();

alter table profiles enable row level security;
alter table customers enable row level security;
alter table transactions enable row level security;
alter table deals enable row level security;
alter table tasks enable row level security;
alter table support_tickets enable row level security;
alter table ticket_comments enable row level security;
alter table campaigns enable row level security;
alter table notifications enable row level security;
alter table outbound_messages enable row level security;
alter table automation_rules enable row level security;
alter table app_settings enable row level security;

create policy "authenticated_all" on profiles
for all to authenticated using (true) with check (true);

create policy "authenticated_all" on customers
for all to authenticated using (deleted_at is null) with check (true);

create policy "authenticated_all" on transactions
for all to authenticated using (true) with check (true);

create policy "authenticated_all" on deals
for all to authenticated using (true) with check (true);

create policy "authenticated_all" on tasks
for all to authenticated using (true) with check (true);

create policy "authenticated_all" on support_tickets
for all to authenticated using (deleted_at is null) with check (true);

create policy "authenticated_all" on ticket_comments
for all to authenticated using (true) with check (true);

create policy "authenticated_all" on campaigns
for all to authenticated using (true) with check (true);

create policy "own_notifications" on notifications
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "authenticated_all" on outbound_messages
for all to authenticated using (true) with check (true);

create policy "authenticated_all" on automation_rules
for all to authenticated using (true) with check (true);

create policy "authenticated_all" on app_settings
for all to authenticated using (true) with check (true);
