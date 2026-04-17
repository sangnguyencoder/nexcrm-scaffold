-- Canonical baseline for full reset bootstrap.
begin;

-- Reset toàn bộ schema public để tránh drift/hotfix chồng chéo.
drop schema if exists public cascade;
create schema public;

alter schema public owner to postgres;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant create on schema public to postgres, service_role;

commit;
begin;

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists unaccent;

set search_path = public, auth;

create or replace function public.slugify(p_value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(p_value, '')), '[^a-z0-9]+', '-', 'g'))
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  plan text not null default 'free'
    check (plan in ('free', 'pro', 'enterprise')),
  settings jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id),
  full_name text not null,
  role text not null default 'sales'
    check (role in ('super_admin', 'admin', 'director', 'sales', 'cskh', 'marketing')),
  phone text,
  avatar_url text,
  is_active boolean not null default true,
  last_login_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_profiles_org_id_id unique (org_id, id)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  name text not null,
  color text not null default '#3b82f6',
  description text,
  created_by uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_tags_org_id_id unique (org_id, id),
  constraint fk_tags_created_by
    foreign key (org_id, created_by)
    references public.profiles(org_id, id)
    on delete set null
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  customer_code text,
  full_name text not null,
  phone text,
  email text,
  address text,
  province text,
  district text,
  ward text,
  date_of_birth date,
  gender text
    check (gender in ('male', 'female', 'other')),
  customer_type text not null default 'new'
    check (customer_type in ('new', 'potential', 'loyal', 'vip', 'inactive')),
  source text
    check (source in ('direct', 'marketing', 'referral', 'pos', 'online', 'other')),
  assigned_to uuid,
  total_spent numeric(15,2) not null default 0,
  total_orders integer not null default 0,
  last_order_at timestamptz,
  custom_fields jsonb not null default '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_customers_org_id_id unique (org_id, id),
  constraint fk_customers_assigned_to
    foreign key (org_id, assigned_to)
    references public.profiles(org_id, id)
    on delete set null,
  constraint fk_customers_created_by
    foreign key (org_id, created_by)
    references public.profiles(org_id, id)
    on delete set null,
  constraint fk_customers_updated_by
    foreign key (org_id, updated_by)
    references public.profiles(org_id, id)
    on delete set null
);

create table public.customer_tags (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  customer_id uuid not null,
  tag_id uuid not null,
  created_by uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_customer_tags_org_id_id unique (org_id, id),
  constraint fk_customer_tags_customer
    foreign key (org_id, customer_id)
    references public.customers(org_id, id)
    on delete restrict,
  constraint fk_customer_tags_tag
    foreign key (org_id, tag_id)
    references public.tags(org_id, id)
    on delete restrict,
  constraint fk_customer_tags_created_by
    foreign key (org_id, created_by)
    references public.profiles(org_id, id)
    on delete set null
);

create table public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  customer_id uuid not null,
  author_id uuid not null,
  note_type text not null default 'general'
    check (note_type in ('general', 'call', 'meeting', 'follow_up', 'system')),
  content text not null,
  is_pinned boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_customer_notes_org_id_id unique (org_id, id),
  constraint fk_customer_notes_customer
    foreign key (org_id, customer_id)
    references public.customers(org_id, id)
    on delete restrict,
  constraint fk_customer_notes_author
    foreign key (org_id, author_id)
    references public.profiles(org_id, id)
    on delete restrict
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  customer_id uuid not null,
  invoice_code text,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(15,2) not null default 0,
  total_amount numeric(15,2) not null,
  payment_method text not null default 'cash'
    check (payment_method in ('cash', 'card', 'transfer', 'qr', 'other')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'partial', 'refunded', 'cancelled')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'cancelled', 'refunded')),
  source text not null default 'manual'
    check (source in ('manual', 'pos_sync', 'api')),
  transaction_at timestamptz not null default now(),
  notes text,
  processed_by uuid,
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_transactions_org_id_id unique (org_id, id),
  constraint fk_transactions_customer
    foreign key (org_id, customer_id)
    references public.customers(org_id, id)
    on delete restrict,
  constraint fk_transactions_processed_by
    foreign key (org_id, processed_by)
    references public.profiles(org_id, id)
    on delete set null,
  constraint fk_transactions_created_by
    foreign key (org_id, created_by)
    references public.profiles(org_id, id)
    on delete set null,
  constraint fk_transactions_updated_by
    foreign key (org_id, updated_by)
    references public.profiles(org_id, id)
    on delete set null
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  ticket_code text,
  customer_id uuid not null,
  title text not null,
  description text,
  category text not null default 'other'
    check (category in ('complaint', 'feedback', 'inquiry', 'return', 'other')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  channel text not null default 'direct'
    check (channel in ('phone', 'email', 'direct', 'chat', 'social')),
  assigned_to uuid,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'pending', 'resolved', 'closed')),
  due_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  satisfaction_score integer
    check (satisfaction_score between 1 and 5),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_support_tickets_org_id_id unique (org_id, id),
  constraint fk_support_tickets_customer
    foreign key (org_id, customer_id)
    references public.customers(org_id, id)
    on delete restrict,
  constraint fk_support_tickets_assigned_to
    foreign key (org_id, assigned_to)
    references public.profiles(org_id, id)
    on delete set null,
  constraint fk_support_tickets_created_by
    foreign key (org_id, created_by)
    references public.profiles(org_id, id)
    on delete set null,
  constraint fk_support_tickets_updated_by
    foreign key (org_id, updated_by)
    references public.profiles(org_id, id)
    on delete set null
);

create table public.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  ticket_id uuid not null,
  author_id uuid not null,
  content text not null,
  is_internal boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_ticket_comments_org_id_id unique (org_id, id),
  constraint fk_ticket_comments_ticket
    foreign key (org_id, ticket_id)
    references public.support_tickets(org_id, id)
    on delete restrict,
  constraint fk_ticket_comments_author
    foreign key (org_id, author_id)
    references public.profiles(org_id, id)
    on delete restrict
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  customer_id uuid,
  title text not null,
  description text,
  stage text not null default 'lead'
    check (stage in ('lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
  value numeric(15,2) not null default 0,
  probability integer not null default 0
    check (probability between 0 and 100),
  expected_close_date date,
  actual_close_date date,
  lost_reason text,
  assigned_to uuid,
  created_by uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_deals_org_id_id unique (org_id, id),
  constraint fk_deals_customer
    foreign key (org_id, customer_id)
    references public.customers(org_id, id)
    on delete set null,
  constraint fk_deals_assigned_to
    foreign key (org_id, assigned_to)
    references public.profiles(org_id, id)
    on delete set null,
  constraint fk_deals_created_by
    foreign key (org_id, created_by)
    references public.profiles(org_id, id)
    on delete set null
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  deal_id uuid,
  customer_id uuid,
  ticket_id uuid,
  title text not null,
  description text,
  task_type text not null default 'follow_up'
    check (task_type in ('call', 'email', 'meeting', 'follow_up', 'demo', 'other')),
  due_date timestamptz,
  completed_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'done', 'cancelled')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  assigned_to uuid,
  created_by uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_tasks_org_id_id unique (org_id, id),
  constraint fk_tasks_deal
    foreign key (org_id, deal_id)
    references public.deals(org_id, id)
    on delete set null,
  constraint fk_tasks_customer
    foreign key (org_id, customer_id)
    references public.customers(org_id, id)
    on delete set null,
  constraint fk_tasks_ticket
    foreign key (org_id, ticket_id)
    references public.support_tickets(org_id, id)
    on delete set null,
  constraint fk_tasks_assigned_to
    foreign key (org_id, assigned_to)
    references public.profiles(org_id, id)
    on delete set null,
  constraint fk_tasks_created_by
    foreign key (org_id, created_by)
    references public.profiles(org_id, id)
    on delete set null
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  name text not null,
  description text,
  channel text not null
    check (channel in ('email', 'sms', 'both')),
  subject text,
  content text,
  target_segment jsonb not null default '{}'::jsonb,
  recipient_count integer not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  sent_count integer not null default 0,
  opened_count integer not null default 0,
  failed_count integer not null default 0,
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_campaigns_org_id_id unique (org_id, id),
  constraint fk_campaigns_created_by
    foreign key (org_id, created_by)
    references public.profiles(org_id, id)
    on delete set null,
  constraint fk_campaigns_updated_by
    foreign key (org_id, updated_by)
    references public.profiles(org_id, id)
    on delete set null
);

create table public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  campaign_id uuid not null,
  customer_id uuid not null,
  channel text not null check (channel in ('email', 'sms')),
  recipient_email text,
  recipient_phone text,
  personalized_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'queued', 'sent', 'opened', 'failed', 'bounced')),
  delivered_at timestamptz,
  opened_at timestamptz,
  failed_at timestamptz,
  error_message text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_campaign_recipients_org_id_id unique (org_id, id),
  constraint fk_campaign_recipients_campaign
    foreign key (org_id, campaign_id)
    references public.campaigns(org_id, id)
    on delete restrict,
  constraint fk_campaign_recipients_customer
    foreign key (org_id, customer_id)
    references public.customers(org_id, id)
    on delete restrict
);

