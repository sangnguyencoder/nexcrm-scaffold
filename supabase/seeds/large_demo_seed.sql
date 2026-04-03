-- NexCRM large demo seed
-- Run this in Supabase SQL Editor on a staging/demo project after schema + migrations.
-- Prerequisite: profiles table already has active users for at least one role.

do $$
declare
  v_all_profiles uuid[];
  v_sales_profiles uuid[];
  v_cskh_profiles uuid[];
  v_marketing_profiles uuid[];
  v_admin_profiles uuid[];

  v_sales_count int;
  v_cskh_count int;
  v_marketing_count int;
  v_admin_count int;
  v_all_count int;

  v_customer_ids uuid[] := '{}'::uuid[];
  v_transaction_ids uuid[] := '{}'::uuid[];
  v_customer_emails text[] := '{}'::text[];
  v_customer_phones text[] := '{}'::text[];
  v_ticket_ids uuid[] := '{}'::uuid[];
  v_deal_ids uuid[] := '{}'::uuid[];
  v_task_ids uuid[] := '{}'::uuid[];
  v_campaign_ids uuid[] := '{}'::uuid[];
  v_campaign_channels text[] := '{}'::text[];
  v_campaign_subjects text[] := '{}'::text[];
  v_automation_ids uuid[] := '{}'::uuid[];
  v_automation_channels text[] := '{}'::text[];
  v_automation_names text[] := '{}'::text[];

  v_actor_id uuid;
  v_customer_id uuid;
  v_transaction_id uuid;
  v_ticket_id uuid;
  v_deal_id uuid;
  v_task_id uuid;
  v_campaign_id uuid;
  v_automation_id uuid;
  v_selected_id uuid;
  v_selected_user_id uuid;

  v_created_at timestamptz;
  v_due_at timestamptz;
  v_resolved_at timestamptz;
  v_expected_close_at timestamptz;
  v_sent_at timestamptz;
  v_opened_at timestamptz;
  v_clicked_at timestamptz;

  v_customer_type text;
  v_customer_source text;
  v_customer_gender text;
  v_transaction_status text;
  v_payment_status text;
  v_payment_method text;
  v_ticket_status text;
  v_ticket_priority text;
  v_ticket_category text;
  v_ticket_channel text;
  v_deal_stage text;
  v_task_status text;
  v_task_priority text;
  v_task_entity_type text;
  v_campaign_status text;
  v_campaign_channel text;
  v_automation_action_type text;
  v_outbound_channel text;
  v_outbound_status text;
  v_entity_type text;
  v_notification_type text;
  v_audit_action text;

  v_full_name text;
  v_phone text;
  v_email text;
  v_address_line text;
  v_recipient text;
  v_title text;
  v_description text;
  v_resolution_note text;
  v_subject_line text;

  v_discount_amount numeric(15,2);
  v_tax_amount numeric(15,2);
  v_subtotal_amount numeric(15,2);
  v_total_amount numeric(15,2);
  v_deal_value numeric(15,2);
  v_probability_value int;
  v_satisfaction int;

  v_customer_index int;
  v_item_count int;
  v_task_entity_index int;
  v_campaign_index int;
  v_automation_index int;
  v_suffix text;
  v_target_segment jsonb;
  v_items_payload jsonb;

  v_first_names text[] := array[
    'An','Anh','Bao','Binh','Chi','Cuong','Dung','Duy','Giang','Ha','Hai','Hanh','Hoa','Hung','Khanh','Khoa','Lam','Linh','Long','Mai','Minh','My','Nam','Ngoc','Nhung','Phat','Phuc','Phong','Quang','Sang','Son','Tam','Thanh','Thao','Tien','Trang','Trinh','Truc','Tuan','Tuyet','Van','Vy'
  ];
  v_last_names text[] := array[
    'Nguyen','Tran','Le','Pham','Hoang','Huynh','Phan','Vu','Dang','Bui','Do','Ho','Ngo','Duong','Ly'
  ];
  v_middle_names text[] := array[
    'Van','Thi','Minh','Ngoc','Duc','Gia','Bao','Thanh','Quoc','Anh','Gia Han','Thu','Hoang','Kim','Nhat','Quang'
  ];
  v_provinces text[] := array[
    'TP. Ho Chi Minh','Ha Noi','Da Nang','Can Tho','Hai Phong','Binh Duong','Dong Nai','Khanh Hoa','Quang Ninh','Nghe An','Thanh Hoa','Hue'
  ];
  v_streets text[] := array[
    'Nguyen Hue','Le Loi','Tran Hung Dao','Vo Van Tan','Phan Chu Trinh','Hai Ba Trung','Dien Bien Phu','Nguyen Thi Minh Khai','Tran Phu','Pham Van Dong'
  ];
  v_products text[] := array[
    'Goi CRM Starter','Goi CRM Growth','Goi CRM Enterprise','Add-on Marketing','Add-on CSKH','Bao cao nang cao','Tich hop POS','Tich hop Zalo OA','Goi SMS','Goi Email'
  ];
  v_phone_prefixes text[] := array[
    '032','033','034','035','036','037','038','039','070','076','077','078','079','081','082','083','084','085','086','088','089','090','091','092','093','094','096','097','098'
  ];
