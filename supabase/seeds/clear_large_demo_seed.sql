-- LEGACY (schema cũ): file này không còn phù hợp schema hiện tại.
-- Dùng file mới: supabase/seeds/clear_large_demo_seed_v2.sql
-- Clear the operational seed dataset created by large_demo_seed.sql.
-- Safe to rerun: it removes only records that belong to the seeded batch or the legacy demo seed.

do $$
declare
  v_seed_signature constant text := 'ops-20260404-a1';
  v_seed_email_domains constant text[] := array['northgrid.vn','blueharbor.vn','lamsonlogistics.vn','oranafoods.vn','vantiscare.vn','elevateworks.vn'];
  v_seed_control jsonb := '{}'::jsonb;
  v_customer_ids uuid[] := '{}'::uuid[]; v_transaction_ids uuid[] := '{}'::uuid[]; v_ticket_ids uuid[] := '{}'::uuid[]; v_deal_ids uuid[] := '{}'::uuid[]; v_task_ids uuid[] := '{}'::uuid[]; v_campaign_ids uuid[] := '{}'::uuid[]; v_automation_ids uuid[] := '{}'::uuid[]; v_notification_ids uuid[] := '{}'::uuid[]; v_outbound_ids uuid[] := '{}'::uuid[]; v_audit_ids uuid[] := '{}'::uuid[]; v_ticket_comment_ids uuid[] := '{}'::uuid[]; v_selected_uuid_ids uuid[] := '{}'::uuid[];