create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  name text not null,
  description text,
  trigger_type text not null
    check (trigger_type in ('birthday', 'inactive_days', 'after_purchase', 'new_customer')),
  trigger_config jsonb not null default '{}'::jsonb,
  action_type text not null
    check (action_type in ('send_email', 'send_sms')),
  template_subject text,
  template_content text not null,
  is_active boolean not null default true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_automation_rules_org_id_id unique (org_id, id),
  constraint fk_automation_rules_created_by
    foreign key (org_id, created_by)
    references public.profiles(org_id, id)
    on delete set null,
  constraint fk_automation_rules_updated_by
    foreign key (org_id, updated_by)
    references public.profiles(org_id, id)
    on delete set null
);

create table public.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  customer_id uuid,
  campaign_id uuid,
  automation_rule_id uuid,
  channel text not null
    check (channel in ('email', 'sms')),
  recipient_email text,
  recipient_phone text,
  subject text,
  content text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed', 'bounced')),
  sent_at timestamptz,
  error_message text,
  provider text,
  provider_message_id text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_outbound_messages_org_id_id unique (org_id, id),
  constraint fk_outbound_messages_customer
    foreign key (org_id, customer_id)
    references public.customers(org_id, id)
    on delete set null,
  constraint fk_outbound_messages_campaign
    foreign key (org_id, campaign_id)
    references public.campaigns(org_id, id)
    on delete set null,
  constraint fk_outbound_messages_automation_rule
    foreign key (org_id, automation_rule_id)
    references public.automation_rules(org_id, id)
    on delete set null
);

create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations(id),
  email_provider text not null default 'resend'
    check (email_provider in ('resend', 'sendgrid', 'smtp')),
  email_api_key text,
  email_from_name text,
  email_from_address text,
  sms_provider text
    check (sms_provider in ('twilio', 'esms', 'viettel_sms')),
  sms_api_key text,
  pos_provider text
    check (pos_provider in ('kiotviet', 'misa', 'haravan', 'sapo', 'custom')),
  pos_api_endpoint text,
  pos_api_key text,
  pos_sync_interval integer not null default 30 check (pos_sync_interval > 0),
  pos_last_sync_at timestamptz,
  pos_sync_enabled boolean not null default false,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  currency text not null default 'VND',
  date_format text not null default 'DD/MM/YYYY',
  updated_by uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_app_settings_org_id_id unique (org_id, id),
  constraint fk_app_settings_updated_by
    foreign key (org_id, updated_by)
    references public.profiles(org_id, id)
    on delete set null
);

create table public.file_attachments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  uploaded_by uuid,
  entity_type text not null,
  entity_id uuid not null,
  bucket_name text not null default 'crm-files',
  file_name text not null,
  file_path text not null,
  mime_type text,
  file_size bigint not null default 0 check (file_size >= 0),
  metadata jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_file_attachments_org_id_id unique (org_id, id),
  constraint fk_file_attachments_uploaded_by
    foreign key (org_id, uploaded_by)
    references public.profiles(org_id, id)
    on delete set null
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  user_id uuid not null,
  type text not null,
  title text not null,
  message text not null,
  data jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  created_by uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_notifications_org_id_id unique (org_id, id),
  constraint fk_notifications_user
    foreign key (org_id, user_id)
    references public.profiles(org_id, id)
    on delete restrict,
  constraint fk_notifications_created_by
    foreign key (org_id, created_by)
    references public.profiles(org_id, id)
    on delete set null
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_audit_logs_org_id_id unique (org_id, id),
  constraint fk_audit_logs_user
    foreign key (org_id, user_id)
    references public.profiles(org_id, id)
    on delete set null
);

create table public.pos_sync_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  provider text,
  sync_type text not null default 'polling'
    check (sync_type in ('polling', 'manual_import', 'webhook')),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'success', 'failed')),
  started_at timestamptz,
  finished_at timestamptz,
  records_processed integer not null default 0,
  records_created integer not null default 0,
  records_updated integer not null default 0,
  error_message text,
  request_payload jsonb,
  response_payload jsonb,
  created_by uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_pos_sync_logs_org_id_id unique (org_id, id),
  constraint fk_pos_sync_logs_created_by
    foreign key (org_id, created_by)
    references public.profiles(org_id, id)
    on delete set null
);

create or replace function public.get_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles as p
  where p.id = auth.uid()
    and p.deleted_at is null
    and p.is_active = true
  limit 1
$$;

create or replace function public.get_user_org()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.org_id
  from public.profiles as p
  where p.id = auth.uid()
    and p.deleted_at is null
    and p.is_active = true
  limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_user_role() in ('super_admin', 'admin'), false)
$$;

create or replace function public.has_any_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_user_role() = any (p_roles), false)
$$;