begin
  select coalesce(array_agg(p.id order by p.created_at), '{}'::uuid[])
  into v_all_profiles
  from profiles p
  where coalesce(p.is_active, true) = true;

  v_all_count := coalesce(array_length(v_all_profiles, 1), 0);
  if v_all_count = 0 then
    raise exception 'Khong tim thay profile nao. Tao auth user + profiles truoc khi chay large demo seed.';
  end if;

  select coalesce(array_agg(p.id order by p.created_at), '{}'::uuid[]) into v_sales_profiles
  from profiles p where p.role = 'sales' and coalesce(p.is_active, true) = true;

  select coalesce(array_agg(p.id order by p.created_at), '{}'::uuid[]) into v_cskh_profiles
  from profiles p where p.role = 'cskh' and coalesce(p.is_active, true) = true;

  select coalesce(array_agg(p.id order by p.created_at), '{}'::uuid[]) into v_marketing_profiles
  from profiles p where p.role = 'marketing' and coalesce(p.is_active, true) = true;

  select coalesce(array_agg(p.id order by p.created_at), '{}'::uuid[]) into v_admin_profiles
  from profiles p where p.role in ('super_admin','admin','director') and coalesce(p.is_active, true) = true;

  if coalesce(array_length(v_sales_profiles, 1), 0) = 0 then v_sales_profiles := v_all_profiles; end if;
  if coalesce(array_length(v_cskh_profiles, 1), 0) = 0 then v_cskh_profiles := v_all_profiles; end if;
  if coalesce(array_length(v_marketing_profiles, 1), 0) = 0 then v_marketing_profiles := v_all_profiles; end if;
  if coalesce(array_length(v_admin_profiles, 1), 0) = 0 then v_admin_profiles := v_all_profiles; end if;

  v_sales_count := coalesce(array_length(v_sales_profiles, 1), 0);
  v_cskh_count := coalesce(array_length(v_cskh_profiles, 1), 0);
  v_marketing_count := coalesce(array_length(v_marketing_profiles, 1), 0);
  v_admin_count := coalesce(array_length(v_admin_profiles, 1), 0);
  v_actor_id := v_admin_profiles[1];

  update profiles p
  set avatar_url = case p.role
    when 'super_admin' then '/avatars/default-super-admin.svg'
    when 'admin' then '/avatars/default-admin.svg'
    when 'director' then '/avatars/default-director.svg'
    when 'sales' then '/avatars/default-sales.svg'
    when 'cskh' then '/avatars/default-cskh.svg'
    when 'marketing' then '/avatars/default-marketing.svg'
    else p.avatar_url
  end,
  updated_at = now()
  where coalesce(p.avatar_url, '') = '';

  insert into app_settings (id, company_name, logo_url, plan, created_by)
  values ('default', 'Cong ty Demo NexCRM Viet Nam', '/branding/demo-company-logo.svg', 'Free', v_actor_id)
  on conflict (id) do update
  set company_name = excluded.company_name,
      logo_url = excluded.logo_url,
      updated_at = now();

  update app_settings s
  set integrations =
      jsonb_set(
        jsonb_set(
          coalesce(s.integrations, '{}'::jsonb),
          '{email_provider}',
          jsonb_build_object(
            'provider', null,
            'enabled', false,
            'from_name', 'NexCRM Demo',
            'from_email', 'hello@demo.nexcrm.vn',
            'reply_to', 'support@demo.nexcrm.vn'
          ),
          true
        ),
        '{sms_provider}',
        jsonb_build_object(
          'provider', null,
          'enabled', false,
          'sender_id', 'NEXCRM',
          'from_number', '+84900000000'
        ),
        true
      ),
      updated_at = now()
  where s.id = 'default';

  delete from outbound_messages om
  where om.campaign_id in (select c.id from campaigns c where c.name like '[DEMO] %')
     or om.automation_rule_id in (select ar.id from automation_rules ar where ar.name like '[DEMO] %')
     or om.customer_id in (select c.id from customers c where c.email like '%@demo-seed.nexcrm.vn');

  delete from notifications n where n.title like '[DEMO] %';
  delete from ticket_comments tc where tc.ticket_id in (select st.id from support_tickets st where st.title like '[DEMO] %');
  delete from tasks t where t.title like '[DEMO] %';
  delete from deals d where d.title like '[DEMO] %';
  delete from support_tickets st where st.title like '[DEMO] %';
  delete from transactions tr where tr.notes like '[DEMO] %' or tr.customer_id in (select c.id from customers c where c.email like '%@demo-seed.nexcrm.vn');
  delete from campaigns c where c.name like '[DEMO] %';
  delete from automation_rules ar where ar.name like '[DEMO] %';
  delete from audit_logs al
  where coalesce(al.new_data ->> 'message', '') like '[DEMO] %'
     or coalesce(al.old_data ->> 'message', '') like '[DEMO] %';
  delete from customers c where c.email like '%@demo-seed.nexcrm.vn';

  for i in 1..320 loop
    v_customer_type := case
      when i <= 32 then 'vip'
      when i <= 96 then 'loyal'
      when i <= 208 then 'potential'
      when i <= 288 then 'new'
      else 'inactive'
    end;

    v_customer_source := case i % 6
      when 0 then 'direct'
      when 1 then 'marketing'
      when 2 then 'referral'
      when 3 then 'pos'
      when 4 then 'online'
      else 'other'
    end;

    v_customer_gender := case i % 3
      when 0 then 'male'
      when 1 then 'female'
      else 'other'
    end;

    v_full_name := trim(
      v_last_names[((i - 1) % array_length(v_last_names, 1)) + 1] || ' ' ||
      v_middle_names[((i * 2 - 1) % array_length(v_middle_names, 1)) + 1] || ' ' ||
      v_first_names[((i * 3 - 1) % array_length(v_first_names, 1)) + 1]
    );

    v_suffix := lpad(((i * 137) % 10000000)::text, 7, '0');
    v_phone := case when i % 19 = 0 then null else v_phone_prefixes[((i - 1) % array_length(v_phone_prefixes, 1)) + 1] || v_suffix end;
    v_email := case when i % 23 = 0 then null else format('customer%s@demo-seed.nexcrm.vn', lpad(i::text, 3, '0')) end;

    v_address_line := format(
      '%s %s, Phuong %s',
      10 + (i % 190),
      v_streets[((i - 1) % array_length(v_streets, 1)) + 1],
      ((i - 1) % 12) + 1
    );

    v_created_at := now() - make_interval(days => (i * 3) % 240, hours => (i * 5) % 24);

    insert into customers (
      full_name,
      phone,
      email,
      address,
      province,
      date_of_birth,
      gender,
      customer_type,
      source,
      assigned_to,
      is_active,
      created_by,
      created_at,
      updated_at
    ) values (
      v_full_name,
      v_phone,
      v_email,
      v_address_line,
      v_provinces[((i - 1) % array_length(v_provinces, 1)) + 1],
      case
        when i % 25 = 0 then (current_date - make_interval(days => (22 + (i % 18)) * 365))::date
        else (current_date - make_interval(days => 8000 + ((i * 31) % 3500)))::date
      end,
      v_customer_gender,
      v_customer_type,
      v_customer_source,
      v_sales_profiles[((i - 1) % v_sales_count) + 1],
      v_customer_type <> 'inactive',
      v_actor_id,
      v_created_at,
      v_created_at
    )
    returning id into v_customer_id;

    v_customer_ids := array_append(v_customer_ids, v_customer_id);
    v_customer_emails := array_append(v_customer_emails, coalesce(v_email, ''));
    v_customer_phones := array_append(v_customer_phones, coalesce(v_phone, ''));
  end loop;

  for i in 1..1300 loop
    v_customer_index := ((i * 7 - 1) % array_length(v_customer_ids, 1)) + 1;
    v_customer_id := v_customer_ids[v_customer_index];
    v_created_at := now() - make_interval(days => (i * 2) % 180, hours => (i * 3) % 24);
    v_item_count := 1 + (i % 3);

    v_items_payload := jsonb_build_array(
      jsonb_build_object(
        'name', v_products[((i - 1) % array_length(v_products, 1)) + 1],
        'qty', 1 + (i % 3),
        'price', 650000 + ((i * 9) % 15) * 180000,
        'total', (1 + (i % 3)) * (650000 + ((i * 9) % 15) * 180000)
      )
    );

    if v_item_count >= 2 then
      v_items_payload := v_items_payload || jsonb_build_array(
        jsonb_build_object(
          'name', v_products[((i + 3 - 1) % array_length(v_products, 1)) + 1],
          'qty', 1 + (i % 2),
          'price', 420000 + ((i * 7) % 12) * 150000,
          'total', (1 + (i % 2)) * (420000 + ((i * 7) % 12) * 150000)
        )
      );
    end if;

    if v_item_count = 3 then
      v_items_payload := v_items_payload || jsonb_build_array(
        jsonb_build_object(
          'name', v_products[((i + 6 - 1) % array_length(v_products, 1)) + 1],
          'qty', 1,
          'price', 350000 + ((i * 11) % 10) * 120000,
          'total', 350000 + ((i * 11) % 10) * 120000
        )
      );
    end if;

    select coalesce(sum((item ->> 'total')::numeric), 0)
    into v_subtotal_amount
    from jsonb_array_elements(v_items_payload) as item;

    v_discount_amount := case
      when i % 11 = 0 then round(v_subtotal_amount * 0.10, 2)
      when i % 4 = 0 then round(v_subtotal_amount * 0.05, 2)
      else 0
    end;

    v_tax_amount := round(greatest(v_subtotal_amount - v_discount_amount, 0) * 0.08, 2);
    v_total_amount := greatest(v_subtotal_amount - v_discount_amount, 0) + v_tax_amount;

    v_transaction_status := case
      when i % 37 = 0 then 'refunded'
      when i % 21 = 0 then 'cancelled'
      when i % 9 = 0 then 'processing'
      when i % 13 = 0 then 'pending'
      else 'completed'
    end;

    v_payment_status := case
      when v_transaction_status = 'cancelled' then 'cancelled'
      when v_transaction_status = 'refunded' then 'refunded'
      when v_transaction_status in ('processing', 'pending') and i % 2 = 0 then 'partial'
      when v_transaction_status in ('processing', 'pending') then 'pending'
      else 'paid'
    end;

    v_payment_method := case i % 5
      when 0 then 'cash'
      when 1 then 'card'
      when 2 then 'transfer'
      when 3 then 'qr'
      else 'other'
    end;

    insert into transactions (
      customer_id,
      invoice_code,
      items,
      subtotal,
      discount,
      tax,
      total_amount,
      payment_method,
      payment_status,
      status,
      notes,
      created_by,
      created_at,
      updated_at
    ) values (
      v_customer_id,
      format('HD-%s-%s', to_char(v_created_at, 'YYYY'), lpad((9000 + i)::text, 4, '0')),
      v_items_payload,
      v_subtotal_amount,
      v_discount_amount,
      v_tax_amount,
      v_total_amount,
      v_payment_method,
      v_payment_status,
      v_transaction_status,
      format('[DEMO] Giao dich mo phong #%s', i),
      v_actor_id,
      v_created_at,
      v_created_at
    )
    returning id into v_transaction_id;

    v_transaction_ids := array_append(v_transaction_ids, v_transaction_id);
  end loop;

  for i in 1..240 loop
    v_customer_index := ((i * 5 - 1) % array_length(v_customer_ids, 1)) + 1;
    v_customer_id := v_customer_ids[v_customer_index];
    v_created_at := now() - make_interval(days => (i * 2) % 90, hours => (i * 4) % 24);

    v_ticket_priority := case
      when i % 17 = 0 then 'urgent'
      when i % 7 = 0 then 'high'
      when i % 3 = 0 then 'medium'
      else 'low'
    end;

    v_ticket_status := case
      when i % 11 = 0 then 'closed'
      when i % 9 = 0 then 'resolved'
      when i % 5 = 0 then 'pending'
      when i % 2 = 0 then 'in_progress'
      else 'open'
    end;

    v_ticket_category := case i % 5
      when 0 then 'complaint'
      when 1 then 'feedback'
      when 2 then 'inquiry'
      when 3 then 'return'
      else 'other'
    end;

    v_ticket_channel := case i % 6
      when 0 then 'phone'
      when 1 then 'email'
      when 2 then 'direct'
      when 3 then 'chat'
      when 4 then 'social'
      else 'other'
    end;

    v_due_at := case
      when i % 6 = 0 then v_created_at - interval '6 hours'
      else v_created_at + make_interval(hours => 24 + (i % 72))
    end;

    v_resolved_at := case
      when v_ticket_status in ('resolved', 'closed') then v_created_at + make_interval(hours => 4 + (i % 36))
      else null
    end;

    v_satisfaction := case when v_ticket_status in ('resolved', 'closed') then 3 + (i % 3) else null end;
    v_resolution_note := case when v_ticket_status in ('resolved', 'closed') then format('[DEMO] Da xu ly xong ticket #%s', i) else null end;
    v_title := format('[DEMO] Ticket #%s - %s', i, initcap(replace(v_ticket_category, '_', ' ')));
    v_description := format('Khach hang can ho tro cho truong hop mo phong #%s, uu tien %s.', i, v_ticket_priority);

    insert into support_tickets (
      customer_id,
      title,
      description,
      category,
      priority,
      channel,
      assigned_to,
      status,
      first_response_at,
      resolved_at,
      due_date,
      satisfaction_score,
      resolution_note,
      created_by,
      created_at,
      updated_at
    ) values (
      v_customer_id,
      v_title,
      v_description,
      v_ticket_category,
      v_ticket_priority,
      v_ticket_channel,
      v_cskh_profiles[((i - 1) % v_cskh_count) + 1],
      v_ticket_status,
      v_created_at + interval '2 hours',
      v_resolved_at,
      v_due_at,
      v_satisfaction,
      v_resolution_note,
      v_actor_id,
      v_created_at,
      coalesce(v_resolved_at, v_created_at + interval '3 hours')
    )
    returning id into v_ticket_id;

    v_ticket_ids := array_append(v_ticket_ids, v_ticket_id);

    insert into ticket_comments (ticket_id, author_id, content, is_internal, created_at)
    values
      (v_ticket_id, v_cskh_profiles[((i - 1) % v_cskh_count) + 1], format('[DEMO] Da tiep nhan va phan loai ticket #%s.', i), false, v_created_at + interval '1 hour'),
      (v_ticket_id, v_admin_profiles[((i - 1) % v_admin_count) + 1], format('[DEMO] Ghi chu noi bo cho ticket #%s.', i), true, v_created_at + interval '2 hours'),
      (v_ticket_id, v_cskh_profiles[((i) % v_cskh_count) + 1], format('[DEMO] Da cap nhat tien do xu ly ticket #%s.', i), false, v_created_at + interval '4 hours');
  end loop;

  for i in 1..200 loop
    v_customer_index := ((i * 9 - 1) % array_length(v_customer_ids, 1)) + 1;
    v_customer_id := v_customer_ids[v_customer_index];
    v_created_at := now() - make_interval(days => (i * 3) % 150, hours => (i * 2) % 24);

    v_deal_stage := case
      when i % 13 = 0 then 'lost'
      when i % 9 = 0 then 'won'
      when i % 5 = 0 then 'negotiation'
      when i % 3 = 0 then 'proposal'
      when i % 2 = 0 then 'qualified'
      else 'lead'
    end;

    v_probability_value := case v_deal_stage
      when 'lead' then 20
      when 'qualified' then 35
      when 'proposal' then 55
      when 'negotiation' then 75
      when 'won' then 100
      else 0
    end;

    v_deal_value := 3000000 + ((i * 17) % 60) * 750000;
    v_expected_close_at := case
      when v_deal_stage in ('won', 'lost') then v_created_at + make_interval(days => 7 + (i % 30))
      else now() + make_interval(days => 5 + (i % 45))
    end;
    v_title := format('[DEMO] Co hoi #%s - %s', i, v_provinces[((i - 1) % array_length(v_provinces, 1)) + 1]);
    v_description := format('Co hoi ban hang mo phong #%s cho khach hang seed demo.', i);

    insert into deals (
      title,
      customer_id,
      owner_id,
      stage,
      value,
      probability,
      expected_close_at,
      description,
      created_by,
      created_at,
      updated_at
    ) values (
      v_title,
      v_customer_id,
      v_sales_profiles[((i - 1) % v_sales_count) + 1],
      v_deal_stage,
      v_deal_value,
      v_probability_value,
      v_expected_close_at,
      v_description,
      v_actor_id,
      v_created_at,
      v_created_at + interval '6 hours'
    )
    returning id into v_deal_id;

    v_deal_ids := array_append(v_deal_ids, v_deal_id);
  end loop;

  for i in 1..500 loop
    v_task_entity_type := case i % 4
      when 0 then 'deal'
      when 1 then 'ticket'
      when 2 then 'customer'
      else 'transaction'
    end;

    if v_task_entity_type = 'deal' then
      v_task_entity_index := ((i * 3 - 1) % array_length(v_deal_ids, 1)) + 1;
      v_selected_id := v_deal_ids[v_task_entity_index];
    elsif v_task_entity_type = 'ticket' then
      v_task_entity_index := ((i * 5 - 1) % array_length(v_ticket_ids, 1)) + 1;
      v_selected_id := v_ticket_ids[v_task_entity_index];
    elsif v_task_entity_type = 'customer' then
      v_task_entity_index := ((i * 7 - 1) % array_length(v_customer_ids, 1)) + 1;
      v_selected_id := v_customer_ids[v_task_entity_index];
    else
      v_task_entity_index := ((i * 11 - 1) % array_length(v_transaction_ids, 1)) + 1;
      v_selected_id := v_transaction_ids[v_task_entity_index];
    end if;

    v_task_status := case
      when i % 13 = 0 then 'overdue'
      when i % 5 = 0 then 'done'
      when i % 2 = 0 then 'in_progress'
      else 'todo'
    end;

    v_task_priority := case
      when i % 7 = 0 then 'high'
      when i % 3 = 0 then 'medium'
      else 'low'
    end;

    v_created_at := now() - make_interval(days => (i * 2) % 60, hours => i % 12);
    v_due_at := case
      when v_task_status = 'overdue' then v_created_at - interval '4 hours'
      when v_task_status = 'done' then v_created_at + interval '6 hours'
      else now() + make_interval(days => i % 20, hours => i % 10)
    end;

    insert into tasks (
      title,
      description,
      entity_type,
      entity_id,
      assigned_to,
      status,
      priority,
      due_at,
      completed_at,
      created_by,
      created_at,
      updated_at
    ) values (
      format('[DEMO] Follow-up #%s', i),
      format('Nhiem vu mo phong #%s cho entity %s.', i, v_task_entity_type),
      v_task_entity_type,
      v_selected_id,
      v_all_profiles[((i - 1) % v_all_count) + 1],
      v_task_status,
      v_task_priority,
      v_due_at,
      case when v_task_status = 'done' then v_due_at - interval '1 hour' else null end,
      v_actor_id,
      v_created_at,
      v_created_at + interval '2 hours'
    )
    returning id into v_task_id;

    v_task_ids := array_append(v_task_ids, v_task_id);
  end loop;

  for i in 1..24 loop
    v_campaign_status := case
      when i <= 10 then 'sent'
      when i <= 14 then 'sending'
      when i <= 18 then 'scheduled'
      when i <= 22 then 'draft'
      else 'cancelled'
    end;

    v_campaign_channel := case i % 3
      when 0 then 'both'
      when 1 then 'email'
      else 'sms'
    end;

    v_target_segment := case i % 4
      when 0 then jsonb_build_object('customer_types', to_jsonb(array['vip','loyal']))
      when 1 then jsonb_build_object('customer_types', to_jsonb(array['potential','new']))
      when 2 then jsonb_build_object('customer_types', to_jsonb(array['vip','potential','new']))
      else jsonb_build_object('customer_types', to_jsonb(array['loyal','new']))
    end;

    v_created_at := now() - make_interval(days => i * 3, hours => i);
    v_title := format('[DEMO] Campaign #%s', i);
    v_subject_line := format('Thong diep mo phong #%s tu NexCRM', i);

    insert into campaigns (
      name,
      description,
      channel,
      subject,
      content,
      target_segment,
      recipient_count,
      status,
      sent_count,
      opened_count,
      click_count,
      failed_count,
      scheduled_at,
      sent_at,
      created_by,
      created_at,
      updated_at
    ) values (
      v_title,
      format('[DEMO] Chien dich mo phong %s cho UAT va regression test.', i),
      v_campaign_channel,
      v_subject_line,
      format('Xin chao {ten_khach_hang}, day la noi dung chien dich demo #%s tu NexCRM.', i),
      v_target_segment,
      80 + ((i * 13) % 180),
      v_campaign_status,
      0,
      0,
      0,
      0,
      case when v_campaign_status = 'scheduled' then now() + make_interval(days => i % 10, hours => i % 8) else null end,
      case when v_campaign_status in ('sent', 'sending') then v_created_at + interval '8 hours' else null end,
      v_marketing_profiles[((i - 1) % v_marketing_count) + 1],
      v_created_at,
      v_created_at
    )
    returning id into v_campaign_id;

    v_campaign_ids := array_append(v_campaign_ids, v_campaign_id);
    v_campaign_channels := array_append(v_campaign_channels, v_campaign_channel);
    v_campaign_subjects := array_append(v_campaign_subjects, v_subject_line);
  end loop;

  for i in 1..10 loop
    v_automation_action_type := case when i % 2 = 0 then 'send_sms' else 'send_email' end;
    v_created_at := now() - make_interval(days => i * 4);

    insert into automation_rules (
      name,
      description,
      is_active,
      trigger_type,
      trigger_config,
      action_type,
      action_config,
      created_by,
      created_at,
      updated_at
    ) values (
      format('[DEMO] Automation Rule #%s', i),
      format('[DEMO] Quy tac tu dong mo phong #%s.', i),
      true,
      case i % 4
        when 0 then 'birthday'
        when 1 then 'inactive_days'
        when 2 then 'after_purchase'
        else 'new_customer'
      end,
      case i % 4
        when 0 then jsonb_build_object()
        when 1 then jsonb_build_object('days', 30)
        when 2 then jsonb_build_object('days', 7)
        else jsonb_build_object()
      end,
      v_automation_action_type,
      jsonb_build_object(
        'content', format('Xin chao {ten_khach_hang}, day la thong diep tu dong demo #%s.', i),
        'summary', 'large-demo-seed',
        'sent_count', 0
      ),
      v_marketing_profiles[((i - 1) % v_marketing_count) + 1],
      v_created_at,
      v_created_at
    )
    returning id into v_automation_id;

    v_automation_ids := array_append(v_automation_ids, v_automation_id);
    v_automation_channels := array_append(v_automation_channels, case when v_automation_action_type = 'send_email' then 'email' else 'sms' end);
    v_automation_names := array_append(v_automation_names, format('[DEMO] Automation Rule #%s', i));
  end loop;

  for i in 1..2600 loop
    v_campaign_index := ((i - 1) % array_length(v_campaign_ids, 1)) + 1;
    v_customer_index := ((i * 11 - 1) % array_length(v_customer_ids, 1)) + 1;
    v_customer_id := v_customer_ids[v_customer_index];
    v_campaign_id := v_campaign_ids[v_campaign_index];

    v_outbound_channel := case
      when v_campaign_channels[v_campaign_index] = 'both' and i % 2 = 0 then 'email'
      when v_campaign_channels[v_campaign_index] = 'both' then 'sms'
      else v_campaign_channels[v_campaign_index]
    end;

    v_recipient := case
      when v_outbound_channel = 'email' then v_customer_emails[v_customer_index]
      else v_customer_phones[v_customer_index]
    end;

    if coalesce(v_recipient, '') = '' then
      continue;
    end if;

    v_created_at := now() - make_interval(days => i % 60, hours => i % 16);
    v_outbound_status := case
      when i % 17 = 0 then 'failed'
      when i % 7 = 0 then 'clicked'
      when i % 5 = 0 then 'opened'
      when v_outbound_channel = 'sms' and i % 4 = 0 then 'delivered'
      else 'sent'
    end;

    v_sent_at := case when v_outbound_status = 'failed' then null else v_created_at + interval '5 minutes' end;
    v_opened_at := case when v_outbound_status in ('opened', 'clicked') then v_sent_at + interval '2 hours' else null end;
    v_clicked_at := case when v_outbound_status = 'clicked' then v_sent_at + interval '3 hours' else null end;

    insert into outbound_messages (
      campaign_id,
      customer_id,
      channel,
      provider,
      recipient,
      subject,
      content,
      status,
      error_message,
      metadata,
      opened_at,
      clicked_at,
      sent_at,
      created_by,
      created_at,
      updated_at
    ) values (
      v_campaign_id,
      v_customer_id,
      v_outbound_channel,
      case when v_outbound_channel = 'email' then 'simulation-resend' else 'simulation-twilio' end,
      v_recipient,
      v_campaign_subjects[v_campaign_index],
      format('[DEMO] Outbound campaign message #%s', i),
      v_outbound_status,
      case when v_outbound_status = 'failed' then 'Provider simulation failure.' else null end,
      jsonb_build_object('seed', 'large-demo', 'group', 'campaign'),
      v_opened_at,
      v_clicked_at,
      v_sent_at,
      v_actor_id,
      v_created_at,
      v_created_at
    );
  end loop;

  for i in 1..600 loop
    v_automation_index := ((i - 1) % array_length(v_automation_ids, 1)) + 1;
    v_customer_index := ((i * 13 - 1) % array_length(v_customer_ids, 1)) + 1;
    v_customer_id := v_customer_ids[v_customer_index];
    v_automation_id := v_automation_ids[v_automation_index];
    v_outbound_channel := v_automation_channels[v_automation_index];
    v_recipient := case
      when v_outbound_channel = 'email' then v_customer_emails[v_customer_index]
      else v_customer_phones[v_customer_index]
    end;

    if coalesce(v_recipient, '') = '' then
      continue;
    end if;

    v_created_at := now() - make_interval(days => i % 45, hours => i % 12);
    v_outbound_status := case
      when i % 19 = 0 then 'failed'
      when i % 8 = 0 then 'clicked'
      when i % 6 = 0 then 'opened'
      when v_outbound_channel = 'sms' and i % 3 = 0 then 'delivered'
      else 'sent'
    end;

    v_sent_at := case when v_outbound_status = 'failed' then null else v_created_at + interval '10 minutes' end;
    v_opened_at := case when v_outbound_status in ('opened', 'clicked') then v_sent_at + interval '1 hour' else null end;
    v_clicked_at := case when v_outbound_status = 'clicked' then v_sent_at + interval '2 hours' else null end;

    insert into outbound_messages (
      automation_rule_id,
      customer_id,
      channel,
      provider,
      recipient,
      subject,
      content,
      status,
      error_message,
      metadata,
      opened_at,
      clicked_at,
      sent_at,
      created_by,
      created_at,
      updated_at
    ) values (
      v_automation_id,
      v_customer_id,
      v_outbound_channel,
      case when v_outbound_channel = 'email' then 'simulation-resend' else 'simulation-twilio' end,
      v_recipient,
      v_automation_names[v_automation_index],
      format('[DEMO] Outbound automation message #%s', i),
      v_outbound_status,
      case when v_outbound_status = 'failed' then 'Automation simulation failure.' else null end,
      jsonb_build_object('seed', 'large-demo', 'group', 'automation'),
      v_opened_at,
      v_clicked_at,
      v_sent_at,
      v_actor_id,
      v_created_at,
      v_created_at
    );
  end loop;

  update campaigns c
  set sent_count = agg.sent_count,
      opened_count = agg.opened_count,
      click_count = agg.click_count,
      failed_count = agg.failed_count,
      status = case when agg.sent_count > 0 then 'sent' else c.status end,
      sent_at = coalesce(c.sent_at, now()),
      updated_at = now()
  from (
    select
      om.campaign_id,
      count(*) filter (where om.status in ('sent','delivered','opened','clicked')) as sent_count,
      count(*) filter (where om.status in ('opened','clicked')) as opened_count,
      count(*) filter (where om.status = 'clicked') as click_count,
      count(*) filter (where om.status = 'failed') as failed_count
    from outbound_messages om
    where om.campaign_id is not null
    group by om.campaign_id
  ) agg
  where c.id = agg.campaign_id;

  update automation_rules ar
  set action_config = coalesce(ar.action_config, '{}'::jsonb) ||
      jsonb_build_object(
        'sent_count', agg.sent_count,
        'last_run_at', now()::text,
        'content', coalesce(ar.action_config ->> 'content', '')
      ),
      updated_at = now()
  from (
    select
      om.automation_rule_id,
      count(*) filter (where om.status <> 'failed') as sent_count
    from outbound_messages om
    where om.automation_rule_id is not null
    group by om.automation_rule_id
  ) agg
  where ar.id = agg.automation_rule_id;

  for i in 1..220 loop
    v_customer_index := ((i * 3 - 1) % array_length(v_customer_ids, 1)) + 1;
    v_selected_user_id := v_all_profiles[((i - 1) % v_all_count) + 1];
    v_created_at := now() - make_interval(days => i % 50, hours => i % 10);

    insert into audit_logs (
      user_id,
      action,
      entity_type,
      entity_id,
      old_data,
      new_data,
      created_at
    ) values (
      v_selected_user_id,
      'create',
      'customer_note',
      v_customer_ids[v_customer_index],
      null,
      jsonb_build_object(
        'customer_id', v_customer_ids[v_customer_index],
        'author_id', v_selected_user_id,
        'note_type', case i % 4 when 0 then 'call' when 1 then 'meeting' when 2 then 'internal' else 'general' end,
        'content', format('[DEMO] Ghi chu khach hang #%s duoc tao de test timeline.', i),
        'created_at', v_created_at,
        'message', '[DEMO] Them ghi chu khach hang'
      ),
      v_created_at
    );
  end loop;

  for i in 1..360 loop
    v_selected_user_id := v_all_profiles[((i - 1) % v_all_count) + 1];
    v_entity_type := case i % 6
      when 0 then 'ticket'
      when 1 then 'customer'
      when 2 then 'campaign'
      when 3 then 'transaction'
      when 4 then 'task'
      else 'deal'
    end;

    v_selected_id := case v_entity_type
      when 'ticket' then v_ticket_ids[((i * 5 - 1) % array_length(v_ticket_ids, 1)) + 1]
      when 'customer' then v_customer_ids[((i * 7 - 1) % array_length(v_customer_ids, 1)) + 1]
      when 'campaign' then v_campaign_ids[((i * 3 - 1) % array_length(v_campaign_ids, 1)) + 1]
      when 'task' then v_task_ids[((i * 11 - 1) % array_length(v_task_ids, 1)) + 1]
      when 'transaction' then v_transaction_ids[((i * 9 - 1) % array_length(v_transaction_ids, 1)) + 1]
      else v_deal_ids[((i * 13 - 1) % array_length(v_deal_ids, 1)) + 1]
    end;

    v_notification_type := case i % 4
      when 0 then 'info'
      when 1 then 'success'
      when 2 then 'warning'
      else 'error'
    end;

    insert into notifications (
      user_id,
      title,
      message,
      type,
      entity_type,
      entity_id,
      is_read,
      read_at,
      created_at
    ) values (
      v_selected_user_id,
      format('[DEMO] Thong bao #%s - %s', i, v_entity_type),
      format('Ban ghi thong bao mo phong #%s de test notification center va badge.', i),
      v_notification_type,
      v_entity_type,
      v_selected_id,
      i % 3 = 0,
      case when i % 3 = 0 then now() - make_interval(hours => i % 24) else null end,
      now() - make_interval(days => i % 20, hours => i % 12)
    );
  end loop;

  for i in 1..900 loop
    v_audit_action := case i % 3 when 0 then 'create' when 1 then 'update' else 'delete' end;
    v_entity_type := case i % 7
      when 0 then 'customer'
      when 1 then 'transaction'
      when 2 then 'ticket'
      when 3 then 'deal'
      when 4 then 'task'
      when 5 then 'campaign'
      else 'automation_run'
    end;

    v_selected_id := case v_entity_type
      when 'customer' then v_customer_ids[((i * 5 - 1) % array_length(v_customer_ids, 1)) + 1]
      when 'transaction' then v_transaction_ids[((i * 7 - 1) % array_length(v_transaction_ids, 1)) + 1]
      when 'ticket' then v_ticket_ids[((i * 11 - 1) % array_length(v_ticket_ids, 1)) + 1]
      when 'deal' then v_deal_ids[((i * 13 - 1) % array_length(v_deal_ids, 1)) + 1]
      when 'task' then v_task_ids[((i * 17 - 1) % array_length(v_task_ids, 1)) + 1]
      when 'campaign' then v_campaign_ids[((i * 19 - 1) % array_length(v_campaign_ids, 1)) + 1]
      else v_automation_ids[((i * 23 - 1) % array_length(v_automation_ids, 1)) + 1]
    end;

    insert into audit_logs (
      user_id,
      action,
      entity_type,
      entity_id,
      old_data,
      new_data,
      created_at
    ) values (
      v_all_profiles[((i - 1) % v_all_count) + 1],
      v_audit_action,
      v_entity_type,
      v_selected_id,
      case when v_audit_action <> 'create' then jsonb_build_object('message', format('[DEMO] Trang thai cu #%s', i)) else null end,
      jsonb_build_object(
        'message', format('[DEMO] Audit log #%s cho %s', i, v_entity_type),
        'seed', 'large-demo'
      ),
      now() - make_interval(days => i % 120, hours => i % 18)
    );
  end loop;
end $$;
