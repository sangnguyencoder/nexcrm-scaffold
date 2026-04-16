-- Large demo seed V2 for NexCRM current schema (multi-tenant).
-- Safe for local/dev only. Do not use in production.
-- Idempotent per seed signature: rerun will clear previous V2 rows in the selected org and re-seed.

do $$
declare
  v_seed_signature constant text := 'ops-v2-20260416-a1';
  v_seed_prefix constant text := '[SEED-V2]';
  v_demo_domain constant text := '@demo-seed-v2.nexcrm.local';
  v_now timestamptz := now();

  v_org_id uuid;
  v_actor_id uuid;

  v_all_profiles uuid[] := '{}'::uuid[];
  v_sales_profiles uuid[] := '{}'::uuid[];
  v_cskh_profiles uuid[] := '{}'::uuid[];
  v_marketing_profiles uuid[] := '{}'::uuid[];
  v_admin_profiles uuid[] := '{}'::uuid[];

  v_sales_count integer := 0;
  v_cskh_count integer := 0;
  v_marketing_count integer := 0;
  v_admin_count integer := 0;
  v_all_count integer := 0;

  v_tag_ids uuid[] := '{}'::uuid[];
  v_customer_ids uuid[] := '{}'::uuid[];
  v_transaction_ids uuid[] := '{}'::uuid[];
  v_ticket_ids uuid[] := '{}'::uuid[];
  v_deal_ids uuid[] := '{}'::uuid[];
  v_task_ids uuid[] := '{}'::uuid[];
  v_campaign_ids uuid[] := '{}'::uuid[];
  v_automation_ids uuid[] := '{}'::uuid[];

  v_customer_count integer := 0;
  v_ticket_count integer := 0;
  v_deal_count integer := 0;
  v_campaign_count integer := 0;
  v_automation_count integer := 0;

  v_tag_id uuid;
  v_customer_id uuid;
  v_transaction_id uuid;
  v_ticket_id uuid;
  v_deal_id uuid;
  v_task_id uuid;
  v_campaign_id uuid;
  v_automation_id uuid;
  v_user_id uuid;
  v_entity_id uuid;

  v_created_at timestamptz;
  v_due_at timestamptz;
  v_resolved_at timestamptz;
  v_completed_at timestamptz;
  v_sent_at timestamptz;
  v_delivered_at timestamptz;
  v_opened_at timestamptz;
  v_failed_at timestamptz;

  v_expected_close_date date;
  v_actual_close_date date;

  v_customer_source text;
  v_customer_type text;
  v_gender text;
  v_phone text;
  v_email text;
  v_title text;
  v_description text;
  v_ticket_status text;
  v_ticket_priority text;
  v_ticket_category text;
  v_ticket_channel text;
  v_transaction_status text;
  v_deal_stage text;
  v_task_status text;
  v_task_priority text;
  v_task_type text;
  v_campaign_status text;
  v_campaign_channel text;
  v_campaign_subject text;
  v_campaign_content text;
  v_recipient_status text;
  v_recipient_channel text;
  v_outbound_status text;
  v_action_type text;
  v_trigger_type text;
  v_template_subject text;
  v_template_content text;
  v_entity_type text;

  v_item_qty integer;
  v_unit_price numeric(15,2);
  v_total_amount numeric(15,2);
  v_items jsonb;
  v_target_segment jsonb;

  i integer;
  j integer;