create or replace function public.has_org_access(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and (
       public.get_user_role() = 'super_admin'
       or p_org_id = public.get_user_org()
     )
$$;

create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  select coalesce(auth.role() = 'service_role', false)
$$;

create or replace function public.assert_org_access(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null and not public.is_service_role() then
    raise exception 'authentication required';
  end if;

  if p_org_id is null then
    raise exception 'p_org_id is required';
  end if;

  if public.is_service_role() then
    return;
  end if;

  if public.get_user_role() <> 'super_admin' and p_org_id <> public.get_user_org() then
    raise exception 'access denied for organization %', p_org_id;
  end if;
end;
$$;

grant execute on function public.get_user_role() to authenticated, service_role;
grant execute on function public.get_user_org() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.has_any_role(text[]) to authenticated, service_role;
grant execute on function public.has_org_access(uuid) to authenticated, service_role;
grant execute on function public.is_service_role() to authenticated, service_role;
grant execute on function public.assert_org_access(uuid) to authenticated, service_role;

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

create unique index uq_organizations_slug_active
  on public.organizations (lower(slug))
  where deleted_at is null;

create index idx_profiles_org on public.profiles(org_id);
create index idx_profiles_role on public.profiles(role);
create index idx_profiles_active on public.profiles(org_id, is_active);
create index idx_profiles_created_at on public.profiles(created_at desc);

create unique index uq_tags_org_name_active
  on public.tags(org_id, lower(name))
  where deleted_at is null;
create index idx_tags_org on public.tags(org_id);
create index idx_tags_created_by on public.tags(created_by);
create index idx_tags_created_at on public.tags(org_id, created_at desc);

create unique index uq_customers_org_customer_code_active
  on public.customers(org_id, customer_code)
  where deleted_at is null and customer_code is not null;
create unique index uq_customers_org_phone_active
  on public.customers(org_id, phone)
  where deleted_at is null and phone is not null;
create index idx_customers_org on public.customers(org_id);
create index idx_customers_assigned_to on public.customers(assigned_to);
create index idx_customers_type on public.customers(org_id, customer_type);
create index idx_customers_created_at on public.customers(org_id, created_at desc);
create index idx_customers_last_order_at on public.customers(org_id, last_order_at desc);
create index idx_customers_full_name_trgm on public.customers using gin (lower(full_name) gin_trgm_ops);
create index idx_customers_phone_trgm on public.customers using gin (coalesce(phone, '') gin_trgm_ops);
create index idx_customers_email_trgm on public.customers using gin (coalesce(lower(email), '') gin_trgm_ops);
create index idx_customers_search_fts
  on public.customers
  using gin (
    to_tsvector(
      'simple',
      coalesce(customer_code, '') || ' ' ||
      coalesce(full_name, '') || ' ' ||
      coalesce(phone, '') || ' ' ||
      coalesce(email, '') || ' ' ||
      coalesce(address, '') || ' ' ||
      coalesce(province, '')
    )
  );

create unique index uq_customer_tags_active
  on public.customer_tags(org_id, customer_id, tag_id)
  where deleted_at is null;
create index idx_customer_tags_org on public.customer_tags(org_id);
create index idx_customer_tags_customer on public.customer_tags(customer_id);
create index idx_customer_tags_tag on public.customer_tags(tag_id);

create index idx_customer_notes_org on public.customer_notes(org_id);
create index idx_customer_notes_customer on public.customer_notes(customer_id);
create index idx_customer_notes_author on public.customer_notes(author_id);
create index idx_customer_notes_created_at on public.customer_notes(org_id, created_at desc);

create unique index uq_transactions_invoice_active
  on public.transactions(org_id, invoice_code)
  where deleted_at is null and invoice_code is not null;
create index idx_transactions_org on public.transactions(org_id);
create index idx_transactions_customer on public.transactions(customer_id);
create index idx_transactions_processed_by on public.transactions(processed_by);
create index idx_transactions_status on public.transactions(org_id, status);
create index idx_transactions_payment_status on public.transactions(org_id, payment_status);
create index idx_transactions_created_at on public.transactions(org_id, created_at desc);
create index idx_transactions_transaction_at on public.transactions(org_id, transaction_at desc);

create unique index uq_support_tickets_ticket_code_active
  on public.support_tickets(org_id, ticket_code)
  where deleted_at is null and ticket_code is not null;
create index idx_support_tickets_org on public.support_tickets(org_id);
create index idx_support_tickets_customer on public.support_tickets(customer_id);
create index idx_support_tickets_assigned on public.support_tickets(assigned_to);
create index idx_support_tickets_status on public.support_tickets(org_id, status);
create index idx_support_tickets_priority on public.support_tickets(org_id, priority);
create index idx_support_tickets_created_at on public.support_tickets(org_id, created_at desc);

create index idx_ticket_comments_org on public.ticket_comments(org_id);
create index idx_ticket_comments_ticket on public.ticket_comments(ticket_id);
create index idx_ticket_comments_author on public.ticket_comments(author_id);
create index idx_ticket_comments_created_at on public.ticket_comments(org_id, created_at desc);

create index idx_deals_org on public.deals(org_id);
create index idx_deals_customer on public.deals(customer_id);
create index idx_deals_stage on public.deals(org_id, stage);
create index idx_deals_assigned on public.deals(assigned_to);
create index idx_deals_created_at on public.deals(org_id, created_at desc);

create index idx_tasks_org on public.tasks(org_id);
create index idx_tasks_deal on public.tasks(deal_id);
create index idx_tasks_customer on public.tasks(customer_id);
create index idx_tasks_ticket on public.tasks(ticket_id);
create index idx_tasks_assigned on public.tasks(assigned_to);
create index idx_tasks_due on public.tasks(org_id, due_date);
create index idx_tasks_status on public.tasks(org_id, status);
create index idx_tasks_created_at on public.tasks(org_id, created_at desc);

create index idx_campaigns_org on public.campaigns(org_id);
create index idx_campaigns_status on public.campaigns(org_id, status);
create index idx_campaigns_created_by on public.campaigns(created_by);
create index idx_campaigns_created_at on public.campaigns(org_id, created_at desc);
create index idx_campaigns_scheduled_at on public.campaigns(org_id, scheduled_at);

create unique index uq_campaign_recipients_active
  on public.campaign_recipients(org_id, campaign_id, customer_id, channel)
  where deleted_at is null;
create index idx_campaign_recipients_org on public.campaign_recipients(org_id);
create index idx_campaign_recipients_campaign on public.campaign_recipients(campaign_id);
create index idx_campaign_recipients_customer on public.campaign_recipients(customer_id);
create index idx_campaign_recipients_status on public.campaign_recipients(org_id, status);

create index idx_automation_rules_org on public.automation_rules(org_id);
create index idx_automation_rules_trigger_type on public.automation_rules(org_id, trigger_type);
create index idx_automation_rules_is_active on public.automation_rules(org_id, is_active);
create index idx_automation_rules_next_run_at on public.automation_rules(org_id, next_run_at);

create index idx_outbound_messages_org on public.outbound_messages(org_id);
create index idx_outbound_messages_customer on public.outbound_messages(customer_id);
create index idx_outbound_messages_campaign on public.outbound_messages(campaign_id);
create index idx_outbound_messages_automation_rule on public.outbound_messages(automation_rule_id);
create index idx_outbound_messages_status on public.outbound_messages(org_id, status);
create index idx_outbound_messages_created_at on public.outbound_messages(org_id, created_at desc);

create index idx_app_settings_org on public.app_settings(org_id);
create index idx_file_attachments_org on public.file_attachments(org_id);
create index idx_file_attachments_entity on public.file_attachments(org_id, entity_type, entity_id);
create index idx_file_attachments_uploaded_by on public.file_attachments(uploaded_by);
create index idx_file_attachments_created_at on public.file_attachments(org_id, created_at desc);

create index idx_notifications_org on public.notifications(org_id);
create index idx_notifications_user on public.notifications(user_id);
create index idx_notifications_read on public.notifications(org_id, user_id, is_read);
create index idx_notifications_created_at on public.notifications(org_id, created_at desc);

create index idx_audit_logs_org on public.audit_logs(org_id);
create index idx_audit_logs_user on public.audit_logs(user_id);
create index idx_audit_logs_entity on public.audit_logs(org_id, entity_type, entity_id);
create index idx_audit_logs_created_at on public.audit_logs(org_id, created_at desc);
create index idx_audit_logs_action on public.audit_logs(org_id, action);

create index idx_pos_sync_logs_org on public.pos_sync_logs(org_id);
create index idx_pos_sync_logs_status on public.pos_sync_logs(org_id, status);
create index idx_pos_sync_logs_created_at on public.pos_sync_logs(org_id, created_at desc);

create sequence if not exists public.customer_code_seq;
create sequence if not exists public.ticket_code_seq;

create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_base_slug text;
  v_slug text;
  v_name text;
  v_role text;
  v_suffix integer := 0;
  v_allow_org_autocreate boolean := false;
  v_org_raw text;
begin
  if exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;

  v_org_raw := coalesce(new.raw_user_meta_data ->> 'org_id', '');
  if v_org_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_org_id := v_org_raw::uuid;
  else
    v_org_id := null;
  end if;

  v_allow_org_autocreate := lower(coalesce(new.raw_user_meta_data ->> 'allow_org_autocreate', 'false'))
    in ('1', 'true', 'yes');

  v_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'organization_name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    split_part(new.email, '@', 1)
  );

  if v_org_id is not null and not exists (
    select 1 from public.organizations where id = v_org_id and deleted_at is null
  ) then
    raise exception 'org_id % does not exist or is deleted', v_org_id;
  end if;

  if v_org_id is null then
    if not v_allow_org_autocreate then
      raise exception 'org_id is required in user metadata for member provisioning';
    end if;

    v_base_slug := nullif(public.slugify(v_name), '');
    if v_base_slug is null then
      v_base_slug := 'org';
    end if;

    v_slug := v_base_slug;
    while exists (
      select 1
      from public.organizations
      where lower(slug) = lower(v_slug)
        and deleted_at is null
    ) loop
      v_suffix := v_suffix + 1;
      v_slug := v_base_slug || '-' || v_suffix;
    end loop;

    insert into public.organizations (name, slug, plan)
    values (v_name, v_slug, 'free')
    returning id into v_org_id;

    insert into public.app_settings (org_id)
    values (v_org_id)
    on conflict (org_id) do nothing;
  end if;

  v_role := nullif(new.raw_user_meta_data ->> 'role', '');
  if v_role not in ('super_admin', 'admin', 'director', 'sales', 'cskh', 'marketing') then
    v_role := case when v_allow_org_autocreate then 'admin' else 'sales' end;
  end if;

  insert into public.profiles (id, org_id, full_name, role)
  values (
    new.id,
    v_org_id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    v_role
  )
  on conflict (id) do nothing;

  insert into public.app_settings (org_id)
  values (v_org_id)
  on conflict (org_id) do nothing;

  return new;
exception
  when others then
    raise exception 'handle_new_user failed: %', sqlerrm;
end;
$$;

create or replace function public.generate_customer_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.customer_code is null or btrim(new.customer_code) = '' then
    new.customer_code := format(
      'KH-%s-%s',
      to_char(coalesce(new.created_at, now()), 'YYYY'),
      lpad(nextval('public.customer_code_seq')::text, 4, '0')
    );
  end if;
  return new;
exception
  when others then
    raise exception 'generate_customer_code failed: %', sqlerrm;
end;
$$;

create or replace function public.generate_ticket_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.ticket_code is null or btrim(new.ticket_code) = '' then
    new.ticket_code := format(
      'TK-%s-%s',
      to_char(coalesce(new.created_at, now()), 'YYYY'),
      lpad(nextval('public.ticket_code_seq')::text, 4, '0')
    );
  end if;
  return new;
exception
  when others then
    raise exception 'generate_ticket_code failed: %', sqlerrm;
end;
$$;

create or replace function public.recalculate_customer_stats(p_org_id uuid, p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_org_id is null or p_customer_id is null then
    return;
  end if;

  update public.customers as c
  set
    total_spent = coalesce(stats.total_spent, 0),
    total_orders = coalesce(stats.total_orders, 0),
    last_order_at = stats.last_order_at,
    updated_at = now()
  from (
    select
      t.org_id,
      t.customer_id,
      sum(
        case
          when t.deleted_at is null
            and t.status not in ('cancelled', 'refunded')
            and t.payment_status not in ('cancelled', 'refunded')
          then t.total_amount
          else 0
        end
      ) as total_spent,
      count(*) filter (
        where t.deleted_at is null
          and t.status not in ('cancelled', 'refunded')
          and t.payment_status not in ('cancelled', 'refunded')
      ) as total_orders,
      max(t.transaction_at) filter (
        where t.deleted_at is null
          and t.status not in ('cancelled', 'refunded')
          and t.payment_status not in ('cancelled', 'refunded')
      ) as last_order_at
    from public.transactions as t
    where t.org_id = p_org_id
      and t.customer_id = p_customer_id
    group by t.org_id, t.customer_id
  ) as stats
  where c.org_id = p_org_id
    and c.id = p_customer_id
    and c.org_id = stats.org_id
    and c.id = stats.customer_id;

  update public.customers
  set
    total_spent = 0,
    total_orders = 0,
    last_order_at = null,
    updated_at = now()
  where org_id = p_org_id
    and id = p_customer_id
    and not exists (
      select 1
      from public.transactions
      where org_id = p_org_id
        and customer_id = p_customer_id
        and deleted_at is null
        and status not in ('cancelled', 'refunded')
        and payment_status not in ('cancelled', 'refunded')
    );
end;
$$;

create or replace function public.update_customer_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_customer_stats(old.org_id, old.customer_id);
    return old;
  end if;

  perform public.recalculate_customer_stats(new.org_id, new.customer_id);

  if tg_op = 'UPDATE'
     and old.customer_id is distinct from new.customer_id then
    perform public.recalculate_customer_stats(old.org_id, old.customer_id);
  end if;

  return new;
exception
  when others then
    raise exception 'update_customer_stats failed: %', sqlerrm;
end;
$$;

create or replace function public.log_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_org_id uuid;
  v_user_id uuid;
  v_entity_id uuid;
  v_entity_name text;
  v_action_prefix text;
begin
  v_old := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_new := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;

  if tg_op = 'UPDATE' and v_old = v_new then
    return new;
  end if;

  v_org_id := coalesce((v_new ->> 'org_id')::uuid, (v_old ->> 'org_id')::uuid);
  v_entity_id := coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid);
  v_user_id := coalesce(
    auth.uid(),
    case when v_new ? 'updated_by' and nullif(v_new ->> 'updated_by', '') is not null then (v_new ->> 'updated_by')::uuid end,
    case when v_new ? 'created_by' and nullif(v_new ->> 'created_by', '') is not null then (v_new ->> 'created_by')::uuid end,
    case when v_old ? 'updated_by' and nullif(v_old ->> 'updated_by', '') is not null then (v_old ->> 'updated_by')::uuid end,
    case when v_old ? 'created_by' and nullif(v_old ->> 'created_by', '') is not null then (v_old ->> 'created_by')::uuid end
  );

  v_entity_name := case tg_table_name
    when 'customers' then 'CUSTOMER'
    when 'transactions' then 'TRANSACTION'
    when 'support_tickets' then 'TICKET'
    when 'deals' then 'DEAL'
    else upper(tg_table_name)
  end;

  v_action_prefix := case tg_op
    when 'INSERT' then 'CREATE'
    when 'UPDATE' then 'UPDATE'
    when 'DELETE' then 'DELETE'
    else upper(tg_op)
  end;

  insert into public.audit_logs (
    org_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    metadata
  )
  values (
    v_org_id,
    v_user_id,
    v_action_prefix || '_' || v_entity_name,
    tg_table_name,
    v_entity_id,
    v_old,
    v_new,
    jsonb_build_object('table', tg_table_name, 'operation', tg_op)
  );

  return coalesce(new, old);
exception
  when others then
    raise exception 'log_audit failed: %', sqlerrm;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists trg_generate_customer_code on public.customers;
create trigger trg_generate_customer_code
  before insert on public.customers
  for each row execute function public.generate_customer_code();

drop trigger if exists trg_generate_ticket_code on public.support_tickets;
create trigger trg_generate_ticket_code
  before insert on public.support_tickets
  for each row execute function public.generate_ticket_code();

drop trigger if exists trg_update_customer_stats on public.transactions;
create trigger trg_update_customer_stats
  after insert or update or delete on public.transactions
  for each row execute function public.update_customer_stats();

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'organizations',
    'profiles',
    'tags',
    'customers',
    'customer_tags',
    'customer_notes',
    'transactions',
    'support_tickets',
    'ticket_comments',
    'deals',
    'tasks',
    'campaigns',
    'campaign_recipients',
    'automation_rules',
    'outbound_messages',
    'app_settings',
    'file_attachments',
    'notifications',
    'audit_logs',
    'pos_sync_logs'
  ]
  loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', v_table, v_table);
    execute format(
      'create trigger trg_%s_updated_at before update on public.%I for each row execute function public.update_updated_at()',
      v_table,
      v_table
    );
  end loop;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['customers', 'transactions', 'support_tickets', 'deals']
  loop
    execute format('drop trigger if exists trg_%s_audit on public.%I', v_table, v_table);
    execute format(
      'create trigger trg_%s_audit after insert or update or delete on public.%I for each row execute function public.log_audit()',
      v_table,
      v_table
    );
  end loop;