begin
  select coalesce(integrations -> 'seed_control', '{}'::jsonb) into v_seed_control from app_settings where id = 'default';
  select coalesce(array_agg(elements.value::uuid), '{}'::uuid[]) into v_customer_ids from jsonb_array_elements_text(coalesce(v_seed_control -> 'customer_ids', '[]'::jsonb)) as elements(value);
  select coalesce(array_agg(elements.value::uuid), '{}'::uuid[]) into v_transaction_ids from jsonb_array_elements_text(coalesce(v_seed_control -> 'transaction_ids', '[]'::jsonb)) as elements(value);
  select coalesce(array_agg(elements.value::uuid), '{}'::uuid[]) into v_ticket_ids from jsonb_array_elements_text(coalesce(v_seed_control -> 'ticket_ids', '[]'::jsonb)) as elements(value);
  select coalesce(array_agg(elements.value::uuid), '{}'::uuid[]) into v_deal_ids from jsonb_array_elements_text(coalesce(v_seed_control -> 'deal_ids', '[]'::jsonb)) as elements(value);
  select coalesce(array_agg(elements.value::uuid), '{}'::uuid[]) into v_task_ids from jsonb_array_elements_text(coalesce(v_seed_control -> 'task_ids', '[]'::jsonb)) as elements(value);
  select coalesce(array_agg(elements.value::uuid), '{}'::uuid[]) into v_campaign_ids from jsonb_array_elements_text(coalesce(v_seed_control -> 'campaign_ids', '[]'::jsonb)) as elements(value);
  select coalesce(array_agg(elements.value::uuid), '{}'::uuid[]) into v_automation_ids from jsonb_array_elements_text(coalesce(v_seed_control -> 'automation_ids', '[]'::jsonb)) as elements(value);
  select coalesce(array_agg(elements.value::uuid), '{}'::uuid[]) into v_notification_ids from jsonb_array_elements_text(coalesce(v_seed_control -> 'notification_ids', '[]'::jsonb)) as elements(value);
  select coalesce(array_agg(elements.value::uuid), '{}'::uuid[]) into v_outbound_ids from jsonb_array_elements_text(coalesce(v_seed_control -> 'outbound_message_ids', '[]'::jsonb)) as elements(value);
  select coalesce(array_agg(elements.value::uuid), '{}'::uuid[]) into v_audit_ids from jsonb_array_elements_text(coalesce(v_seed_control -> 'audit_ids', '[]'::jsonb)) as elements(value);
  select coalesce(array_agg(elements.value::uuid), '{}'::uuid[]) into v_ticket_comment_ids from jsonb_array_elements_text(coalesce(v_seed_control -> 'ticket_comment_ids', '[]'::jsonb)) as elements(value);

  select coalesce(array_agg(c.id), '{}'::uuid[]) into v_selected_uuid_ids from customers c where split_part(coalesce(c.email, ''), '@', 2) = any(v_seed_email_domains) or coalesce(c.email, '') like '%@demo-seed.nexcrm.vn'; v_customer_ids := v_customer_ids || v_selected_uuid_ids;
  select coalesce(array_agg(c.id), '{}'::uuid[]) into v_selected_uuid_ids from campaigns c where coalesce(c.target_segment ->> '_seed_signature', '') = v_seed_signature or c.name like '[DEMO] %'; v_campaign_ids := v_campaign_ids || v_selected_uuid_ids;
  select coalesce(array_agg(ar.id), '{}'::uuid[]) into v_selected_uuid_ids from automation_rules ar where coalesce(ar.action_config ->> '_seed_signature', '') = v_seed_signature or ar.name like '[DEMO] %'; v_automation_ids := v_automation_ids || v_selected_uuid_ids;
  select coalesce(array_agg(tr.id), '{}'::uuid[]) into v_selected_uuid_ids from transactions tr where tr.customer_id = any(v_customer_ids) or coalesce(tr.notes, '') like '[DEMO] %'; v_transaction_ids := v_transaction_ids || v_selected_uuid_ids;
  select coalesce(array_agg(st.id), '{}'::uuid[]) into v_selected_uuid_ids from support_tickets st where st.customer_id = any(v_customer_ids) or st.title like '[DEMO] %'; v_ticket_ids := v_ticket_ids || v_selected_uuid_ids;
  select coalesce(array_agg(d.id), '{}'::uuid[]) into v_selected_uuid_ids from deals d where d.customer_id = any(v_customer_ids) or d.title like '[DEMO] %'; v_deal_ids := v_deal_ids || v_selected_uuid_ids;
  select coalesce(array_agg(t.id), '{}'::uuid[]) into v_selected_uuid_ids from tasks t where t.entity_id = any(v_customer_ids || v_transaction_ids || v_ticket_ids || v_deal_ids || v_campaign_ids) or t.title like '[DEMO] %'; v_task_ids := v_task_ids || v_selected_uuid_ids;
  select coalesce(array_agg(tc.id), '{}'::uuid[]) into v_selected_uuid_ids from ticket_comments tc where tc.ticket_id = any(v_ticket_ids); v_ticket_comment_ids := v_ticket_comment_ids || v_selected_uuid_ids;
  select coalesce(array_agg(om.id), '{}'::uuid[]) into v_selected_uuid_ids from outbound_messages om where om.customer_id = any(v_customer_ids) or om.campaign_id = any(v_campaign_ids) or om.automation_rule_id = any(v_automation_ids) or coalesce(om.metadata ->> '_seed_signature', '') = v_seed_signature or coalesce(om.metadata ->> 'seed', '') = 'compact-demo'; v_outbound_ids := v_outbound_ids || v_selected_uuid_ids;
  select coalesce(array_agg(n.id), '{}'::uuid[]) into v_selected_uuid_ids from notifications n where n.entity_id = any(v_customer_ids || v_transaction_ids || v_ticket_ids || v_deal_ids || v_task_ids || v_campaign_ids || v_automation_ids) or n.title like '[DEMO] %'; v_notification_ids := v_notification_ids || v_selected_uuid_ids;
  select coalesce(array_agg(al.id), '{}'::uuid[]) into v_selected_uuid_ids from audit_logs al where al.entity_id = any(v_customer_ids || v_transaction_ids || v_ticket_ids || v_deal_ids || v_task_ids || v_campaign_ids || v_automation_ids) or coalesce(al.new_data ->> '_seed_signature', '') = v_seed_signature or coalesce(al.old_data ->> '_seed_signature', '') = v_seed_signature or coalesce(al.new_data ->> 'seed', '') = 'compact-demo' or coalesce(al.old_data ->> 'seed', '') = 'compact-demo' or coalesce(al.new_data ->> 'message', '') like '[DEMO] %' or coalesce(al.old_data ->> 'message', '') like '[DEMO] %'; v_audit_ids := v_audit_ids || v_selected_uuid_ids;

  delete from outbound_messages where id = any(v_outbound_ids);
  delete from notifications where id = any(v_notification_ids);
  delete from ticket_comments where id = any(v_ticket_comment_ids);
  delete from tasks where id = any(v_task_ids);
  delete from deals where id = any(v_deal_ids);
  delete from support_tickets where id = any(v_ticket_ids);
  delete from transactions where id = any(v_transaction_ids);
  delete from audit_logs where id = any(v_audit_ids);
  delete from campaigns where id = any(v_campaign_ids);
  delete from automation_rules where id = any(v_automation_ids);
  delete from customers where id = any(v_customer_ids);
  update app_settings set integrations = coalesce(integrations, '{}'::jsonb) - 'seed_control', updated_at = now() where id = 'default';
end $$;