begin
  -- Pick actor/admin profile and seed strictly in a single org.
  select p.id, p.org_id
  into v_actor_id, v_org_id
  from public.profiles p
  where p.deleted_at is null
    and coalesce(p.is_active, true) = true
  order by
    case when p.role in ('super_admin', 'admin', 'director') then 0 else 1 end,
    p.created_at asc
  limit 1;

  if v_actor_id is null or v_org_id is null then
    raise exception 'Khong tim thay profile active de seed demo. Hay tao user/profile truoc.';
  end if;

  -- Ensure app_settings exists for selected org (no ON CONFLICT dependency).
  if exists (select 1 from public.app_settings s where s.org_id = v_org_id) then
    update public.app_settings
    set
      deleted_at = null,
      pos_sync_interval = coalesce(pos_sync_interval, 30),
      timezone = coalesce(timezone, 'Asia/Ho_Chi_Minh'),
      currency = coalesce(currency, 'VND'),
      date_format = coalesce(date_format, 'DD/MM/YYYY'),
      updated_by = v_actor_id,
      updated_at = now()
    where org_id = v_org_id;
  else
    insert into public.app_settings (
      org_id,
      email_provider,
      email_from_name,
      email_from_address,
      pos_provider,
      pos_sync_interval,
      pos_sync_enabled,
      timezone,
      currency,
      date_format,
      updated_by
    )
    values (
      v_org_id,
      'resend',
      'NexCRM Demo',
      'noreply@demo-seed-v2.nexcrm.local',
      'custom',
      30,
      false,
      'Asia/Ho_Chi_Minh',
      'VND',
      'DD/MM/YYYY',
      v_actor_id
    );
  end if;

  select coalesce(array_agg(p.id order by p.created_at), '{}'::uuid[])
  into v_all_profiles
  from public.profiles p
  where p.org_id = v_org_id
    and p.deleted_at is null
    and coalesce(p.is_active, true) = true;

  v_all_count := coalesce(array_length(v_all_profiles, 1), 0);
  if v_all_count = 0 then
    raise exception 'Org % chua co profile active de gan ownership cho du lieu seed.', v_org_id;
  end if;

  select coalesce(array_agg(p.id order by p.created_at), '{}'::uuid[])
  into v_sales_profiles
  from public.profiles p
  where p.org_id = v_org_id
    and p.role = 'sales'
    and p.deleted_at is null
    and coalesce(p.is_active, true) = true;

  select coalesce(array_agg(p.id order by p.created_at), '{}'::uuid[])
  into v_cskh_profiles
  from public.profiles p
  where p.org_id = v_org_id
    and p.role = 'cskh'
    and p.deleted_at is null
    and coalesce(p.is_active, true) = true;

  select coalesce(array_agg(p.id order by p.created_at), '{}'::uuid[])
  into v_marketing_profiles
  from public.profiles p
  where p.org_id = v_org_id
    and p.role = 'marketing'
    and p.deleted_at is null
    and coalesce(p.is_active, true) = true;

  select coalesce(array_agg(p.id order by p.created_at), '{}'::uuid[])
  into v_admin_profiles
  from public.profiles p
  where p.org_id = v_org_id
    and p.role in ('super_admin', 'admin', 'director')
    and p.deleted_at is null
    and coalesce(p.is_active, true) = true;

  if coalesce(array_length(v_sales_profiles, 1), 0) = 0 then v_sales_profiles := v_all_profiles; end if;
  if coalesce(array_length(v_cskh_profiles, 1), 0) = 0 then v_cskh_profiles := v_all_profiles; end if;
  if coalesce(array_length(v_marketing_profiles, 1), 0) = 0 then v_marketing_profiles := v_all_profiles; end if;
  if coalesce(array_length(v_admin_profiles, 1), 0) = 0 then v_admin_profiles := v_all_profiles; end if;

  v_sales_count := coalesce(array_length(v_sales_profiles, 1), 0);
  v_cskh_count := coalesce(array_length(v_cskh_profiles, 1), 0);
  v_marketing_count := coalesce(array_length(v_marketing_profiles, 1), 0);
  v_admin_count := coalesce(array_length(v_admin_profiles, 1), 0);

  -- Clean only V2 rows in this org.
  delete from public.ticket_comments
  where org_id = v_org_id
    and content like v_seed_prefix || '%';

  delete from public.outbound_messages
  where org_id = v_org_id
    and (
      coalesce(subject, '') like v_seed_prefix || '%'
      or coalesce(content, '') like v_seed_prefix || '%'
      or lower(coalesce(recipient_email, '')) like '%' || v_demo_domain
    );

  delete from public.notifications
  where org_id = v_org_id
    and coalesce(data ->> 'seed_signature', '') = v_seed_signature;

  delete from public.audit_logs
  where org_id = v_org_id
    and coalesce(metadata ->> 'seed_signature', '') = v_seed_signature;

  delete from public.customer_tags ct
  using public.customers c
  where ct.org_id = v_org_id
    and c.org_id = v_org_id
    and ct.customer_id = c.id
    and coalesce(c.custom_fields ->> 'seed_signature', '') = v_seed_signature;

  delete from public.customer_notes cn
  using public.customers c
  where cn.org_id = v_org_id
    and c.org_id = v_org_id
    and cn.customer_id = c.id
    and coalesce(c.custom_fields ->> 'seed_signature', '') = v_seed_signature;

  delete from public.tasks
  where org_id = v_org_id
    and title like v_seed_prefix || '%';

  delete from public.deals
  where org_id = v_org_id
    and title like v_seed_prefix || '%';

  delete from public.support_tickets
  where org_id = v_org_id
    and title like v_seed_prefix || '%';

  delete from public.transactions
  where org_id = v_org_id
    and (
      invoice_code like 'SEED-%'
      or coalesce(notes, '') like v_seed_prefix || '%'
    );

  delete from public.campaign_recipients cr
  using public.campaigns c
  where cr.org_id = v_org_id
    and c.org_id = v_org_id
    and cr.campaign_id = c.id
    and c.name like v_seed_prefix || '%';

  delete from public.campaigns
  where org_id = v_org_id
    and name like v_seed_prefix || '%';

  delete from public.automation_rules
  where org_id = v_org_id
    and name like v_seed_prefix || '%';

  delete from public.tags
  where org_id = v_org_id
    and name like v_seed_prefix || '%';

  delete from public.customers
  where org_id = v_org_id
    and (
      coalesce(custom_fields ->> 'seed_signature', '') = v_seed_signature
      or lower(coalesce(email, '')) like '%' || v_demo_domain
    );

  -- Tags
  for i in 1..8 loop
    insert into public.tags (
      org_id,
      name,
      color,
      description,
      created_by,
      created_at,
      updated_at
    )
    values (
      v_org_id,
      format('%s TAG %s', v_seed_prefix, i),
      case (i % 6)
        when 0 then '#10b981'
        when 1 then '#3b82f6'
        when 2 then '#f59e0b'
        when 3 then '#ef4444'
        when 4 then '#8b5cf6'
        else '#14b8a6'
      end,
      format('Tag demo %s cho bo du lieu seed V2', i),
      v_actor_id,
      v_now - make_interval(days => i),
      v_now - make_interval(days => i)
    )
    returning id into v_tag_id;

    v_tag_ids := array_append(v_tag_ids, v_tag_id);
  end loop;

  -- Customers (large volume)
  for i in 1..240 loop
    v_created_at := v_now - make_interval(days => (i % 180), hours => (i % 11), mins => (i * 7) % 60);
    v_phone := '09' || lpad((10000000 + i)::text, 8, '0');
    v_email := format('seedv2.customer.%s%s', i, v_demo_domain);

    v_customer_source := case (i % 6)
      when 0 then 'direct'
      when 1 then 'marketing'
      when 2 then 'referral'
      when 3 then 'pos'
      when 4 then 'online'
      else 'other'
    end;

    v_customer_type := case
      when i % 20 = 0 then 'inactive'
      when i % 9 = 0 then 'vip'
      when i % 5 = 0 then 'loyal'
      when i % 2 = 0 then 'potential'
      else 'new'
    end;

    v_gender := case (i % 3)
      when 0 then 'male'
      when 1 then 'female'
      else 'other'
    end;

    insert into public.customers (
      org_id,
      full_name,
      phone,
      email,
      address,
      province,
      district,
      ward,
      date_of_birth,
      gender,
      customer_type,
      source,
      assigned_to,
      custom_fields,
      created_by,
      updated_by,
      created_at,
      updated_at
    )
    values (
      v_org_id,
      format('Khach Hang Demo V2 %s', i),
      v_phone,
      v_email,
      format('%s Duong So %s', 10 + (i % 90), i),
      case (i % 6)
        when 0 then 'TP. Ho Chi Minh'
        when 1 then 'Ha Noi'
        when 2 then 'Da Nang'
        when 3 then 'Can Tho'
        when 4 then 'Hai Phong'
        else 'Binh Duong'
      end,
      format('Quan/Huyen %s', (i % 12) + 1),
      format('Phuong/Xa %s', (i % 20) + 1),
      (date '1980-01-01' + ((i * 113) % 12000)),
      v_gender,
      v_customer_type,
      v_customer_source,
      v_sales_profiles[((i - 1) % v_sales_count) + 1],
      jsonb_build_object(
        'seed_signature', v_seed_signature,
        'seed_batch', 'large_demo_seed_v2',
        'seed_index', i
      ),
      v_actor_id,
      v_actor_id,
      v_created_at,
      v_created_at
    )
    returning id into v_customer_id;

    v_customer_ids := array_append(v_customer_ids, v_customer_id);

    if coalesce(array_length(v_tag_ids, 1), 0) > 0 then
      insert into public.customer_tags (
        org_id,
        customer_id,
        tag_id,
        created_by,
        created_at,
        updated_at
      )
      values (
        v_org_id,
        v_customer_id,
        v_tag_ids[((i - 1) % array_length(v_tag_ids, 1)) + 1],
        v_actor_id,
        v_created_at,
        v_created_at
      );

      if i % 4 = 0 and array_length(v_tag_ids, 1) > 1 then
        insert into public.customer_tags (
          org_id,
          customer_id,
          tag_id,
          created_by,
          created_at,
          updated_at
        )
        values (
          v_org_id,
          v_customer_id,
          v_tag_ids[((i + 1) % array_length(v_tag_ids, 1)) + 1],
          v_actor_id,
          v_created_at + interval '1 minute',
          v_created_at + interval '1 minute'
        );
      end if;
    end if;

    if i % 3 = 0 then
      insert into public.customer_notes (
        org_id,
        customer_id,
        author_id,
        note_type,
        content,
        is_pinned,
        created_at,
        updated_at
      )
      values (
        v_org_id,
        v_customer_id,
        v_all_profiles[((i - 1) % v_all_count) + 1],
        case (i % 4)
          when 0 then 'call'
          when 1 then 'meeting'
          when 2 then 'follow_up'
          else 'general'
        end,
        format('%s Note khach hang #%s (seed_signature=%s)', v_seed_prefix, i, v_seed_signature),
        (i % 12 = 0),
        v_created_at + interval '2 hour',
        v_created_at + interval '2 hour'
      );
    end if;
  end loop;

  v_customer_count := coalesce(array_length(v_customer_ids, 1), 0);
  if v_customer_count = 0 then
    raise exception 'Seed V2 khong tao duoc customers.';
  end if;

  -- Transactions
  for i in 1..640 loop
    v_customer_id := v_customer_ids[((i * 7 - 1) % v_customer_count) + 1];
    v_created_at := v_now - make_interval(days => (i % 150), hours => (i % 17), mins => (i * 11) % 60);
    v_item_qty := 1 + (i % 3);
    v_unit_price := (900000 + ((i % 10) * 175000))::numeric(15,2);
    v_total_amount := (v_item_qty * v_unit_price)::numeric(15,2);
    v_items := jsonb_build_array(
      jsonb_build_object(
        'name', format('Goi CRM %s', (i % 7) + 1),
        'qty', v_item_qty,
        'price', v_unit_price,
        'total', v_total_amount
      )
    );

    v_transaction_status := case
      when i % 17 = 0 then 'refunded'
      when i % 13 = 0 then 'cancelled'
      when i % 5 = 0 then 'pending'
      when i % 3 = 0 then 'processing'
      else 'completed'
    end;

    insert into public.transactions (
      org_id,
      customer_id,
      invoice_code,
      items,
      subtotal,
      total_amount,
      payment_method,
      payment_status,
      status,
      source,
      transaction_at,
      notes,
      processed_by,
      created_by,
      updated_by,
      created_at,
      updated_at
    )
    values (
      v_org_id,
      v_customer_id,
      format('SEED-%s-%s', to_char(v_created_at, 'YYMM'), lpad(i::text, 6, '0')),
      v_items,
      v_total_amount,
      v_total_amount,
      case (i % 5)
        when 0 then 'cash'
        when 1 then 'card'
        when 2 then 'transfer'
        when 3 then 'qr'
        else 'other'
      end,
      case
        when i % 17 = 0 then 'refunded'
        when i % 13 = 0 then 'cancelled'
        when i % 5 = 0 then 'pending'
        when i % 3 = 0 then 'partial'
        else 'paid'
      end,
      v_transaction_status,
      case (i % 3)
        when 0 then 'manual'
        when 1 then 'pos_sync'
        else 'api'
      end,
      v_created_at + interval '15 minute',
      format('%s Transaction seed #%s', v_seed_prefix, i),
      v_sales_profiles[((i - 1) % v_sales_count) + 1],
      v_actor_id,
      v_actor_id,
      v_created_at,
      v_created_at
    )
    returning id into v_transaction_id;

    v_transaction_ids := array_append(v_transaction_ids, v_transaction_id);
  end loop;

  -- Support tickets + comments
  for i in 1..220 loop
    v_customer_id := v_customer_ids[((i * 5 - 1) % v_customer_count) + 1];
    v_created_at := v_now - make_interval(days => (i % 90), hours => (i % 10), mins => (i * 9) % 60);

    v_ticket_status := case
      when i % 11 = 0 then 'closed'
      when i % 7 = 0 then 'resolved'
      when i % 5 = 0 then 'pending'
      when i % 3 = 0 then 'in_progress'
      else 'open'
    end;

    v_ticket_priority := case
      when i % 15 = 0 then 'urgent'
      when i % 6 = 0 then 'high'
      when i % 2 = 0 then 'medium'
      else 'low'
    end;

    v_ticket_category := case (i % 5)
      when 0 then 'complaint'
      when 1 then 'feedback'
      when 2 then 'inquiry'
      when 3 then 'return'
      else 'other'
    end;

    v_ticket_channel := case (i % 5)
      when 0 then 'phone'
      when 1 then 'email'
      when 2 then 'direct'
      when 3 then 'chat'
      else 'social'
    end;

    v_due_at := v_created_at + make_interval(hours => 12 + (i % 36));
    v_resolved_at := case
      when v_ticket_status in ('resolved', 'closed') then v_created_at + make_interval(hours => 4 + (i % 30))
      else null
    end;

    insert into public.support_tickets (
      org_id,
      customer_id,
      title,
      description,
      category,
      priority,
      channel,
      assigned_to,
      status,
      due_at,
      resolved_at,
      closed_at,
      satisfaction_score,
      created_by,
      updated_by,
      created_at,
      updated_at
    )
    values (
      v_org_id,
      v_customer_id,
      format('%s Ticket #%s', v_seed_prefix, i),
      format('Mo ta ticket demo %s cho kiem thu local volume lon.', i),
      v_ticket_category,
      v_ticket_priority,
      v_ticket_channel,
      v_cskh_profiles[((i - 1) % v_cskh_count) + 1],
      v_ticket_status,
      v_due_at,
      v_resolved_at,
      case when v_ticket_status = 'closed' then coalesce(v_resolved_at, v_due_at) + interval '1 hour' else null end,
      case when v_ticket_status in ('resolved', 'closed') then 4 + (i % 2) else null end,
      v_actor_id,
      v_actor_id,
      v_created_at,
      coalesce(v_resolved_at, v_created_at + interval '2 hour')
    )
    returning id into v_ticket_id;

    v_ticket_ids := array_append(v_ticket_ids, v_ticket_id);

    insert into public.ticket_comments (
      org_id,
      ticket_id,
      author_id,
      content,
      is_internal,
      created_at,
      updated_at
    )
    values (
      v_org_id,
      v_ticket_id,
      v_cskh_profiles[((i - 1) % v_cskh_count) + 1],
      format('%s Comment tiep nhan ticket #%s', v_seed_prefix, i),
      false,
      v_created_at + interval '20 minute',
      v_created_at + interval '20 minute'
    );

    insert into public.ticket_comments (
      org_id,
      ticket_id,
      author_id,
      content,
      is_internal,
      created_at,
      updated_at
    )
    values (
      v_org_id,
      v_ticket_id,
      v_admin_profiles[((i - 1) % v_admin_count) + 1],
      format('%s Internal update ticket #%s', v_seed_prefix, i),
      true,
      v_created_at + interval '90 minute',
      v_created_at + interval '90 minute'
    );
  end loop;

  v_ticket_count := coalesce(array_length(v_ticket_ids, 1), 0);

  -- Deals
  for i in 1..260 loop
    v_customer_id := v_customer_ids[((i * 9 - 1) % v_customer_count) + 1];
    v_created_at := v_now - make_interval(days => (i % 120), hours => (i % 9), mins => (i * 4) % 60);

    v_deal_stage := case
      when i % 19 = 0 then 'lost'
      when i % 11 = 0 then 'won'
      when i % 7 = 0 then 'negotiation'
      when i % 5 = 0 then 'proposal'
      when i % 3 = 0 then 'qualified'
      else 'lead'
    end;

    v_expected_close_date := (v_now::date + ((i % 45) + 3));
    v_actual_close_date := case
      when v_deal_stage in ('won', 'lost') then v_expected_close_date - ((i % 5) + 1)
      else null
    end;

    insert into public.deals (
      org_id,
      customer_id,
      title,
      description,
      stage,
      value,
      probability,
      expected_close_date,
      actual_close_date,
      lost_reason,
      assigned_to,
      created_by,
      created_at,
      updated_at
    )
    values (
      v_org_id,
      v_customer_id,
      format('%s Deal #%s', v_seed_prefix, i),
      format('Co hoi ban hang seed V2 #%s', i),
      v_deal_stage,
      (4500000 + ((i % 35) * 850000))::numeric(15,2),
      case v_deal_stage
        when 'lead' then 15
        when 'qualified' then 35
        when 'proposal' then 55
        when 'negotiation' then 75
        when 'won' then 100
        else 0
      end,
      v_expected_close_date,
      v_actual_close_date,
      case when v_deal_stage = 'lost' then 'Khach tam hoan ngan sach trong ky nay' else null end,
      v_sales_profiles[((i - 1) % v_sales_count) + 1],
      v_actor_id,
      v_created_at,
      v_created_at + interval '1 hour'
    )
    returning id into v_deal_id;

    v_deal_ids := array_append(v_deal_ids, v_deal_id);
  end loop;

  v_deal_count := coalesce(array_length(v_deal_ids, 1), 0);

  -- Tasks
  for i in 1..420 loop
    v_created_at := v_now - make_interval(days => (i % 80), hours => (i % 10), mins => (i * 6) % 60);
    v_due_at := v_created_at + make_interval(days => (i % 9) - 2, hours => (i % 12));

    v_task_status := case
      when i % 16 = 0 then 'cancelled'
      when i % 7 = 0 then 'done'
      when i % 3 = 0 then 'in_progress'
      else 'pending'
    end;

    v_task_priority := case
      when i % 11 = 0 then 'urgent'
      when i % 6 = 0 then 'high'
      when i % 2 = 0 then 'medium'
      else 'low'
    end;

    v_task_type := case (i % 6)
      when 0 then 'call'
      when 1 then 'email'
      when 2 then 'meeting'
      when 3 then 'follow_up'
      when 4 then 'demo'
      else 'other'
    end;

    v_completed_at := case when v_task_status = 'done' then v_due_at - interval '30 minute' else null end;

    if i % 3 = 0 then
      v_deal_id := v_deal_ids[((i * 5 - 1) % v_deal_count) + 1];
      v_customer_id := null;
      v_ticket_id := null;
    elsif i % 3 = 1 then
      v_deal_id := null;
      v_customer_id := v_customer_ids[((i * 4 - 1) % v_customer_count) + 1];
      v_ticket_id := null;
    else
      v_deal_id := null;
      v_customer_id := null;
      v_ticket_id := v_ticket_ids[((i * 3 - 1) % v_ticket_count) + 1];
    end if;

    insert into public.tasks (
      org_id,
      deal_id,
      customer_id,
      ticket_id,
      title,
      description,
      task_type,
      due_date,
      completed_at,
      status,
      priority,
      assigned_to,
      created_by,
      created_at,
      updated_at
    )
    values (
      v_org_id,
      v_deal_id,
      v_customer_id,
      v_ticket_id,
      format('%s Task #%s', v_seed_prefix, i),
      format('Cong viec demo #%s phuc vu kiem thu load/pagination/kanban.', i),
      v_task_type,
      v_due_at,
      v_completed_at,
      v_task_status,
      v_task_priority,
      v_all_profiles[((i - 1) % v_all_count) + 1],
      v_actor_id,
      v_created_at,
      v_created_at + interval '45 minute'
    )
    returning id into v_task_id;

    v_task_ids := array_append(v_task_ids, v_task_id);
  end loop;

  -- Campaigns
  for i in 1..24 loop
    v_created_at := v_now - make_interval(days => (i % 40), hours => (i % 8), mins => (i * 5) % 60);

    v_campaign_status := case
      when i % 13 = 0 then 'cancelled'
      when i % 7 = 0 then 'draft'
      when i % 5 = 0 then 'scheduled'
      when i % 3 = 0 then 'sending'
      else 'sent'
    end;

    v_campaign_channel := case (i % 3)
      when 0 then 'email'
      when 1 then 'sms'
      else 'both'
    end;

    v_campaign_subject := format('%s Campaign Subject #%s', v_seed_prefix, i);
    v_campaign_content := format('%s Noi dung campaign #%s cho {name} - {customer_code} - {date}', v_seed_prefix, i);
    v_target_segment := jsonb_build_object(
      'customer_type',
      case
        when i % 4 = 0 then 'vip'
        when i % 3 = 0 then 'loyal'
        when i % 2 = 0 then 'potential'
        else 'new'
      end,
      'seed_signature',
      v_seed_signature
    );

    insert into public.campaigns (
      org_id,
      name,
      description,
      channel,
      subject,
      content,
      target_segment,
      recipient_count,
      status,
      scheduled_at,
      sent_at,
      sent_count,
      opened_count,
      failed_count,
      created_by,
      updated_by,
      created_at,
      updated_at
    )
    values (
      v_org_id,
      format('%s Campaign #%s', v_seed_prefix, i),
      format('Chien dich demo V2 #%s', i),
      v_campaign_channel,
      v_campaign_subject,
      v_campaign_content,
      v_target_segment,
      0,
      v_campaign_status,
      case when v_campaign_status = 'scheduled' then v_now + make_interval(days => (i % 6) + 1) else null end,
      case when v_campaign_status in ('sending', 'sent') then v_created_at + interval '6 hour' else null end,
      0,
      0,
      0,
      v_marketing_profiles[((i - 1) % v_marketing_count) + 1],
      v_marketing_profiles[((i - 1) % v_marketing_count) + 1],
      v_created_at,
      v_created_at + interval '20 minute'
    )
    returning id into v_campaign_id;

    v_campaign_ids := array_append(v_campaign_ids, v_campaign_id);
  end loop;

  v_campaign_count := coalesce(array_length(v_campaign_ids, 1), 0);

  -- Campaign recipients + outbound message logs
  for i in 1..v_campaign_count loop
    v_campaign_id := v_campaign_ids[i];

    select c.channel, c.status, c.subject, c.content
    into v_campaign_channel, v_campaign_status, v_campaign_subject, v_campaign_content
    from public.campaigns c
    where c.org_id = v_org_id
      and c.id = v_campaign_id;

    for j in 1..35 loop
      v_customer_id := v_customer_ids[((i * 37 + j * 13 - 1) % v_customer_count) + 1];
      v_created_at := v_now - make_interval(days => (i % 20), hours => (j % 11), mins => (j * 3) % 60);

      if v_campaign_channel = 'both' then
        v_recipient_channel := case when j % 2 = 0 then 'email' else 'sms' end;
      elsif v_campaign_channel = 'email' then
        v_recipient_channel := 'email';
      else
        v_recipient_channel := 'sms';
      end if;

      v_recipient_status := case
        when v_campaign_status = 'draft' then 'pending'
        when v_campaign_status = 'cancelled' then 'failed'
        when j % 17 = 0 then 'failed'
        when j % 11 = 0 then 'bounced'
        when j % 7 = 0 then 'opened'
        when j % 3 = 0 then 'queued'
        else 'sent'
      end;

      v_delivered_at := case when v_recipient_status in ('sent', 'opened') then v_created_at + interval '4 minute' else null end;
      v_opened_at := case when v_recipient_status = 'opened' then v_created_at + interval '2 hour' else null end;
      v_failed_at := case when v_recipient_status in ('failed', 'bounced') then v_created_at + interval '5 minute' else null end;

      insert into public.campaign_recipients (
        org_id,
        campaign_id,
        customer_id,
        channel,
        recipient_email,
        recipient_phone,
        personalized_payload,
        status,
        delivered_at,
        opened_at,
        failed_at,
        error_message,
        created_at,
        updated_at
      )
      values (
        v_org_id,
        v_campaign_id,
        v_customer_id,
        v_recipient_channel,
        case when v_recipient_channel = 'email' then format('seedv2.customer.%s%s', ((i * 37 + j * 13 - 1) % v_customer_count) + 1, v_demo_domain) else null end,
        case when v_recipient_channel = 'sms' then '09' || lpad((10000000 + (((i * 37 + j * 13 - 1) % v_customer_count) + 1))::text, 8, '0') else null end,
        jsonb_build_object(
          'name', format('Khach Hang Demo V2 %s', ((i * 37 + j * 13 - 1) % v_customer_count) + 1),
          'customer_code', format('SEED-CODE-%s', ((i * 37 + j * 13 - 1) % v_customer_count) + 1),
          'seed_signature', v_seed_signature
        ),
        v_recipient_status,
        v_delivered_at,
        v_opened_at,
        v_failed_at,
        case when v_recipient_status in ('failed', 'bounced') then 'Provider temporary reject for demo payload' else null end,
        v_created_at,
        v_created_at
      );

      if v_recipient_status <> 'pending' then
        v_outbound_status := case
          when v_recipient_status in ('failed', 'bounced') then v_recipient_status
          when v_recipient_status = 'queued' then 'sending'
          else 'sent'
        end;

        v_sent_at := case when v_outbound_status in ('sending', 'sent') then v_created_at + interval '2 minute' else null end;

        insert into public.outbound_messages (
          org_id,
          customer_id,
          campaign_id,
          channel,
          recipient_email,
          recipient_phone,
          subject,
          content,
          status,
          sent_at,
          error_message,
          provider,
          provider_message_id,
          created_at,
          updated_at
        )
        values (
          v_org_id,
          v_customer_id,
          v_campaign_id,
          v_recipient_channel,
          case when v_recipient_channel = 'email' then format('seedv2.customer.%s%s', ((i * 37 + j * 13 - 1) % v_customer_count) + 1, v_demo_domain) else null end,
          case when v_recipient_channel = 'sms' then '09' || lpad((10000000 + (((i * 37 + j * 13 - 1) % v_customer_count) + 1))::text, 8, '0') else null end,
          format('%s OUTBOUND CAMPAIGN #%s-%s', v_seed_prefix, i, j),
          format('%s %s', v_seed_prefix, coalesce(v_campaign_content, 'Campaign content')),
          v_outbound_status,
          v_sent_at,
          case when v_outbound_status in ('failed', 'bounced') then 'Seed V2 simulated provider error' else null end,
          case when v_recipient_channel = 'email' then 'resend' else 'twilio' end,
          format('seedv2-cmp-%s-%s', i, j),
          v_created_at,
          v_created_at
        );
      end if;
    end loop;
  end loop;

  update public.campaigns c
  set
    recipient_count = s.total_count,
    sent_count = s.sent_count,
    opened_count = s.opened_count,
    failed_count = s.failed_count,
    sent_at = case when c.status in ('sending', 'sent') then coalesce(c.sent_at, s.last_delivered_at, now()) else c.sent_at end,
    updated_at = now()
  from (
    select
      cr.campaign_id,
      count(*) as total_count,
      count(*) filter (where cr.status in ('sent', 'opened')) as sent_count,
      count(*) filter (where cr.status = 'opened') as opened_count,
      count(*) filter (where cr.status in ('failed', 'bounced')) as failed_count,
      max(cr.delivered_at) as last_delivered_at
    from public.campaign_recipients cr
    where cr.org_id = v_org_id
      and cr.campaign_id = any(v_campaign_ids)
      and cr.deleted_at is null
    group by cr.campaign_id
  ) s
  where c.org_id = v_org_id
    and c.id = s.campaign_id;

  -- Automation rules
  for i in 1..12 loop
    v_created_at := v_now - make_interval(days => (i % 50), hours => (i % 7), mins => (i * 8) % 60);
    v_trigger_type := case (i % 4)
      when 0 then 'birthday'
      when 1 then 'inactive_days'
      when 2 then 'after_purchase'
      else 'new_customer'
    end;
    v_action_type := case when i % 2 = 0 then 'send_email' else 'send_sms' end;
    v_template_subject := format('%s AUTO SUBJECT #%s', v_seed_prefix, i);
    v_template_content := format('%s Mau noi dung automation #%s danh cho {name} ({customer_code})', v_seed_prefix, i);

    insert into public.automation_rules (
      org_id,
      name,
      description,
      trigger_type,
      trigger_config,
      action_type,
      template_subject,
      template_content,
      is_active,
      created_by,
      updated_by,
      created_at,
      updated_at
    )
    values (
      v_org_id,
      format('%s Automation Rule #%s', v_seed_prefix, i),
      format('Rule demo V2 #%s', i),
      v_trigger_type,
      case
        when v_trigger_type = 'inactive_days' then jsonb_build_object('days', 30 + (i % 15))
        when v_trigger_type = 'after_purchase' then jsonb_build_object('days', 3 + (i % 10))
        else '{}'::jsonb
      end,
      v_action_type,
      v_template_subject,
      v_template_content,
      (i % 6 <> 0),
      v_marketing_profiles[((i - 1) % v_marketing_count) + 1],
      v_marketing_profiles[((i - 1) % v_marketing_count) + 1],
      v_created_at,
      v_created_at
    )
    returning id into v_automation_id;

    v_automation_ids := array_append(v_automation_ids, v_automation_id);
  end loop;

  v_automation_count := coalesce(array_length(v_automation_ids, 1), 0);

  -- Outbound from automation
  for i in 1..260 loop
    v_automation_id := v_automation_ids[((i * 5 - 1) % v_automation_count) + 1];
    v_customer_id := v_customer_ids[((i * 9 - 1) % v_customer_count) + 1];
    v_created_at := v_now - make_interval(days => (i % 70), hours => (i % 9), mins => (i * 5) % 60);

    select ar.action_type, ar.template_subject, ar.template_content
    into v_action_type, v_template_subject, v_template_content
    from public.automation_rules ar
    where ar.org_id = v_org_id
      and ar.id = v_automation_id;

    v_recipient_channel := case when v_action_type = 'send_email' then 'email' else 'sms' end;

    v_outbound_status := case
      when i % 19 = 0 then 'failed'
      when i % 13 = 0 then 'bounced'
      when i % 4 = 0 then 'sending'
      else 'sent'
    end;

    v_sent_at := case when v_outbound_status in ('sending', 'sent') then v_created_at + interval '3 minute' else null end;

    insert into public.outbound_messages (
      org_id,
      customer_id,
      automation_rule_id,
      channel,
      recipient_email,
      recipient_phone,
      subject,
      content,
      status,
      sent_at,
      error_message,
      provider,
      provider_message_id,
      created_at,
      updated_at
    )
    values (
      v_org_id,
      v_customer_id,
      v_automation_id,
      v_recipient_channel,
      case when v_recipient_channel = 'email' then format('seedv2.customer.%s%s', ((i * 9 - 1) % v_customer_count) + 1, v_demo_domain) else null end,
      case when v_recipient_channel = 'sms' then '09' || lpad((10000000 + (((i * 9 - 1) % v_customer_count) + 1))::text, 8, '0') else null end,
      format('%s AUTO OUTBOUND #%s', v_seed_prefix, i),
      replace(coalesce(v_template_content, format('%s default automation content', v_seed_prefix)), '{name}', format('Khach Hang Demo V2 %s', ((i * 9 - 1) % v_customer_count) + 1)),
      v_outbound_status,
      v_sent_at,
      case when v_outbound_status in ('failed', 'bounced') then 'Seed V2 simulated automation provider failure' else null end,
      case when v_recipient_channel = 'email' then 'resend' else 'twilio' end,
      format('seedv2-auto-%s', i),
      v_created_at,
      v_created_at
    );
  end loop;

  update public.automation_rules ar
  set
    last_run_at = s.last_sent_at,
    updated_at = now()
  from (
    select
      om.automation_rule_id,
      max(om.sent_at) as last_sent_at
    from public.outbound_messages om
    where om.org_id = v_org_id
      and om.automation_rule_id = any(v_automation_ids)
      and om.deleted_at is null
    group by om.automation_rule_id
  ) s
  where ar.org_id = v_org_id
    and ar.id = s.automation_rule_id;

  -- Notifications
  for i in 1..360 loop
    v_user_id := v_all_profiles[((i - 1) % v_all_count) + 1];
    v_created_at := v_now - make_interval(days => (i % 45), hours => (i % 12), mins => (i * 7) % 60);

    insert into public.notifications (
      org_id,
      user_id,
      type,
      title,
      message,
      data,
      is_read,
      read_at,
      created_by,
      created_at,
      updated_at
    )
    values (
      v_org_id,
      v_user_id,
      case (i % 6)
        when 0 then 'ticket'
        when 1 then 'deal'
        when 2 then 'campaign'
        when 3 then 'automation'
        when 4 then 'task'
        else 'system'
      end,
      format('%s Notification #%s', v_seed_prefix, i),
      format('Thong bao demo local #%s cho kiem thu UI/filters/pagination.', i),
      jsonb_build_object(
        'seed_signature', v_seed_signature,
        'seed_index', i,
        'module', case (i % 5)
          when 0 then 'dashboard'
          when 1 then 'customers'
          when 2 then 'tickets'
          when 3 then 'campaigns'
          else 'pipeline'
        end
      ),
      (i % 4 = 0),
      case when i % 4 = 0 then v_created_at + interval '30 minute' else null end,
      v_actor_id,
      v_created_at,
      v_created_at
    );
  end loop;

  -- Audit logs
  for i in 1..520 loop
    v_created_at := v_now - make_interval(days => (i % 60), hours => (i % 10), mins => (i * 2) % 60);
    v_user_id := v_all_profiles[((i - 1) % v_all_count) + 1];

    v_entity_type := case (i % 6)
      when 0 then 'customers'
      when 1 then 'transactions'
      when 2 then 'support_tickets'
      when 3 then 'deals'
      when 4 then 'tasks'
      else 'campaigns'
    end;

    v_entity_id := case v_entity_type
      when 'customers' then v_customer_ids[((i * 3 - 1) % v_customer_count) + 1]
      when 'transactions' then v_transaction_ids[((i * 5 - 1) % array_length(v_transaction_ids, 1)) + 1]
      when 'support_tickets' then v_ticket_ids[((i * 7 - 1) % v_ticket_count) + 1]
      when 'deals' then v_deal_ids[((i * 11 - 1) % v_deal_count) + 1]
      when 'tasks' then v_task_ids[((i * 13 - 1) % array_length(v_task_ids, 1)) + 1]
      else v_campaign_ids[((i * 17 - 1) % v_campaign_count) + 1]
    end;

    insert into public.audit_logs (
      org_id,
      user_id,
      action,
      entity_type,
      entity_id,
      old_data,
      new_data,
      metadata,
      created_at,
      updated_at
    )
    values (
      v_org_id,
      v_user_id,
      case (i % 4)
        when 0 then 'CREATE'
        when 1 then 'UPDATE'
        when 2 then 'STATUS_CHANGE'
        else 'ASSIGN'
      end,
      v_entity_type,
      v_entity_id,
      jsonb_build_object('previous_value', format('seed-old-%s', i)),
      jsonb_build_object('current_value', format('seed-new-%s', i)),
      jsonb_build_object(
        'seed_signature', v_seed_signature,
        'seed_index', i,
        'source', 'large_demo_seed_v2.sql'
      ),
      v_created_at,
      v_created_at
    );
  end loop;

  raise notice
    'Seed V2 completed. org_id=%, customers=%, transactions=%, tickets=%, deals=%, tasks=%, campaigns=%, automation_rules=%',
    v_org_id,
    v_customer_count,
    array_length(v_transaction_ids, 1),
    v_ticket_count,
    v_deal_count,
    array_length(v_task_ids, 1),
    v_campaign_count,
    v_automation_count;
end $$;