end;
$$;

create or replace function public.get_dashboard_stats(
  p_org_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  total_customers bigint,
  new_customers bigint,
  total_revenue numeric,
  total_orders bigint,
  open_tickets bigint,
  resolved_tickets bigint,
  avg_ticket_time_hrs numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_org_access(p_org_id);

  p_from := coalesce(p_from, date_trunc('month', now()));
  p_to := coalesce(p_to, now());

  if p_from > p_to then
    raise exception 'p_from must be <= p_to';
  end if;

  return query
  with customer_metrics as (
    select
      count(*) filter (where c.deleted_at is null) as total_customers,
      count(*) filter (
        where c.deleted_at is null
          and c.created_at between p_from and p_to
      ) as new_customers
    from public.customers as c
    where c.org_id = p_org_id
  ),
  transaction_metrics as (
    select
      coalesce(sum(t.total_amount), 0) as total_revenue,
      count(*) as total_orders
    from public.transactions as t
    where t.org_id = p_org_id
      and t.deleted_at is null
      and t.transaction_at between p_from and p_to
      and t.status not in ('cancelled', 'refunded')
      and t.payment_status not in ('cancelled', 'refunded')
  ),
  ticket_metrics as (
    select
      count(*) filter (
        where st.deleted_at is null
          and st.status in ('open', 'in_progress', 'pending')
      ) as open_tickets,
      count(*) filter (
        where st.deleted_at is null
          and st.status in ('resolved', 'closed')
          and coalesce(st.resolved_at, st.closed_at, st.updated_at) between p_from and p_to
      ) as resolved_tickets,
      round(
        avg(
          extract(epoch from (coalesce(st.resolved_at, st.closed_at) - st.created_at)) / 3600.0
        ) filter (
          where st.deleted_at is null
            and coalesce(st.resolved_at, st.closed_at) is not null
            and coalesce(st.resolved_at, st.closed_at) between p_from and p_to
        )::numeric,
        2
      ) as avg_ticket_time_hrs
    from public.support_tickets as st
    where st.org_id = p_org_id
  )
  select
    cm.total_customers,
    cm.new_customers,
    tm.total_revenue,
    tm.total_orders,
    tk.open_tickets,
    tk.resolved_tickets,
    coalesce(tk.avg_ticket_time_hrs, 0)
  from customer_metrics as cm
  cross join transaction_metrics as tm
  cross join ticket_metrics as tk;
end;
$$;

create or replace function public.get_revenue_chart(
  p_org_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_group_by text default 'day'
)
returns table (
  bucket timestamptz,
  revenue numeric,
  orders_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_org_access(p_org_id);

  p_from := coalesce(p_from, date_trunc('month', now()));
  p_to := coalesce(p_to, now());
  p_group_by := lower(coalesce(p_group_by, 'day'));

  if p_group_by not in ('day', 'week', 'month') then
    raise exception 'p_group_by must be day, week, or month';
  end if;

  if p_from > p_to then
    raise exception 'p_from must be <= p_to';
  end if;

  return query
  select
    date_trunc(p_group_by, t.transaction_at) as bucket,
    coalesce(sum(t.total_amount), 0) as revenue,
    count(*) as orders_count
  from public.transactions as t
  where t.org_id = p_org_id
    and t.deleted_at is null
    and t.transaction_at between p_from and p_to
    and t.status not in ('cancelled', 'refunded')
    and t.payment_status not in ('cancelled', 'refunded')
  group by 1
  order by 1;
end;
$$;

create or replace function public.get_top_customers(
  p_org_id uuid,
  p_limit integer default 10
)
returns table (
  id uuid,
  customer_code text,
  full_name text,
  phone text,
  total_spent numeric,
  total_orders integer,
  last_order_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_org_access(p_org_id);

  if coalesce(p_limit, 0) <= 0 or p_limit > 100 then
    raise exception 'p_limit must be between 1 and 100';
  end if;

  return query
  select
    c.id,
    c.customer_code,
    c.full_name,
    c.phone,
    c.total_spent,
    c.total_orders,
    c.last_order_at
  from public.customers as c
  where c.org_id = p_org_id
    and c.deleted_at is null
  order by c.total_spent desc, c.total_orders desc, c.created_at asc
  limit p_limit;
end;
$$;

create or replace function public.get_pipeline_summary(
  p_org_id uuid
)
returns table (
  stage text,
  deal_count bigint,
  total_value numeric,
  weighted_value numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_org_access(p_org_id);

  return query
  select
    d.stage,
    count(*) as deal_count,
    coalesce(sum(d.value), 0) as total_value,
    coalesce(sum(d.value * (d.probability / 100.0)), 0) as weighted_value
  from public.deals as d
  where d.org_id = p_org_id
    and d.deleted_at is null
  group by d.stage
  order by case d.stage
    when 'lead' then 1
    when 'qualified' then 2
    when 'proposal' then 3
    when 'negotiation' then 4
    when 'won' then 5
    when 'lost' then 6
    else 999
  end;
end;
$$;

create or replace function public.get_customer_segments(
  p_org_id uuid
)
returns table (
  customer_type text,
  customer_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_org_access(p_org_id);

  return query
  with seed(customer_type) as (
    values ('new'), ('potential'), ('loyal'), ('vip'), ('inactive')
  )
  select
    s.customer_type,
    coalesce(count(c.id), 0) as customer_count
  from seed as s
  left join public.customers as c
    on c.org_id = p_org_id
   and c.deleted_at is null
   and c.customer_type = s.customer_type
  group by s.customer_type
  order by case s.customer_type
    when 'new' then 1
    when 'potential' then 2
    when 'loyal' then 3
    when 'vip' then 4
    when 'inactive' then 5
    else 999
  end;
end;
$$;

create or replace function public.search_customers_fts(
  p_org_id uuid,
  p_query text
)
returns table (
  id uuid,
  customer_code text,
  full_name text,
  phone text,
  email text,
  customer_type text,
  assigned_to uuid,
  rank real
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query text;
  v_tsquery tsquery;
begin
  perform public.assert_org_access(p_org_id);

  v_query := btrim(coalesce(p_query, ''));
  if v_query = '' then
    raise exception 'p_query is required';
  end if;

  v_tsquery := plainto_tsquery('simple', v_query);

  return query
  select
    c.id,
    c.customer_code,
    c.full_name,
    c.phone,
    c.email,
    c.customer_type,
    c.assigned_to,
    greatest(
      ts_rank(
        to_tsvector(
          'simple',
          coalesce(c.customer_code, '') || ' ' ||
          coalesce(c.full_name, '') || ' ' ||
          coalesce(c.phone, '') || ' ' ||
          coalesce(c.email, '') || ' ' ||
          coalesce(c.address, '') || ' ' ||
          coalesce(c.province, '')
        ),
        v_tsquery
      ),
      0
    ) as rank
  from public.customers as c
  where c.org_id = p_org_id
    and c.deleted_at is null
    and (
      to_tsvector(
        'simple',
        coalesce(c.customer_code, '') || ' ' ||
        coalesce(c.full_name, '') || ' ' ||
        coalesce(c.phone, '') || ' ' ||
        coalesce(c.email, '') || ' ' ||
        coalesce(c.address, '') || ' ' ||
        coalesce(c.province, '')
      ) @@ v_tsquery
      or lower(c.full_name) like '%' || lower(v_query) || '%'
      or coalesce(c.phone, '') like '%' || v_query || '%'
      or lower(coalesce(c.email, '')) like '%' || lower(v_query) || '%'
    )
  order by rank desc, c.total_spent desc, c.created_at desc
  limit 50;
end;
$$;

grant execute on function public.get_dashboard_stats(uuid, timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.get_revenue_chart(uuid, timestamptz, timestamptz, text) to authenticated, service_role;
grant execute on function public.get_top_customers(uuid, integer) to authenticated, service_role;
grant execute on function public.get_pipeline_summary(uuid) to authenticated, service_role;
grant execute on function public.get_customer_segments(uuid) to authenticated, service_role;
grant execute on function public.search_customers_fts(uuid, text) to authenticated, service_role;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'organizations',
    'profiles',
    'tags',
    'customers',
    'customer_tags',
    'customer_notes',
    'transactions',
    'support_tickets',
    'ticket_comments',
    'deals',
    'tasks',
    'campaigns',
    'campaign_recipients',
    'automation_rules',
    'outbound_messages',
    'app_settings',
    'file_attachments',
    'notifications',
    'audit_logs',
    'pos_sync_logs'
  ]
  loop
    execute format('alter table public.%I enable row level security', v_table);
  end loop;
end;
$$;

create policy organizations_select on public.organizations
  for select to authenticated
  using (id = public.get_user_org() or public.get_user_role() = 'super_admin');

create policy organizations_insert on public.organizations
  for insert to authenticated
  with check (false);

create policy organizations_update on public.organizations
  for update to authenticated
  using (
    public.get_user_role() = 'super_admin'
    or (id = public.get_user_org() and public.get_user_role() = 'admin')
  )
  with check (
    public.get_user_role() = 'super_admin'
    or (id = public.get_user_org() and public.get_user_role() = 'admin')
  );

create policy organizations_delete on public.organizations
  for delete to authenticated
  using (false);

create policy profiles_select on public.profiles
  for select to authenticated
  using (public.has_org_access(org_id));

create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin'])
  );

create policy profiles_update on public.profiles
  for update to authenticated
  using (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin'])
  )
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin'])
  );

create policy profiles_delete on public.profiles
  for delete to authenticated
  using (false);

create policy tags_select on public.tags
  for select to authenticated
  using (public.has_org_access(org_id) and deleted_at is null);

create policy tags_insert on public.tags
  for insert to authenticated
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'sales', 'cskh', 'marketing'])
  );

create policy tags_update on public.tags
  for update to authenticated
  using (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'sales', 'cskh', 'marketing'])
  )
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'sales', 'cskh', 'marketing'])
  );

create policy tags_delete on public.tags
  for delete to authenticated
  using (false);

create policy customers_select on public.customers
  for select to authenticated
  using (public.has_org_access(org_id) and deleted_at is null);

create policy customers_insert on public.customers
  for insert to authenticated
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'sales'])
  );

create policy customers_update on public.customers
  for update to authenticated
  using (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'sales'])
  )
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'sales'])
  );

create policy customers_delete on public.customers
  for delete to authenticated
  using (false);

create policy customer_tags_select on public.customer_tags
  for select to authenticated
  using (public.has_org_access(org_id) and deleted_at is null);

create policy customer_tags_insert on public.customer_tags
  for insert to authenticated
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'sales', 'marketing'])
  );

create policy customer_tags_update on public.customer_tags
  for update to authenticated
  using (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'sales', 'marketing'])
  )
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'sales', 'marketing'])
  );

create policy customer_tags_delete on public.customer_tags
  for delete to authenticated
  using (false);

create policy customer_notes_select on public.customer_notes
  for select to authenticated
  using (public.has_org_access(org_id) and deleted_at is null);

create policy customer_notes_insert on public.customer_notes
  for insert to authenticated
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'sales', 'cskh'])
    and author_id = auth.uid()
  );

create policy customer_notes_update on public.customer_notes
  for update to authenticated
  using (
    public.has_org_access(org_id)
    and (
      author_id = auth.uid()
      or public.has_any_role(array['super_admin', 'admin'])
    )
  )
  with check (
    public.has_org_access(org_id)
    and (
      author_id = auth.uid()
      or public.has_any_role(array['super_admin', 'admin'])
    )
  );

create policy customer_notes_delete on public.customer_notes
  for delete to authenticated
  using (false);

create policy transactions_select on public.transactions
  for select to authenticated
  using (
    public.has_org_access(org_id)
    and deleted_at is null
    and public.has_any_role(array['super_admin', 'admin', 'director', 'sales', 'cskh'])
  );

create policy transactions_insert on public.transactions
  for insert to authenticated
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'sales'])
  );

create policy transactions_update on public.transactions
  for update to authenticated
  using (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'sales'])
  )
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'sales'])
  );

create policy transactions_delete on public.transactions
  for delete to authenticated
  using (false);

create policy support_tickets_select on public.support_tickets
  for select to authenticated
  using (
    public.has_org_access(org_id)
    and deleted_at is null
    and public.has_any_role(array['super_admin', 'admin', 'director', 'sales', 'cskh'])
  );

create policy support_tickets_insert on public.support_tickets
  for insert to authenticated
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'sales', 'cskh'])
  );

create policy support_tickets_update on public.support_tickets
  for update to authenticated
  using (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'cskh'])
  )
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'cskh'])
  );

create policy support_tickets_delete on public.support_tickets
  for delete to authenticated
  using (false);

create policy ticket_comments_select on public.ticket_comments
  for select to authenticated
  using (
    public.has_org_access(org_id)
    and deleted_at is null
    and public.has_any_role(array['super_admin', 'admin', 'director', 'sales', 'cskh'])
  );

create policy ticket_comments_insert on public.ticket_comments
  for insert to authenticated
  with check (
    public.has_org_access(org_id)
    and author_id = auth.uid()
    and public.has_any_role(array['super_admin', 'admin', 'sales', 'cskh'])
  );

create policy ticket_comments_update on public.ticket_comments
  for update to authenticated
  using (
    public.has_org_access(org_id)
    and (
      author_id = auth.uid()
      or public.has_any_role(array['super_admin', 'admin'])
    )
  )
  with check (
    public.has_org_access(org_id)
    and (
      author_id = auth.uid()
      or public.has_any_role(array['super_admin', 'admin'])
    )
  );

create policy ticket_comments_delete on public.ticket_comments
  for delete to authenticated
  using (false);

create policy deals_select on public.deals
  for select to authenticated
  using (
    public.has_org_access(org_id)
    and deleted_at is null
    and (
      public.has_any_role(array['super_admin', 'admin', 'director'])
      or (public.get_user_role() = 'sales' and assigned_to = auth.uid())
    )
  );

create policy deals_insert on public.deals
  for insert to authenticated
  with check (
    public.has_org_access(org_id)
    and (
      public.has_any_role(array['super_admin', 'admin'])
      or (
        public.get_user_role() = 'sales'
        and coalesce(assigned_to, auth.uid()) = auth.uid()
      )
    )
  );

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

create policy deals_delete on public.deals
  for delete to authenticated
  using (false);

create policy tasks_select on public.tasks
  for select to authenticated
  using (
    public.has_org_access(org_id)
    and deleted_at is null
    and (
      public.has_any_role(array['super_admin', 'admin', 'director'])
      or (
        public.has_any_role(array['sales', 'cskh'])
        and assigned_to = auth.uid()
      )
    )
  );

create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (
    public.has_org_access(org_id)
    and (
      public.has_any_role(array['super_admin', 'admin'])
      or (
        public.has_any_role(array['sales', 'cskh'])
        and coalesce(assigned_to, auth.uid()) = auth.uid()
      )
    )
  );

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

create policy tasks_delete on public.tasks
  for delete to authenticated
  using (false);

create policy campaigns_select on public.campaigns
  for select to authenticated
  using (
    public.has_org_access(org_id)
    and deleted_at is null
    and public.has_any_role(array['super_admin', 'admin', 'director', 'marketing'])
  );

create policy campaigns_insert on public.campaigns
  for insert to authenticated
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'marketing'])
  );

create policy campaigns_update on public.campaigns
  for update to authenticated
  using (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'marketing'])
  )
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'marketing'])
  );

create policy campaigns_delete on public.campaigns
  for delete to authenticated
  using (false);

create policy campaign_recipients_select on public.campaign_recipients
  for select to authenticated
  using (
    public.has_org_access(org_id)
    and deleted_at is null
    and public.has_any_role(array['super_admin', 'admin', 'director', 'marketing'])
  );

create policy campaign_recipients_insert on public.campaign_recipients
  for insert to authenticated
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'marketing'])
  );

create policy campaign_recipients_update on public.campaign_recipients
  for update to authenticated
  using (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'marketing'])
  )
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'marketing'])
  );

create policy campaign_recipients_delete on public.campaign_recipients
  for delete to authenticated
  using (false);

create policy automation_rules_select on public.automation_rules
  for select to authenticated
  using (
    public.has_org_access(org_id)
    and deleted_at is null
    and public.has_any_role(array['super_admin', 'admin', 'director', 'cskh', 'marketing'])
  );

create policy automation_rules_insert on public.automation_rules
  for insert to authenticated
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'marketing'])
  );

create policy automation_rules_update on public.automation_rules
  for update to authenticated
  using (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'marketing'])
  )
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'marketing'])
  );

create policy automation_rules_delete on public.automation_rules
  for delete to authenticated
  using (false);

create policy outbound_messages_select on public.outbound_messages
  for select to authenticated
  using (public.has_org_access(org_id) and deleted_at is null);

create policy outbound_messages_insert on public.outbound_messages
  for insert to authenticated
  with check (false);

create policy outbound_messages_update on public.outbound_messages
  for update to authenticated
  using (false)
  with check (false);

create policy outbound_messages_delete on public.outbound_messages
  for delete to authenticated
  using (false);

create policy app_settings_select on public.app_settings
  for select to authenticated
  using (public.has_org_access(org_id) and deleted_at is null);

create policy app_settings_insert on public.app_settings
  for insert to authenticated
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin'])
  );

create policy app_settings_update on public.app_settings
  for update to authenticated
  using (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin'])
  )
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin'])
  );

create policy app_settings_delete on public.app_settings
  for delete to authenticated
  using (false);

create policy file_attachments_select on public.file_attachments
  for select to authenticated
  using (public.has_org_access(org_id) and deleted_at is null);

create policy file_attachments_insert on public.file_attachments
  for insert to authenticated
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'director', 'sales', 'cskh', 'marketing'])
  );

create policy file_attachments_update on public.file_attachments
  for update to authenticated
  using (
    public.has_org_access(org_id)
    and (
      uploaded_by = auth.uid()
      or public.has_any_role(array['super_admin', 'admin'])
    )
  )
  with check (
    public.has_org_access(org_id)
    and (
      uploaded_by = auth.uid()
      or public.has_any_role(array['super_admin', 'admin'])
    )
  );

create policy file_attachments_delete on public.file_attachments
  for delete to authenticated
  using (false);

create policy notifications_select on public.notifications
  for select to authenticated
  using (
    public.has_org_access(org_id)
    and deleted_at is null
    and (
      user_id = auth.uid()
      or public.has_any_role(array['super_admin', 'admin'])
    )
  );

create policy notifications_insert on public.notifications
  for insert to authenticated
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin'])
  );

create policy notifications_update on public.notifications
  for update to authenticated
  using (
    public.has_org_access(org_id)
    and (
      user_id = auth.uid()
      or public.has_any_role(array['super_admin', 'admin'])
    )
  )
  with check (
    public.has_org_access(org_id)
    and (
      user_id = auth.uid()
      or public.has_any_role(array['super_admin', 'admin'])
    )
  );

create policy notifications_delete on public.notifications
  for delete to authenticated
  using (false);

create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (
    public.has_org_access(org_id)
    and deleted_at is null
    and public.has_any_role(array['super_admin', 'admin', 'director'])
  );

create policy audit_logs_insert on public.audit_logs
  for insert to authenticated
  with check (false);

create policy audit_logs_update on public.audit_logs
  for update to authenticated
  using (false)
  with check (false);

create policy audit_logs_delete on public.audit_logs
  for delete to authenticated
  using (false);

create policy pos_sync_logs_select on public.pos_sync_logs
  for select to authenticated
  using (
    public.has_org_access(org_id)
    and deleted_at is null
    and public.has_any_role(array['super_admin', 'admin', 'director'])
  );

create policy pos_sync_logs_insert on public.pos_sync_logs
  for insert to authenticated
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin'])
  );

create policy pos_sync_logs_update on public.pos_sync_logs
  for update to authenticated
  using (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin'])
  )
  with check (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin'])
  );

create policy pos_sync_logs_delete on public.pos_sync_logs
  for delete to authenticated
  using (false);

commit;

-- Canonical compatibility + hardening layer (single source of truth)
begin;

-- 1) Profiles contract alignment cho frontend + edge functions.
alter table if exists public.profiles
  add column if not exists email text;

alter table if exists public.profiles
  add column if not exists department text;

alter table if exists public.profiles
  alter column department set default 'Chưa phân bổ';

update public.profiles as p
set
  email = lower(u.email),
  department = coalesce(
    nullif(btrim(p.department), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'department'), ''),
    'Chưa phân bổ'
  ),
  full_name = coalesce(
    nullif(btrim(p.full_name), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(lower(u.email), '@', 1), ''),
    'user-' || left(u.id::text, 8)
  ),
  updated_at = now()
from auth.users as u
where u.id = p.id
  and (
    p.email is distinct from lower(u.email)
    or coalesce(btrim(p.department), '') = ''
    or coalesce(btrim(p.full_name), '') = ''
  );

create unique index if not exists idx_profiles_email_unique
  on public.profiles (lower(email))
  where email is not null and deleted_at is null;

-- 2) Ensure default org + app_settings tồn tại và backfill profile cho user hiện có.
do $$
declare
  v_default_org_id uuid;
begin
  select id
  into v_default_org_id
  from public.organizations
  where slug = 'nexcrm-default'
    and deleted_at is null
  order by created_at asc nulls last
  limit 1;

  if v_default_org_id is null then
    insert into public.organizations (name, slug, plan)
    values ('NexCRM Default', 'nexcrm-default', 'free')
    returning id into v_default_org_id;
  end if;

  insert into public.app_settings (org_id)
  values (v_default_org_id)
  on conflict (org_id) do nothing;

  insert into public.profiles (
    id,
    org_id,
    email,
    full_name,
    role,
    department,
    is_active,
    created_at,
    updated_at
  )
  select
    u.id,
    coalesce(
      case
        when coalesce(u.raw_user_meta_data ->> 'org_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          and exists (
            select 1
            from public.organizations as o
            where o.id = (u.raw_user_meta_data ->> 'org_id')::uuid
              and o.deleted_at is null
          )
        then (u.raw_user_meta_data ->> 'org_id')::uuid
        else null
      end,
      v_default_org_id
    ) as org_id,
    lower(u.email),
    coalesce(
      nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(lower(u.email), '@', 1), ''),
      'user-' || left(u.id::text, 8)
    ) as full_name,
    case
      when lower(coalesce(u.raw_user_meta_data ->> 'role', '')) in ('super_admin', 'admin', 'director', 'sales', 'cskh', 'marketing')
        then lower(u.raw_user_meta_data ->> 'role')
      else 'sales'
    end as role,
    coalesce(
      nullif(btrim(u.raw_user_meta_data ->> 'department'), ''),
      'Chưa phân bổ'
    ) as department,
    true,
    now(),
    now()
  from auth.users as u
  left join public.profiles as p on p.id = u.id
  where p.id is null;
end
$$;

-- 3) Unified onboarding: metadata optional, fallback to default org.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_default_org_id uuid;
  v_org_raw text;
  v_role text;
  v_department text;
begin
  if exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;

  select id
  into v_default_org_id
  from public.organizations
  where slug = 'nexcrm-default'
    and deleted_at is null
  order by created_at asc nulls last
  limit 1;

  if v_default_org_id is null then
    insert into public.organizations (name, slug, plan)
    values ('NexCRM Default', 'nexcrm-default', 'free')
    returning id into v_default_org_id;
  end if;

  insert into public.app_settings (org_id)
  values (v_default_org_id)
  on conflict (org_id) do nothing;

  v_org_raw := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'org_id', '')), '');
  if v_org_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_org_id := v_org_raw::uuid;
  else
    v_org_id := null;
  end if;

  if v_org_id is not null and not exists (
    select 1
    from public.organizations
    where id = v_org_id
      and deleted_at is null
  ) then
    v_org_id := null;
  end if;

  v_org_id := coalesce(v_org_id, v_default_org_id);

  v_role := lower(coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'sales'));
  if v_role not in ('super_admin', 'admin', 'director', 'sales', 'cskh', 'marketing') then
    v_role := 'sales';
  end if;

  v_department := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'department'), ''),
    'Chưa phân bổ'
  );

  insert into public.profiles (id, org_id, email, full_name, role, department, is_active)
  values (
    new.id,
    v_org_id,
    lower(new.email),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    v_role,
    v_department,
    true
  )
  on conflict (id) do update
  set
    email = excluded.email,
    department = coalesce(nullif(btrim(public.profiles.department), ''), excluded.department),
    updated_at = now();

  insert into public.app_settings (org_id)
  values (v_org_id)
  on conflict (org_id) do nothing;

  return new;
exception
  when others then
    raise exception 'handle_new_user failed: %', sqlerrm;
end;
$$;

-- 4) Sync profile khi auth.users thay đổi email/metadata.
create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default_org_id uuid;
  v_org_id uuid;
  v_role text;
  v_department text;
  v_full_name text;
begin
  select id
  into v_default_org_id
  from public.organizations
  where slug = 'nexcrm-default'
    and deleted_at is null
  order by created_at asc nulls last
  limit 1;

  if v_default_org_id is null then
    insert into public.organizations (name, slug, plan)
    values ('NexCRM Default', 'nexcrm-default', 'free')
    returning id into v_default_org_id;
  end if;

  if coalesce(new.raw_user_meta_data ->> 'org_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     and exists (
       select 1
       from public.organizations as o
       where o.id = (new.raw_user_meta_data ->> 'org_id')::uuid
         and o.deleted_at is null
     ) then
    v_org_id := (new.raw_user_meta_data ->> 'org_id')::uuid;
  else
    v_org_id := v_default_org_id;
  end if;

  v_role := lower(coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'sales'));
  if v_role not in ('super_admin', 'admin', 'director', 'sales', 'cskh', 'marketing') then
    v_role := 'sales';
  end if;

  v_department := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'department'), ''),
    'Chưa phân bổ'
  );

  v_full_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(lower(new.email), '@', 1), ''),
    'user-' || left(new.id::text, 8)
  );

  insert into public.profiles (
    id,
    org_id,
    email,
    full_name,
    role,
    department,
    is_active,
    created_at,
    updated_at
  )
  values (
    new.id,
    v_org_id,
    lower(new.email),
    v_full_name,
    v_role,
    v_department,
    true,
    now(),
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    org_id = coalesce(public.profiles.org_id, excluded.org_id),
    full_name = coalesce(nullif(btrim(public.profiles.full_name), ''), excluded.full_name),
    role = coalesce(nullif(btrim(public.profiles.role), ''), excluded.role),
    department = coalesce(nullif(btrim(public.profiles.department), ''), excluded.department),
    updated_at = now();

  insert into public.app_settings (org_id)
  values (v_org_id)
  on conflict (org_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_auth_users_sync_profile on auth.users;
create trigger trg_auth_users_sync_profile
after insert or update of email, raw_user_meta_data
on auth.users
for each row
execute function public.sync_profile_from_auth_user();

-- 5) Compatibility view cho profile fallback path.
drop view if exists public.profiles_directory;
create view public.profiles_directory as
select
  p.id,
  p.org_id,
  p.email,
  p.full_name,
  p.role,
  p.department,
  p.avatar_url,
  p.is_active,
  p.created_at,
  p.updated_at
from public.profiles as p
where p.deleted_at is null
  and coalesce(p.is_active, true) = true;

grant select on public.profiles_directory to authenticated, service_role;

-- 6) Campaign status + rate-limit RPC.
alter table public.campaigns
  drop constraint if exists campaigns_status_check;

alter table public.campaigns
  add constraint campaigns_status_check
  check (status in ('draft', 'scheduled', 'sending', 'sent', 'sent_with_errors', 'cancelled'));

create table if not exists public.campaign_send_rate_limits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  action text not null default 'send_campaign',
  actor_id uuid,
  window_start timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_campaign_send_rate_limits_window unique (org_id, action, window_start),
  constraint fk_campaign_send_rate_limits_actor
    foreign key (org_id, actor_id)
    references public.profiles(org_id, id)
    on delete set null
);

create index if not exists idx_campaign_send_rate_limits_org_created_at
  on public.campaign_send_rate_limits(org_id, created_at desc);

create or replace function public.acquire_campaign_send_rate_limit(
  p_org_id uuid,
  p_actor_id uuid default null,
  p_action text default 'send_campaign'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_window_start timestamptz;
begin
  if p_org_id is null then
    raise exception 'org_id is required for campaign rate limit';
  end if;

  v_action := coalesce(nullif(btrim(p_action), ''), 'send_campaign');
  v_window_start := date_trunc('minute', now());

  perform pg_advisory_xact_lock(
    hashtextextended(p_org_id::text || ':' || v_action || ':' || v_window_start::text, 0)
  );

  insert into public.campaign_send_rate_limits(org_id, action, actor_id, window_start)
  values (p_org_id, v_action, p_actor_id, v_window_start)
  on conflict (org_id, action, window_start) do nothing;

  return found;
end;
$$;

grant execute on function public.acquire_campaign_send_rate_limit(uuid, uuid, text) to authenticated;
grant execute on function public.acquire_campaign_send_rate_limit(uuid, uuid, text) to service_role;

alter table public.campaign_send_rate_limits enable row level security;

drop policy if exists campaign_send_rate_limits_select on public.campaign_send_rate_limits;
drop policy if exists campaign_send_rate_limits_insert on public.campaign_send_rate_limits;
drop policy if exists campaign_send_rate_limits_update on public.campaign_send_rate_limits;
drop policy if exists campaign_send_rate_limits_delete on public.campaign_send_rate_limits;

create policy campaign_send_rate_limits_select on public.campaign_send_rate_limits
  for select to authenticated
  using (
    public.has_org_access(org_id)
    and public.has_any_role(array['super_admin', 'admin', 'director'])
  );

create policy campaign_send_rate_limits_insert on public.campaign_send_rate_limits
  for insert to authenticated
  with check (false);

create policy campaign_send_rate_limits_update on public.campaign_send_rate_limits
  for update to authenticated
  using (false)
  with check (false);

create policy campaign_send_rate_limits_delete on public.campaign_send_rate_limits
  for delete to authenticated
  using (false);

-- 7) Compatibility RPC cho login identifier.
create or replace function public.resolve_login_identifier(input_identifier text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized text := lower(btrim(input_identifier));
  resolved_email text;
  alias_count int;
begin
  if normalized is null or normalized = '' then
    return null;
  end if;

  if position('@' in normalized) > 0 then
    select lower(email)
    into resolved_email
    from auth.users
    where lower(email) = normalized
    limit 1;

    return resolved_email;
  end if;

  select count(*), min(lower(email))
  into alias_count, resolved_email
  from auth.users
  where split_part(lower(email), '@', 1) = normalized;

  if alias_count = 1 then
    return resolved_email;
  end if;

  return null;
end;
$$;

grant execute on function public.resolve_login_identifier(text) to anon, authenticated;

-- 8) Compatibility RPC cho dashboardService legacy path.
create or replace function public.get_dashboard_snapshot(p_range text default '7days')
returns table (
  total_customers bigint,
  new_customers_month bigint,
  total_revenue_month numeric,
  total_orders_month bigint,
  open_tickets bigint,
  resolved_tickets_month bigint,
  revenue_chart jsonb,
  customer_type_distribution jsonb,
  top_customers jsonb,
  urgent_tickets jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_range_start timestamptz;
  v_month_start timestamptz;
begin
  v_org_id := public.get_user_org();

  if v_org_id is null then
    raise exception 'Không xác định được tổ chức cho người dùng hiện tại.';
  end if;

  v_range_start := case
    when p_range = 'today' then date_trunc('day', now())
    when p_range = '30days' then date_trunc('day', now()) - interval '29 days'
    else date_trunc('day', now()) - interval '6 days'
  end;

  v_month_start := date_trunc('month', now());

  return query
  with customer_base as (
    select
      c.id,
      c.full_name,
      coalesce(c.customer_code, '') as customer_code,
      coalesce(c.customer_type, 'new') as customer_type,
      coalesce(c.total_spent, 0) as total_spent,
      c.created_at
    from public.customers as c
    where c.org_id = v_org_id
      and c.deleted_at is null
  ),
  ticket_base as (
    select
      t.id,
      t.title,
      coalesce(t.priority, 'medium') as priority,
      t.customer_id,
      coalesce(t.status, 'open') as status,
      t.resolved_at,
      t.created_at
    from public.support_tickets as t
    where t.org_id = v_org_id
      and t.deleted_at is null
  ),
  tx_base as (
    select
      tr.id,
      coalesce(tr.transaction_at, tr.created_at) as tx_time,
      tr.total_amount,
      tr.status,
      tr.payment_status
    from public.transactions as tr
    where tr.org_id = v_org_id
      and tr.deleted_at is null
  ),
  revenue_data as (
    select
      date_trunc('day', tx.tx_time) as period,
      sum(tx.total_amount) as revenue,
      count(*)::bigint as orders
    from tx_base as tx
    where tx.status = 'completed'
      and tx.payment_status not in ('cancelled', 'refunded')
      and tx.tx_time >= v_range_start
    group by 1
  ),
  revenue_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'period', to_char(period, 'YYYY-MM-DD'),
          'revenue', revenue,
          'orders', orders
        )
        order by period
      ),
      '[]'::jsonb
    ) as data
    from revenue_data
  ),
  distribution_seed as (
    select * from (
      values
        ('VIP', 'vip', '#f59e0b', 1),
        ('Thân thiết', 'loyal', '#10b981', 2),
        ('Tiềm năng', 'potential', '#2563eb', 3),
        ('Mới', 'new', '#8a94a6', 4),
        ('Không hoạt động', 'inactive', '#dc2626', 5)
    ) as seed(label, code, color, sort_order)
  ),
  distribution_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'type', seed.label,
          'count', coalesce(counts.total, 0),
          'color', seed.color
        )
        order by seed.sort_order
      ),
      '[]'::jsonb
    ) as data
    from distribution_seed as seed
    left join lateral (
      select count(*)::bigint as total
      from customer_base as cb
      where cb.customer_type = seed.code
    ) as counts on true
  ),
  top_customers_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', cb.id,
          'full_name', cb.full_name,
          'customer_code', cb.customer_code,
          'customer_type', cb.customer_type,
          'total_spent', cb.total_spent
        )
        order by cb.total_spent desc, cb.created_at desc
      ),
      '[]'::jsonb
    ) as data
    from (
      select *
      from customer_base
      order by total_spent desc, created_at desc
      limit 5
    ) as cb
  ),
  urgent_tickets_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', tb.id,
          'title', tb.title,
          'priority', tb.priority,
          'customer_id', tb.customer_id,
          'customer_name', coalesce(cb.full_name, 'Khách hàng không xác định'),
          'created_at', tb.created_at
        )
        order by tb.created_at desc
      ),
      '[]'::jsonb
    ) as data
    from (
      select *
      from ticket_base
      where priority in ('urgent', 'high')
      order by created_at desc
      limit 5
    ) as tb
    left join customer_base as cb on cb.id = tb.customer_id
  )
  select
    (select count(*) from customer_base) as total_customers,
    (select count(*) from customer_base where created_at >= v_month_start) as new_customers_month,
    (
      select coalesce(sum(tx.total_amount), 0)
      from tx_base as tx
      where tx.status = 'completed'
        and tx.payment_status not in ('cancelled', 'refunded')
        and tx.tx_time >= v_month_start
    ) as total_revenue_month,
    (
      select count(*)
      from tx_base as tx
      where tx.status = 'completed'
        and tx.payment_status not in ('cancelled', 'refunded')
        and tx.tx_time >= v_month_start
    ) as total_orders_month,
    (
      select count(*)
      from ticket_base
      where status in ('open', 'in_progress', 'pending')
    ) as open_tickets,
    (
      select count(*)
      from ticket_base
      where resolved_at is not null
        and resolved_at >= v_month_start
    ) as resolved_tickets_month,
    (select data from revenue_json) as revenue_chart,
    (select data from distribution_json) as customer_type_distribution,
    (select data from top_customers_json) as top_customers,
    (select data from urgent_tickets_json) as urgent_tickets;
end;
$$;

grant execute on function public.get_dashboard_snapshot(text) to anon, authenticated;

-- 9) Security-definer RPC cho ghi audit an toàn từ frontend.
create or replace function public.app_create_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_old_data jsonb default null,
  p_new_data jsonb default null,
  p_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_user_id uuid;
  v_id uuid;
begin
  v_org_id := public.get_user_org();
  if v_org_id is null then
    raise exception 'Không xác định được org_id của người dùng hiện tại.';
  end if;

  if p_user_id is not null
     and p_user_id <> auth.uid()
     and not public.has_any_role(array['super_admin', 'admin']) then
    v_user_id := auth.uid();
  else
    v_user_id := coalesce(p_user_id, auth.uid());
  end if;

  insert into public.audit_logs (
    org_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data
  )
  values (
    v_org_id,
    v_user_id,
    coalesce(nullif(btrim(p_action), ''), 'UPDATE'),
    coalesce(nullif(btrim(p_entity_type), ''), 'system'),
    p_entity_id,
    p_old_data,
    p_new_data
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.app_create_audit_log(text, text, uuid, jsonb, jsonb, uuid) to authenticated;

-- 10) Soft-delete customer RPC thống nhất.
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

-- 11) Cascade soft-delete customer để tránh orphan dữ liệu active.
create or replace function public.cascade_customer_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_at timestamptz;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.deleted_at is null and new.deleted_at is not null then
    v_deleted_at := new.deleted_at;

    update public.customer_notes
    set deleted_at = coalesce(deleted_at, v_deleted_at),
        updated_at = now()
    where org_id = new.org_id
      and customer_id = new.id
      and deleted_at is null;

    update public.customer_tags
    set deleted_at = coalesce(deleted_at, v_deleted_at),
        updated_at = now()
    where org_id = new.org_id
      and customer_id = new.id
      and deleted_at is null;

    update public.transactions
    set deleted_at = coalesce(deleted_at, v_deleted_at),
        updated_at = now()
    where org_id = new.org_id
      and customer_id = new.id
      and deleted_at is null;

    update public.support_tickets
    set deleted_at = coalesce(deleted_at, v_deleted_at),
        updated_at = now()
    where org_id = new.org_id
      and customer_id = new.id
      and deleted_at is null;

    update public.deals
    set deleted_at = coalesce(deleted_at, v_deleted_at),
        updated_at = now()
    where org_id = new.org_id
      and customer_id = new.id
      and deleted_at is null;

    update public.tasks
    set deleted_at = coalesce(deleted_at, v_deleted_at),
        updated_at = now()
    where org_id = new.org_id
      and customer_id = new.id
      and deleted_at is null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_cascade_customer_soft_delete on public.customers;
create trigger trg_cascade_customer_soft_delete
after update on public.customers
for each row execute function public.cascade_customer_soft_delete();

-- 12) Policy re-assert theo trạng thái đã chốt.
drop policy if exists customers_update on public.customers;
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

create index if not exists idx_customers_org_assigned_to_active
  on public.customers(org_id, assigned_to)
  where deleted_at is null;

create index if not exists idx_deals_org_assigned_to_active
  on public.deals(org_id, assigned_to)
  where deleted_at is null;

create index if not exists idx_tasks_org_assigned_to_active
  on public.tasks(org_id, assigned_to)
  where deleted_at is null;

commit;
