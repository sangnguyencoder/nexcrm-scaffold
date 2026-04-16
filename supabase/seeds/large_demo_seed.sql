-- LEGACY (schema cũ): file này không còn phù hợp schema hiện tại.
-- Dùng file mới: supabase/seeds/large_demo_seed_v2.sql
-- NexCRM operational seed dataset
-- Run this in Supabase SQL Editor on a non-production environment after schema + migrations.
-- Rerunnable: the script clears the previous seeded batch before inserting a fresh dataset.

do $$
declare
  v_seed_signature constant text := 'ops-20260404-a1';
  v_seed_email_domains constant text[] := array['northgrid.vn','blueharbor.vn','lamsonlogistics.vn','oranafoods.vn','vantiscare.vn','elevateworks.vn'];
  v_now timestamptz := now();
  v_existing_seed_control jsonb := '{}'::jsonb;

  v_all_profiles uuid[]; v_sales_profiles uuid[]; v_cskh_profiles uuid[]; v_marketing_profiles uuid[]; v_admin_profiles uuid[];
  v_all_count int; v_sales_count int; v_cskh_count int; v_marketing_count int; v_admin_count int;
  v_customer_ids uuid[] := '{}'::uuid[]; v_customer_created_ats timestamptz[] := '{}'::timestamptz[]; v_customer_emails text[] := '{}'::text[]; v_customer_phones text[] := '{}'::text[];
  v_transaction_ids uuid[] := '{}'::uuid[]; v_ticket_ids uuid[] := '{}'::uuid[]; v_deal_ids uuid[] := '{}'::uuid[]; v_task_ids uuid[] := '{}'::uuid[]; v_campaign_ids uuid[] := '{}'::uuid[]; v_automation_ids uuid[] := '{}'::uuid[]; v_notification_ids uuid[] := '{}'::uuid[]; v_outbound_message_ids uuid[] := '{}'::uuid[]; v_audit_ids uuid[] := '{}'::uuid[]; v_ticket_comment_ids uuid[] := '{}'::uuid[];
  v_cleanup_customer_ids uuid[] := '{}'::uuid[]; v_cleanup_transaction_ids uuid[] := '{}'::uuid[]; v_cleanup_ticket_ids uuid[] := '{}'::uuid[]; v_cleanup_deal_ids uuid[] := '{}'::uuid[]; v_cleanup_task_ids uuid[] := '{}'::uuid[]; v_cleanup_campaign_ids uuid[] := '{}'::uuid[]; v_cleanup_automation_ids uuid[] := '{}'::uuid[]; v_cleanup_notification_ids uuid[] := '{}'::uuid[]; v_cleanup_outbound_ids uuid[] := '{}'::uuid[]; v_cleanup_audit_ids uuid[] := '{}'::uuid[]; v_cleanup_ticket_comment_ids uuid[] := '{}'::uuid[]; v_selected_uuid_ids uuid[] := '{}'::uuid[];

  v_actor_id uuid; v_selected_user_id uuid; v_selected_id uuid; v_customer_id uuid; v_transaction_id uuid; v_ticket_id uuid; v_deal_id uuid; v_task_id uuid; v_campaign_id uuid; v_automation_id uuid; v_notification_id uuid; v_outbound_message_id uuid; v_audit_id uuid; v_ticket_comment_id uuid;
  v_customer_index int; v_campaign_index int; v_automation_index int; v_item_count int;
  v_created_at timestamptz; v_due_at timestamptz; v_resolved_at timestamptz; v_expected_close_at timestamptz; v_sent_at timestamptz; v_opened_at timestamptz; v_clicked_at timestamptz;
  v_payment_method text; v_payment_status text; v_transaction_status text; v_ticket_priority text; v_ticket_status text; v_ticket_category text; v_ticket_channel text; v_deal_stage text; v_task_status text; v_task_priority text; v_task_entity_type text; v_campaign_status text; v_campaign_channel text; v_automation_action_type text; v_outbound_channel text; v_outbound_status text; v_entity_type text; v_notification_type text; v_audit_action text;
  v_full_name text; v_email text; v_phone text; v_address_line text; v_title text; v_description text; v_resolution_note text; v_subject_line text; v_recipient text; v_note_type text; v_public_update text; v_internal_note text;
  v_discount_amount numeric(15,2); v_tax_amount numeric(15,2); v_subtotal_amount numeric(15,2); v_total_amount numeric(15,2); v_deal_value numeric(15,2); v_probability_value int; v_satisfaction int;
  v_items_payload jsonb; v_target_segment jsonb;

  v_customer_seed_count constant int := 18; v_transaction_seed_count constant int := 36; v_ticket_seed_count constant int := 10; v_deal_seed_count constant int := 10; v_task_seed_count constant int := 16; v_campaign_seed_count constant int := 5; v_automation_seed_count constant int := 4; v_campaign_message_seed_count constant int := 26; v_automation_message_seed_count constant int := 14; v_customer_note_seed_count constant int := 14; v_notification_seed_count constant int := 18; v_audit_seed_count constant int := 24;

  v_customer_names text[] := array['Nguyen Hoang An','Tran Bao Chau','Le Quoc Minh','Pham Thu Hang','Doan Gia Huy','Bui Lan Anh','Dang Nhat Quang','Hoang Kim Ngan','Vo Tuan Kiet','Phan My Linh','Ngo Duc Tai','Truong Thao Nguyen','Duong Minh Khoa','Huynh Thanh Tam','Do Phuong Vy','Ly Gia Han','Cao Anh Tuan','Tran Ngoc Bich'];
  v_customer_email_locals text[] := array['hoang.an','bao.chau','quoc.minh','thu.hang','gia.huy','lan.anh','nhat.quang','kim.ngan','tuan.kiet','my.linh','duc.tai','thao.nguyen','minh.khoa','thanh.tam','phuong.vy','gia.han','anh.tuan','ngoc.bich'];
  v_customer_email_domain_map text[] := array['northgrid.vn','blueharbor.vn','lamsonlogistics.vn','oranafoods.vn','vantiscare.vn','elevateworks.vn','northgrid.vn','blueharbor.vn','lamsonlogistics.vn','oranafoods.vn','vantiscare.vn','elevateworks.vn','northgrid.vn','blueharbor.vn','lamsonlogistics.vn','oranafoods.vn','vantiscare.vn','elevateworks.vn'];
  v_customer_phones_seed text[] := array['0903128451','0914826530','0986124725','0937245186','0865219473','0893372614','0942863157','0965142836','0972364518','0928453167','0885612473','0843927156','0836412759','0825147368','0817263549','0794836152','0782465139','0775326148'];
  v_customer_addresses text[] := array['18 Nguyen Hue, Quan 1','44 Tran Phu, Hai Chau','126 Pham Van Dong, Cau Giay','58 Le Loi, Ninh Kieu','22 Hai Ba Trung, Thanh Khe','93 Vo Thi Sau, Thu Dau Mot','145 Tran Hung Dao, Ha Long','31 Nguyen Thi Minh Khai, Nha Trang','76 Cach Mang Thang 8, Bien Hoa','14 Ly Tu Trong, Quan 1','52 Nguyen Van Cu, Hai Phong','87 Quang Trung, Vinh','11 Le Hong Phong, Hue','39 Hung Vuong, Thanh Hoa','63 Nguyen Trai, Buon Ma Thuot','27 Ho Tung Mau, Nam Tu Liem','118 Nguyen Oanh, Go Vap','49 Tran Cao Van, Son Tra'];
  v_customer_provinces_seed text[] := array['TP. Ho Chi Minh','Da Nang','Ha Noi','Can Tho','Da Nang','Binh Duong','Quang Ninh','Khanh Hoa','Dong Nai','TP. Ho Chi Minh','Hai Phong','Nghe An','Hue','Thanh Hoa','Dak Lak','Ha Noi','TP. Ho Chi Minh','Da Nang'];
  v_customer_birth_dates date[] := array[date '1988-02-14',date '1991-06-03',date '1987-11-22',date '1992-01-17',date '1989-09-05',date '1994-04-28',date '1986-12-09',date '1993-07-11',date '1990-05-26',date '1995-08-19',date '1988-10-01',date '1992-03-14',date '1987-06-21',date '1991-12-18',date '1996-02-27',date '1994-09-30',date '1989-04-10',date '1993-11-06'];
  v_customer_genders_seed text[] := array['male','female','male','female','male','female','male','female','male','female','male','female','male','female','female','female','male','female'];
  v_customer_types_seed text[] := array['vip','loyal','loyal','potential','vip','loyal','potential','new','potential','new','loyal','potential','new','inactive','new','vip','loyal','potential'];
  v_customer_sources_seed text[] := array['referral','marketing','direct','online','pos','marketing','referral','online','direct','marketing','pos','direct','online','other','referral','marketing','direct','online'];
  v_customer_age_days int[] := array[182,171,164,153,146,131,123,110,97,89,76,68,55,49,35,22,14,7];

  v_products text[] := array['CRM Growth 10 users','CRM Enterprise 25 users','Automation add-on','CSKH workspace add-on','POS omnichannel integration','Advanced management reports','SMS package 50,000','Email package 30,000','Branch dashboard bundle','Zalo OA integration'];
  v_transaction_notes_seed text[] := array['Gia han hop dong van hanh quy II.','Bo sung them tai khoan cho nhom kinh doanh.','Thanh toan dot 1 theo phu luc hop dong.','Khach yeu cau xuat hoa don trong ngay.','Mua them bao cao quan tri cho cap quan ly vung.','Tang han muc gui SMS cham soc sau ban.','Phi trien khai cho chi nhanh moi.','Gia han goi CSKH cho cua hang trong diem.','Dieu chinh so luong user theo headcount moi.','Bo sung tich hop POS cho khu vuc mien Trung.'];
  v_ticket_titles_seed text[] := array['Dong bo don hang tu POS bi cham sau 18h','Khong nhan duoc email xac nhan sau khi tao giao dich','Can dieu chinh quyen xem bao cao cho quan ly chi nhanh','Yeu cau doi nguoi phu trach cham soc khach hang','Phieu hoan tra chua cap nhat ve CRM','Tep import khach hang bao loi cot so dien thoai','Khach yeu cau xuat lai hoa don dien tu','Lich nhac viec bi lech mui gio tren mobile','Muon kich hoat them kenh Zalo OA cho chi nhanh moi','Can kiem tra ly do chien dich SMS co ty le fail tang'];
  v_ticket_descriptions_seed text[] := array['Sau 18h, du lieu tu he thong POS ve CRM cap nhat cham hon thong le va anh huong den bao cao cuoi ngay.','Khach hang da tao giao dich thanh cong nhung khong nhan duoc email thong bao cho dau moi phu trach.','Can cap quyen xem dashboard doanh thu va pipeline cho quan ly cua chi nhanh moi ma khong mo rong quyen sua.','Khach hang de nghi thay doi dau moi cham soc tu thang nay vi co thay doi co cau nhan su noi bo.','Don hoan tra da xac nhan tai cua hang nhung trang thai tren CRM van chua dong bo.','Khi import file danh sach khach hang, he thong tra ve loi dinh dang cot so dien thoai o mot so dong.','Khach can xuat lai hoa don dien tu theo thong tin ma so thue moi duoc cap nhat.','Nguoi dung mobile phan anh lich nhac viec hien thi lech gio so voi giao dien desktop.','Chi nhanh moi can ket noi them kenh Zalo OA de tiep nhan hoi dap va thong bao trang thai don hang.','Ty le fail cua chien dich SMS tang trong 2 dot gui gan day, can xac minh nguon loi va danh sach so dien thoai.'];
  v_ticket_categories_seed text[] := array['inquiry','inquiry','feedback','other','return','other','other','complaint','inquiry','complaint'];
  v_ticket_priorities_seed text[] := array['high','medium','medium','low','high','medium','urgent','low','medium','high'];
  v_ticket_channels_seed text[] := array['phone','email','direct','chat','email','other','email','chat','phone','social'];
  v_ticket_statuses_seed text[] := array['resolved','in_progress','resolved','open','pending','closed','open','resolved','in_progress','pending'];
  v_ticket_age_days int[] := array[27,24,20,18,15,11,8,6,3,1];
  v_ticket_resolution_notes_seed text[] := array['Da dong bo lai queue POS va xac nhan du lieu ve day du.',null,'Da cap quyen xem bao cao cho nhom quan ly chi nhanh.',null,null,'Da lam sach tep import va cap nhat lai bo map cot du lieu.',null,'Da sua cau hinh mui gio tren ung dung mobile va dong bo lai lich nhac.',null,null];
  v_deal_titles_seed text[] := array['Gia han goi Enterprise cho khoi van hanh mien Trung','Mo them 15 tai khoan cho chi nhanh Binh Duong','Trien khai module automation cho doi telesales','Bo sung tich hop POS cho chuoi cua hang moi','Nang cap bao cao quan tri cho cap quan ly vung','Chuan hoa pipeline ban si cho nhom doi tac','Gia tang han muc SMS cham soc sau ban','Goi cham soc nang cao cho doi ho tro ky thuat','Trien khai CRM cho showroom moi tai Hai Phong','Nang cap phan quyen quan tri cho bo phan kiem soat'];
  v_deal_descriptions_seed text[] := array['Khach hang dang doi PO cuoi cung truoc khi chot phu luc gia han trong thang nay.','Chi nhanh moi can them tai khoan va bo role cho nhom kinh doanh tai khu vuc phia Nam.','Doanh nghiep can tu dong hoa chuoi cham soc sau lead de giam tai cho nhom telesales.','Chuoi cua hang moi can dong bo du lieu ban hang ve CRM trong giai doan khai truong.','Bo phan dieu hanh can them dashboard doanh thu, ticket va cong viec theo tung vung.','Khach muon chuan hoa lai pipeline va quy trinh phan bo co hoi cho nhom doi tac.','Doanh nghiep can them han muc SMS cho cac kich ban nhac no va cham soc sau ban.','Doi ho tro can them workspace va template xu ly cho ticket ky thuat.','Showroom moi tai Hai Phong du kien van hanh trong thang toi va can setup CRM tu dau.','Bo phan kiem soat noi bo can tang muc phan quyen cho quy trinh phe duyet du lieu.'];
  v_deal_stages_seed text[] := array['negotiation','proposal','qualified','won','lead','lost','proposal','negotiation','qualified','lead'];
  v_deal_values_seed numeric[] := array[48000000,26000000,18000000,33000000,21000000,16000000,12000000,14000000,28000000,19000000];
  v_deal_age_days int[] := array[36,31,27,52,18,47,15,9,6,2];
  v_task_titles_seed text[] := array['Goi xac nhan lich trien khai tuan nay','Gui lai proposal co cap nhat so luong user','Kiem tra nhat ky API POS cua ca toi','Chot danh sach nguoi dung can phan quyen','Nhac khach hoan tat thong tin xuat hoa don','Ra soat ty le fail cua chien dich SMS gan nhat','Xac nhan bien ban nghiem thu voi khach hang','Cap nhat ticket dang cho phan hoi bo phan ky thuat','Theo doi co hoi sap sang giai doan bao gia','Chuan bi bao cao doanh thu theo tinh','Gui tai lieu onboarding cho khach moi','Kiem tra ticket hoan tra truoc han SLA','Nhac khach duyet phu luc gia han','Tong hop yeu cau con mo cua khu vuc mien Trung','Theo doi thanh toan dot 2 cua hop dong','Dong bo lai khach hang vua import hom nay'];
  v_task_descriptions_seed text[] := array['Lien he dau moi van hanh de xac nhan lai timeline va dau viec tuan nay.','Cap nhat de xuat theo headcount moi va gui lai cho nguoi phe duyet.','Ra soat request timeout va luong don hang ton trong queue ban toi.','Khoi tao role cho nhom moi va ghi nhan user se su dung trong thang nay.','Khach da gui thong tin mot phan, can nhac bo sung de xuat hoa don dung tien do.','Doi chieu bao cao gui SMS voi danh sach so dien thoai fail de tach nguyen nhan.','Thu thap phan hoi sau nghiem thu va chot cac muc can dieu chinh cuoi cung.','Can co phan hoi ky thuat truoc 17h de giu dung cam ket SLA.','Theo sat co hoi dang co tin hieu chuyen sang bao gia trong tuan nay.','Tong hop nhanh doanh thu, ticket va task de gui cap quan ly vung.','Gui bo tai lieu thao tac co ban cho dau moi vua tiep nhan he thong.','Kiem tra lai ticket hoan tra co nguy co qua han de uu tien xu ly.','Nhac lai dau moi phe duyet phu luc gia han truoc cuoc hop chieu mai.','Tong hop cac dau viec ton dong cua khu vuc mien Trung cho buoi handoff.','Theo doi lich thanh toan dot 2 va cap nhat ngay khi nhan duoc chung tu.','Kiem tra lai ban ghi moi import va xu ly cac dong can bo sung du lieu.'];
  v_task_statuses_seed text[] := array['done','in_progress','todo','in_progress','todo','overdue','done','in_progress','todo','done','todo','overdue','in_progress','todo','in_progress','done'];
  v_task_priorities_seed text[] := array['high','medium','high','medium','medium','high','medium','high','medium','low','medium','high','high','medium','high','low'];
  v_task_entity_types_seed text[] := array['deal','deal','transaction','customer','transaction','customer','ticket','ticket','deal','customer','customer','ticket','deal','customer','transaction','customer'];
  v_task_age_days int[] := array[14,12,10,9,8,7,6,5,4,4,3,2,2,1,1,0];
  v_campaign_names_seed text[] := array['Tai kich hoat nhom khach hang im lang 30 ngay','Nhac gia han goi doanh nghiep dau quy II','Khao sat sau trien khai cho khach hang moi','Uu dai nang cap quan ly da chi nhanh','Cap nhat chinh sach chiet khau cho doi tac ban si'];
  v_campaign_descriptions_seed text[] := array['Tap trung vao nhom khach hang da 30 ngay chua phat sinh giao dich moi.','Gui nhac gia han den nhom khach hang doanh nghiep co hop dong sap den ky gia han.','Thu thap phan hoi tu nhom khach vua onboard de cai thien quy trinh ban giao.','Thong bao chuong trinh nang cap cho doanh nghiep dang mo rong so chi nhanh.','Thong bao dieu chinh chinh sach chiet khau cho nhom doi tac va kenh ban si.'];
  v_campaign_channels_seed text[] := array['email','both','email','sms','email'];
  v_campaign_subjects_seed text[] := array['Mau van hanh moi cho nhom khach hang tam ngung','Thong tin gia han goi doanh nghiep quy II','Danh gia nhanh sau 14 ngay van hanh','Uu dai nang cap quan ly da chi nhanh','Thong bao cap nhat chiet khau doi tac'];
  v_campaign_contents_seed text[] := array['Xin chao {ten_khach_hang}, doi ngu van hanh da chuan bi mot goi toi uu de giup doanh nghiep quay lai nhom cham soc chu dong trong thang nay.','Xin chao {ten_khach_hang}, hop dong cua doanh nghiep dang sap den ky gia han. Doi ngu phu trach da san sang cap nhat lai nhu cau va lich trien khai cho quy moi.','Xin chao {ten_khach_hang}, doi ngu mong nhan duoc danh gia ngan ve 14 ngay van hanh dau tien de tiep tuc toi uu quy trinh cho doanh nghiep.','Xin chao {ten_khach_hang}, doanh nghiep dang duoc ap dung uu dai nang cap quan ly da chi nhanh neu hoan tat trong khung thoi gian hien tai.','Xin chao {ten_khach_hang}, chinh sach chiet khau doi tac da duoc dieu chinh cho dot ban moi. Doi ngu kinh doanh se gui chi tiet den dau moi phu trach.'];
  v_campaign_statuses_seed text[] := array['sent','sending','scheduled','draft','cancelled'];
  v_campaign_age_days int[] := array[42,19,7,3,11];
  v_automation_names_seed text[] := array['Nhac cham soc sau 7 ngay khong phat sinh','Onboarding sau giao dich dau tien','Chuc mung sinh nhat khach hang than thiet','Kich hoat lai khach hang 45 ngay chua mua'];
  v_automation_descriptions_seed text[] := array['Gui nhac cham soc lai sau 7 ngay khong co giao dich moi.','Tu dong gui huong dan va dau moi ho tro sau giao dich dau tien.','Gui thong diep chuc mung va uu dai nho cho nhom khach hang than thiet.','Tu dong goi lai nhom khach hang 45 ngay chua co phat sinh moi.'];
  v_automation_trigger_types_seed text[] := array['inactive_days','new_customer','birthday','inactive_days'];
  v_automation_action_types_seed text[] := array['send_sms','send_email','send_email','send_sms'];
  v_automation_days_seed int[] := array[7,0,0,45];
  v_automation_summaries_seed text[] := array['Gui SMS nhac doi cham soc lien he lai sau 7 ngay.','Gui email onboarding sau giao dich dau tien.','Gui email chuc mung sinh nhat cho nhom than thiet.','Gui SMS kich hoat lai khach hang 45 ngay chua mua.'];
  v_automation_contents_seed text[] := array['Xin chao {ten_khach_hang}, doi ngu dang theo doi de dam bao doanh nghiep khong bo lo cac dau viec sau mua. Neu can ho tro, hay phan hoi lai ngay cho chung toi.','Xin chao {ten_khach_hang}, chao mung doanh nghiep da bat dau van hanh voi NexCRM. Doi ngu da chuan bi tai lieu, dau moi ho tro va lich kiem tra sau trien khai.','Xin chao {ten_khach_hang}, doi ngu gui loi chuc sinh nhat va mot uu dai nho danh rieng cho nhom khach hang than thiet trong thang nay.','Xin chao {ten_khach_hang}, doi ngu da nhan thay doanh nghiep chua co giao dich moi trong 45 ngay. Neu can ho tro toi uu quy trinh, hay phan hoi lai de duoc uu tien xu ly.'];
  v_automation_age_days int[] := array[54,41,28,16];
begin
  select coalesce(array_agg(p.id order by p.created_at), '{}'::uuid[]) into v_all_profiles from profiles p where coalesce(p.is_active, true) = true;
  v_all_count := coalesce(array_length(v_all_profiles, 1), 0);
  if v_all_count = 0 then raise exception 'Khong tim thay profile nao. Tao auth user + profiles truoc khi chay operational seed.'; end if;

  select coalesce(array_agg(p.id order by p.created_at), '{}'::uuid[]) into v_sales_profiles from profiles p where p.role = 'sales' and coalesce(p.is_active, true) = true;
  select coalesce(array_agg(p.id order by p.created_at), '{}'::uuid[]) into v_cskh_profiles from profiles p where p.role = 'cskh' and coalesce(p.is_active, true) = true;
  select coalesce(array_agg(p.id order by p.created_at), '{}'::uuid[]) into v_marketing_profiles from profiles p where p.role = 'marketing' and coalesce(p.is_active, true) = true;
  select coalesce(array_agg(p.id order by p.created_at), '{}'::uuid[]) into v_admin_profiles from profiles p where p.role in ('super_admin','admin','director') and coalesce(p.is_active, true) = true;
  if coalesce(array_length(v_sales_profiles, 1), 0) = 0 then v_sales_profiles := v_all_profiles; end if;
  if coalesce(array_length(v_cskh_profiles, 1), 0) = 0 then v_cskh_profiles := v_all_profiles; end if;
  if coalesce(array_length(v_marketing_profiles, 1), 0) = 0 then v_marketing_profiles := v_all_profiles; end if;
  if coalesce(array_length(v_admin_profiles, 1), 0) = 0 then v_admin_profiles := v_all_profiles; end if;
  v_sales_count := coalesce(array_length(v_sales_profiles, 1), 0); v_cskh_count := coalesce(array_length(v_cskh_profiles, 1), 0); v_marketing_count := coalesce(array_length(v_marketing_profiles, 1), 0); v_admin_count := coalesce(array_length(v_admin_profiles, 1), 0); v_actor_id := v_admin_profiles[1];

  update profiles p set avatar_url = case p.role when 'super_admin' then '/avatars/default-super-admin.svg' when 'admin' then '/avatars/default-admin.svg' when 'director' then '/avatars/default-director.svg' when 'sales' then '/avatars/default-sales.svg' when 'cskh' then '/avatars/default-cskh.svg' when 'marketing' then '/avatars/default-marketing.svg' else p.avatar_url end, updated_at = now() where coalesce(p.avatar_url, '') = '';
  insert into app_settings (id, company_name, plan, created_by) values ('default', 'NexCRM', 'Free', v_actor_id) on conflict (id) do nothing;
  update app_settings s
  set company_name = case when coalesce(s.company_name, '') = '' or s.company_name ilike '%demo%' then 'NexCRM' else s.company_name end,
      logo_url = case when coalesce(s.logo_url, '') like '%demo-company-logo.svg' then null else s.logo_url end,
      integrations = jsonb_set(jsonb_set(jsonb_set(coalesce(s.integrations, '{}'::jsonb), '{email_provider,from_name}', to_jsonb(case when coalesce(s.integrations #>> '{email_provider,from_name}', '') in ('', 'NexCRM Demo') then 'NexCRM' else s.integrations #>> '{email_provider,from_name}' end), true), '{email_provider,from_email}', to_jsonb(case when coalesce(s.integrations #>> '{email_provider,from_email}', '') in ('', 'hello@demo.nexcrm.vn') then 'support@nexcrm.vn' else s.integrations #>> '{email_provider,from_email}' end), true), '{email_provider,reply_to}', to_jsonb(case when coalesce(s.integrations #>> '{email_provider,reply_to}', '') in ('', 'support@demo.nexcrm.vn') then 'support@nexcrm.vn' else s.integrations #>> '{email_provider,reply_to}' end), true),
      updated_at = now()
  where s.id = 'default';
  select coalesce(s.integrations -> 'seed_control', '{}'::jsonb) into v_existing_seed_control from app_settings s where s.id = 'default';

  select coalesce(array_agg(elements.value::uuid), '{}'::uuid[]) into v_cleanup_customer_ids from jsonb_array_elements_text(coalesce(v_existing_seed_control -> 'customer_ids', '[]'::jsonb)) as elements(value);
  select coalesce(array_agg(elements.value::uuid), '{}'::uuid[]) into v_cleanup_transaction_ids from jsonb_array_elements_text(coalesce(v_existing_seed_control -> 'transaction_ids', '[]'::jsonb)) as elements(value);
  select coalesce(array_agg(elements.value::uuid), '{}'::uuid[]) into v_cleanup_ticket_ids from jsonb_array_elements_text(coalesce(v_existing_seed_control -> 'ticket_ids', '[]'::jsonb)) as elements(value);
  select coalesce(array_agg(elements.value::uuid), '{}'::uuid[]) into v_cleanup_deal_ids from jsonb_array_elements_text(coalesce(v_existing_seed_control -> 'deal_ids', '[]'::jsonb)) as elements(value);
  select coalesce(array_agg(elements.value::uuid), '{}'::uuid[]) into v_cleanup_task_ids from jsonb_array_elements_text(coalesce(v_existing_seed_control -> 'task_ids', '[]'::jsonb)) as elements(value);
  select coalesce(array_agg(elements.value::uuid), '{}'::uuid[]) into v_cleanup_campaign_ids from jsonb_array_elements_text(coalesce(v_existing_seed_control -> 'campaign_ids', '[]'::jsonb)) as elements(value);
  select coalesce(array_agg(elements.value::uuid), '{}'::uuid[]) into v_cleanup_automation_ids from jsonb_array_elements_text(coalesce(v_existing_seed_control -> 'automation_ids', '[]'::jsonb)) as elements(value);
  select coalesce(array_agg(elements.value::uuid), '{}'::uuid[]) into v_cleanup_notification_ids from jsonb_array_elements_text(coalesce(v_existing_seed_control -> 'notification_ids', '[]'::jsonb)) as elements(value);
  select coalesce(array_agg(elements.value::uuid), '{}'::uuid[]) into v_cleanup_outbound_ids from jsonb_array_elements_text(coalesce(v_existing_seed_control -> 'outbound_message_ids', '[]'::jsonb)) as elements(value);
  select coalesce(array_agg(elements.value::uuid), '{}'::uuid[]) into v_cleanup_audit_ids from jsonb_array_elements_text(coalesce(v_existing_seed_control -> 'audit_ids', '[]'::jsonb)) as elements(value);
  select coalesce(array_agg(elements.value::uuid), '{}'::uuid[]) into v_cleanup_ticket_comment_ids from jsonb_array_elements_text(coalesce(v_existing_seed_control -> 'ticket_comment_ids', '[]'::jsonb)) as elements(value);

  select coalesce(array_agg(c.id), '{}'::uuid[]) into v_selected_uuid_ids from customers c where split_part(coalesce(c.email, ''), '@', 2) = any(v_seed_email_domains) or coalesce(c.email, '') like '%@demo-seed.nexcrm.vn'; v_cleanup_customer_ids := v_cleanup_customer_ids || v_selected_uuid_ids;
  select coalesce(array_agg(c.id), '{}'::uuid[]) into v_selected_uuid_ids from campaigns c where coalesce(c.target_segment ->> '_seed_signature', '') = v_seed_signature or c.name like '[DEMO] %'; v_cleanup_campaign_ids := v_cleanup_campaign_ids || v_selected_uuid_ids;
  select coalesce(array_agg(ar.id), '{}'::uuid[]) into v_selected_uuid_ids from automation_rules ar where coalesce(ar.action_config ->> '_seed_signature', '') = v_seed_signature or ar.name like '[DEMO] %'; v_cleanup_automation_ids := v_cleanup_automation_ids || v_selected_uuid_ids;
  select coalesce(array_agg(tr.id), '{}'::uuid[]) into v_selected_uuid_ids from transactions tr where tr.customer_id = any(v_cleanup_customer_ids) or coalesce(tr.notes, '') like '[DEMO] %'; v_cleanup_transaction_ids := v_cleanup_transaction_ids || v_selected_uuid_ids;
  select coalesce(array_agg(st.id), '{}'::uuid[]) into v_selected_uuid_ids from support_tickets st where st.customer_id = any(v_cleanup_customer_ids) or st.title like '[DEMO] %'; v_cleanup_ticket_ids := v_cleanup_ticket_ids || v_selected_uuid_ids;
  select coalesce(array_agg(d.id), '{}'::uuid[]) into v_selected_uuid_ids from deals d where d.customer_id = any(v_cleanup_customer_ids) or d.title like '[DEMO] %'; v_cleanup_deal_ids := v_cleanup_deal_ids || v_selected_uuid_ids;
  select coalesce(array_agg(t.id), '{}'::uuid[]) into v_selected_uuid_ids from tasks t where t.id = any(v_cleanup_task_ids) or t.entity_id = any(v_cleanup_customer_ids || v_cleanup_transaction_ids || v_cleanup_ticket_ids || v_cleanup_deal_ids || v_cleanup_campaign_ids) or t.title like '[DEMO] %'; v_cleanup_task_ids := v_cleanup_task_ids || v_selected_uuid_ids;
  select coalesce(array_agg(tc.id), '{}'::uuid[]) into v_selected_uuid_ids from ticket_comments tc where tc.ticket_id = any(v_cleanup_ticket_ids); v_cleanup_ticket_comment_ids := v_cleanup_ticket_comment_ids || v_selected_uuid_ids;
  select coalesce(array_agg(om.id), '{}'::uuid[]) into v_selected_uuid_ids from outbound_messages om where om.id = any(v_cleanup_outbound_ids) or om.customer_id = any(v_cleanup_customer_ids) or om.campaign_id = any(v_cleanup_campaign_ids) or om.automation_rule_id = any(v_cleanup_automation_ids) or coalesce(om.metadata ->> '_seed_signature', '') = v_seed_signature or coalesce(om.metadata ->> 'seed', '') = 'compact-demo'; v_cleanup_outbound_ids := v_cleanup_outbound_ids || v_selected_uuid_ids;
  select coalesce(array_agg(n.id), '{}'::uuid[]) into v_selected_uuid_ids from notifications n where n.id = any(v_cleanup_notification_ids) or n.entity_id = any(v_cleanup_customer_ids || v_cleanup_transaction_ids || v_cleanup_ticket_ids || v_cleanup_deal_ids || v_cleanup_task_ids || v_cleanup_campaign_ids || v_cleanup_automation_ids) or n.title like '[DEMO] %'; v_cleanup_notification_ids := v_cleanup_notification_ids || v_selected_uuid_ids;
  select coalesce(array_agg(al.id), '{}'::uuid[]) into v_selected_uuid_ids from audit_logs al where al.id = any(v_cleanup_audit_ids) or al.entity_id = any(v_cleanup_customer_ids || v_cleanup_transaction_ids || v_cleanup_ticket_ids || v_cleanup_deal_ids || v_cleanup_task_ids || v_cleanup_campaign_ids || v_cleanup_automation_ids) or coalesce(al.new_data ->> '_seed_signature', '') = v_seed_signature or coalesce(al.old_data ->> '_seed_signature', '') = v_seed_signature or coalesce(al.new_data ->> 'seed', '') = 'compact-demo' or coalesce(al.old_data ->> 'seed', '') = 'compact-demo' or coalesce(al.new_data ->> 'message', '') like '[DEMO] %' or coalesce(al.old_data ->> 'message', '') like '[DEMO] %'; v_cleanup_audit_ids := v_cleanup_audit_ids || v_selected_uuid_ids;

  delete from outbound_messages where id = any(v_cleanup_outbound_ids); delete from notifications where id = any(v_cleanup_notification_ids); delete from ticket_comments where id = any(v_cleanup_ticket_comment_ids); delete from tasks where id = any(v_cleanup_task_ids); delete from deals where id = any(v_cleanup_deal_ids); delete from support_tickets where id = any(v_cleanup_ticket_ids); delete from transactions where id = any(v_cleanup_transaction_ids); delete from audit_logs where id = any(v_cleanup_audit_ids); delete from campaigns where id = any(v_cleanup_campaign_ids); delete from automation_rules where id = any(v_cleanup_automation_ids); delete from customers where id = any(v_cleanup_customer_ids);
  update app_settings set integrations = coalesce(integrations, '{}'::jsonb) - 'seed_control', updated_at = now() where id = 'default';

  for i in 1..v_customer_seed_count loop
    v_full_name := v_customer_names[i]; v_email := format('%s@%s', v_customer_email_locals[i], v_customer_email_domain_map[i]); v_phone := v_customer_phones_seed[i]; v_address_line := v_customer_addresses[i]; v_created_at := v_now - make_interval(days => v_customer_age_days[i], hours => 9 + (i % 6), mins => (i * 11) % 50);
    insert into customers (full_name, phone, email, address, province, date_of_birth, gender, customer_type, source, assigned_to, is_active, created_by, created_at, updated_at)
    values (v_full_name, v_phone, v_email, v_address_line, v_customer_provinces_seed[i], v_customer_birth_dates[i], v_customer_genders_seed[i], v_customer_types_seed[i], v_customer_sources_seed[i], v_sales_profiles[((i - 1) % v_sales_count) + 1], v_customer_types_seed[i] <> 'inactive', v_actor_id, v_created_at, v_created_at + interval '6 hours')
    returning id into v_customer_id;
    v_customer_ids := array_append(v_customer_ids, v_customer_id); v_customer_created_ats := array_append(v_customer_created_ats, v_created_at); v_customer_emails := array_append(v_customer_emails, v_email); v_customer_phones := array_append(v_customer_phones, v_phone);
  end loop;

  for i in 1..v_transaction_seed_count loop
    v_customer_index := ((i * 5 - 1) % array_length(v_customer_ids, 1)) + 1; v_customer_id := v_customer_ids[v_customer_index]; v_created_at := v_customer_created_ats[v_customer_index] + make_interval(days => 6 + ((i * 9) % 90), hours => 8 + (i % 7)); if v_created_at > v_now - interval '2 hours' then v_created_at := v_now - make_interval(days => i % 6, hours => 3 + (i % 8)); end if;
    v_item_count := 1 + (i % 3);
    v_items_payload := jsonb_build_array(jsonb_build_object('name', v_products[((i - 1) % array_length(v_products, 1)) + 1], 'qty', 1 + (i % 2), 'price', 1800000 + ((i * 7) % 10) * 450000, 'total', (1 + (i % 2)) * (1800000 + ((i * 7) % 10) * 450000)));
    if v_item_count >= 2 then v_items_payload := v_items_payload || jsonb_build_array(jsonb_build_object('name', v_products[((i + 2) % array_length(v_products, 1)) + 1], 'qty', 1, 'price', 950000 + ((i * 5) % 8) * 250000, 'total', 950000 + ((i * 5) % 8) * 250000)); end if;
    if v_item_count = 3 then v_items_payload := v_items_payload || jsonb_build_array(jsonb_build_object('name', v_products[((i + 5) % array_length(v_products, 1)) + 1], 'qty', 1, 'price', 650000 + ((i * 3) % 5) * 180000, 'total', 650000 + ((i * 3) % 5) * 180000)); end if;
    select coalesce(sum((item ->> 'total')::numeric), 0) into v_subtotal_amount from jsonb_array_elements(v_items_payload) as item;
    v_discount_amount := case when i % 11 = 0 then round(v_subtotal_amount * 0.12, 2) when i % 4 = 0 then round(v_subtotal_amount * 0.05, 2) else 0 end; v_tax_amount := round(greatest(v_subtotal_amount - v_discount_amount, 0) * 0.08, 2); v_total_amount := greatest(v_subtotal_amount - v_discount_amount, 0) + v_tax_amount;
    v_transaction_status := case when i % 23 = 0 then 'refunded' when i % 17 = 0 then 'cancelled' when i % 9 = 0 then 'processing' when i % 7 = 0 then 'pending' else 'completed' end;
    v_payment_status := case when v_transaction_status = 'cancelled' then 'cancelled' when v_transaction_status = 'refunded' then 'refunded' when v_transaction_status in ('processing', 'pending') and i % 2 = 0 then 'partial' when v_transaction_status in ('processing', 'pending') then 'pending' else 'paid' end;
    v_payment_method := case i % 5 when 0 then 'transfer' when 1 then 'card' when 2 then 'qr' when 3 then 'cash' else 'other' end;
    insert into transactions (customer_id, invoice_code, items, subtotal, discount, tax, total_amount, payment_method, payment_status, status, notes, created_by, created_at, updated_at)
    values (v_customer_id, format('HD-%s-%s', to_char(v_created_at, 'YYMM'), lpad((3000 + i)::text, 4, '0')), v_items_payload, v_subtotal_amount, v_discount_amount, v_tax_amount, v_total_amount, v_payment_method, v_payment_status, v_transaction_status, v_transaction_notes_seed[((i - 1) % array_length(v_transaction_notes_seed, 1)) + 1], v_actor_id, v_created_at, v_created_at + interval '45 minutes')
    returning id into v_transaction_id;
    v_transaction_ids := array_append(v_transaction_ids, v_transaction_id);
  end loop;

  for i in 1..v_ticket_seed_count loop
    v_customer_index := ((i * 3 - 1) % array_length(v_customer_ids, 1)) + 1; v_customer_id := v_customer_ids[v_customer_index]; v_created_at := v_now - make_interval(days => v_ticket_age_days[i], hours => 10 + (i % 5), mins => (i * 13) % 40);
    v_ticket_priority := v_ticket_priorities_seed[i]; v_ticket_status := v_ticket_statuses_seed[i]; v_ticket_category := v_ticket_categories_seed[i]; v_ticket_channel := v_ticket_channels_seed[i]; v_title := v_ticket_titles_seed[i]; v_description := v_ticket_descriptions_seed[i];
    v_due_at := case when v_ticket_status in ('resolved', 'closed') then v_created_at + make_interval(hours => 30 + (i % 8)) when v_ticket_priority = 'urgent' then v_created_at + interval '8 hours' when v_ticket_priority = 'high' then v_created_at + interval '18 hours' else v_created_at + make_interval(hours => 30 + (i % 14)) end;
    v_resolved_at := case when v_ticket_status in ('resolved', 'closed') then least(v_due_at - interval '1 hour', v_created_at + make_interval(hours => 8 + (i % 18))) else null end;
    v_satisfaction := case when v_ticket_status in ('resolved', 'closed') then 4 + (i % 2) else null end; v_resolution_note := v_ticket_resolution_notes_seed[i];
    insert into support_tickets (customer_id, title, description, category, priority, channel, assigned_to, status, first_response_at, resolved_at, due_date, satisfaction_score, resolution_note, created_by, created_at, updated_at)
    values (v_customer_id, v_title, v_description, v_ticket_category, v_ticket_priority, v_ticket_channel, v_cskh_profiles[((i - 1) % v_cskh_count) + 1], v_ticket_status, v_created_at + make_interval(mins => 35 + (i % 45)), v_resolved_at, v_due_at, v_satisfaction, v_resolution_note, v_actor_id, v_created_at, coalesce(v_resolved_at, v_created_at + interval '3 hours'))
    returning id into v_ticket_id;
    v_ticket_ids := array_append(v_ticket_ids, v_ticket_id);
    v_public_update := case when v_ticket_status in ('resolved', 'closed') then coalesce(v_resolution_note, 'Da cap nhat ket qua xu ly cho khach hang.') when v_ticket_status = 'pending' then 'Da ghi nhan va dang cho bo phan lien quan cap nhat thong tin bo sung.' else 'Da tiep nhan va dang xu ly theo muc uu tien hien tai.' end;
    v_internal_note := case when v_ticket_category = 'return' then 'Can doi chieu lai du lieu hoan tra voi giao dich goc truoc khi dong ticket.' when v_ticket_channel = 'social' then 'Can kiem tra them nguon tin nhan va lich su trao doi tren kenh ben ngoai.' else 'Da phan cong cho dau moi phu trach va cap nhat vao danh sach theo doi trong ngay.' end;
    insert into ticket_comments (ticket_id, author_id, content, is_internal, created_at) values (v_ticket_id, v_cskh_profiles[((i - 1) % v_cskh_count) + 1], 'Da tiep nhan yeu cau va kiem tra nguyen nhan ban dau.', false, v_created_at + interval '40 minutes') returning id into v_ticket_comment_id; v_ticket_comment_ids := array_append(v_ticket_comment_ids, v_ticket_comment_id);
    insert into ticket_comments (ticket_id, author_id, content, is_internal, created_at) values (v_ticket_id, v_admin_profiles[((i - 1) % v_admin_count) + 1], v_internal_note, true, v_created_at + interval '2 hours') returning id into v_ticket_comment_id; v_ticket_comment_ids := array_append(v_ticket_comment_ids, v_ticket_comment_id);
    insert into ticket_comments (ticket_id, author_id, content, is_internal, created_at) values (v_ticket_id, v_cskh_profiles[(i % v_cskh_count) + 1], v_public_update, false, v_created_at + interval '4 hours') returning id into v_ticket_comment_id; v_ticket_comment_ids := array_append(v_ticket_comment_ids, v_ticket_comment_id);
  end loop;

  for i in 1..v_deal_seed_count loop
    v_customer_index := ((i * 7 - 1) % array_length(v_customer_ids, 1)) + 1; v_customer_id := v_customer_ids[v_customer_index]; v_created_at := v_now - make_interval(days => v_deal_age_days[i], hours => 11 + (i % 6), mins => (i * 7) % 40); v_deal_stage := v_deal_stages_seed[i];
    v_probability_value := case v_deal_stage when 'lead' then 20 when 'qualified' then 40 when 'proposal' then 60 when 'negotiation' then 80 when 'won' then 100 else 0 end; v_deal_value := v_deal_values_seed[i]; v_expected_close_at := case when v_deal_stage = 'won' then v_created_at + interval '12 days' when v_deal_stage = 'lost' then v_created_at + interval '8 days' else v_now + make_interval(days => 4 + (i * 3)) end;
    insert into deals (title, customer_id, owner_id, stage, value, probability, expected_close_at, description, created_by, created_at, updated_at)
    values (v_deal_titles_seed[i], v_customer_id, v_sales_profiles[((i - 1) % v_sales_count) + 1], v_deal_stage, v_deal_value, v_probability_value, v_expected_close_at, v_deal_descriptions_seed[i], v_actor_id, v_created_at, v_created_at + interval '2 hours')
    returning id into v_deal_id;
    v_deal_ids := array_append(v_deal_ids, v_deal_id);
  end loop;

  for i in 1..v_task_seed_count loop
    v_task_entity_type := v_task_entity_types_seed[i];
    if v_task_entity_type = 'deal' then v_selected_id := v_deal_ids[((i * 3 - 1) % array_length(v_deal_ids, 1)) + 1];
    elsif v_task_entity_type = 'ticket' then v_selected_id := v_ticket_ids[((i * 5 - 1) % array_length(v_ticket_ids, 1)) + 1];
    elsif v_task_entity_type = 'transaction' then v_selected_id := v_transaction_ids[((i * 7 - 1) % array_length(v_transaction_ids, 1)) + 1];
    else v_selected_id := v_customer_ids[((i * 11 - 1) % array_length(v_customer_ids, 1)) + 1]; end if;
    v_created_at := v_now - make_interval(days => v_task_age_days[i], hours => 8 + (i % 8), mins => (i * 9) % 35); v_task_status := v_task_statuses_seed[i]; v_task_priority := v_task_priorities_seed[i];
    v_due_at := case when v_task_status = 'overdue' then v_now - make_interval(hours => 6 + i) when v_task_status = 'done' then v_created_at + make_interval(hours => 8 + (i % 6)) else v_now + make_interval(days => i % 5, hours => 4 + (i % 6)) end;
    insert into tasks (title, description, entity_type, entity_id, assigned_to, status, priority, due_at, completed_at, created_by, created_at, updated_at)
    values (v_task_titles_seed[i], v_task_descriptions_seed[i], v_task_entity_type, v_selected_id, v_all_profiles[((i - 1) % v_all_count) + 1], v_task_status, v_task_priority, v_due_at, case when v_task_status = 'done' then v_due_at - interval '90 minutes' else null end, v_actor_id, v_created_at, v_created_at + interval '1 hour')
    returning id into v_task_id;
    v_task_ids := array_append(v_task_ids, v_task_id);
  end loop;

  for i in 1..v_campaign_seed_count loop
    v_campaign_status := v_campaign_statuses_seed[i]; v_campaign_channel := v_campaign_channels_seed[i]; v_created_at := v_now - make_interval(days => v_campaign_age_days[i], hours => 9 + i); v_subject_line := v_campaign_subjects_seed[i];
    v_target_segment := jsonb_build_object('customer_types', to_jsonb(case i when 1 then array['inactive','potential'] when 2 then array['vip','loyal'] when 3 then array['new'] when 4 then array['potential','loyal'] else array['loyal','vip'] end), '_seed_signature', v_seed_signature);
    insert into campaigns (name, description, channel, subject, content, target_segment, recipient_count, status, sent_count, opened_count, click_count, failed_count, scheduled_at, sent_at, created_by, created_at, updated_at)
    values (v_campaign_names_seed[i], v_campaign_descriptions_seed[i], v_campaign_channel, v_subject_line, v_campaign_contents_seed[i], v_target_segment, 0, v_campaign_status, 0, 0, 0, 0, case when v_campaign_status = 'scheduled' then v_now + make_interval(days => 2, hours => 9) else null end, case when v_campaign_status in ('sent', 'sending') then v_created_at + interval '6 hours' else null end, v_marketing_profiles[((i - 1) % v_marketing_count) + 1], v_created_at, v_created_at + interval '30 minutes')
    returning id into v_campaign_id;
    v_campaign_ids := array_append(v_campaign_ids, v_campaign_id);
  end loop;

  for i in 1..v_automation_seed_count loop
    v_created_at := v_now - make_interval(days => v_automation_age_days[i], hours => 7 + i); v_automation_action_type := v_automation_action_types_seed[i];
    insert into automation_rules (name, description, is_active, trigger_type, trigger_config, action_type, action_config, created_by, created_at, updated_at)
    values (v_automation_names_seed[i], v_automation_descriptions_seed[i], true, v_automation_trigger_types_seed[i], case when v_automation_trigger_types_seed[i] = 'inactive_days' then jsonb_build_object('days', v_automation_days_seed[i]) when v_automation_trigger_types_seed[i] = 'after_purchase' then jsonb_build_object('days', 7) else jsonb_build_object() end, v_automation_action_type, jsonb_build_object('content', v_automation_contents_seed[i], 'summary', v_automation_summaries_seed[i], 'sent_count', 0, '_seed_signature', v_seed_signature), v_marketing_profiles[((i - 1) % v_marketing_count) + 1], v_created_at, v_created_at + interval '1 hour')
    returning id into v_automation_id;
    v_automation_ids := array_append(v_automation_ids, v_automation_id);
  end loop;

  for i in 1..v_campaign_message_seed_count loop
    v_campaign_index := ((i - 1) % array_length(v_campaign_ids, 1)) + 1; if v_campaign_statuses_seed[v_campaign_index] not in ('sent', 'sending') then continue; end if;
    v_customer_index := ((i * 9 - 1) % array_length(v_customer_ids, 1)) + 1; v_customer_id := v_customer_ids[v_customer_index]; v_campaign_id := v_campaign_ids[v_campaign_index];
    v_outbound_channel := case when v_campaign_channels_seed[v_campaign_index] = 'both' and i % 2 = 0 then 'email' when v_campaign_channels_seed[v_campaign_index] = 'both' then 'sms' else v_campaign_channels_seed[v_campaign_index] end;
    v_recipient := case when v_outbound_channel = 'email' then v_customer_emails[v_customer_index] else v_customer_phones[v_customer_index] end;
    v_created_at := v_now - make_interval(days => 1 + (i % 18), hours => 9 + (i % 7), mins => (i * 3) % 40); v_outbound_status := case when i % 13 = 0 then 'failed' when i % 7 = 0 then 'clicked' when i % 5 = 0 then 'opened' when v_outbound_channel = 'sms' and i % 4 = 0 then 'delivered' else 'sent' end;
    v_sent_at := case when v_outbound_status = 'failed' then null else v_created_at + interval '6 minutes' end; v_opened_at := case when v_outbound_status in ('opened', 'clicked') then v_sent_at + interval '2 hours' else null end; v_clicked_at := case when v_outbound_status = 'clicked' then v_sent_at + interval '3 hours' else null end;
    insert into outbound_messages (campaign_id, customer_id, channel, provider, recipient, subject, content, status, error_message, metadata, opened_at, clicked_at, sent_at, created_by, created_at, updated_at)
    values (v_campaign_id, v_customer_id, v_outbound_channel, case when v_outbound_channel = 'email' then 'resend' else 'twilio' end, v_recipient, v_campaign_subjects_seed[v_campaign_index], v_campaign_contents_seed[v_campaign_index], v_outbound_status, case when v_outbound_status = 'failed' then 'Nha cung cap tra ve loi tam thoi.' else null end, jsonb_build_object('_seed_signature', v_seed_signature, 'group', 'campaign'), v_opened_at, v_clicked_at, v_sent_at, v_actor_id, v_created_at, v_created_at)
    returning id into v_outbound_message_id;
    v_outbound_message_ids := array_append(v_outbound_message_ids, v_outbound_message_id);
  end loop;

  for i in 1..v_automation_message_seed_count loop
    v_automation_index := ((i - 1) % array_length(v_automation_ids, 1)) + 1; v_customer_index := ((i * 7 - 1) % array_length(v_customer_ids, 1)) + 1; v_customer_id := v_customer_ids[v_customer_index]; v_automation_id := v_automation_ids[v_automation_index];
    v_outbound_channel := case when v_automation_action_types_seed[v_automation_index] = 'send_email' then 'email' else 'sms' end; v_recipient := case when v_outbound_channel = 'email' then v_customer_emails[v_customer_index] else v_customer_phones[v_customer_index] end;
    v_created_at := v_now - make_interval(days => 2 + (i % 21), hours => 8 + (i % 6), mins => (i * 5) % 35); v_outbound_status := case when i % 11 = 0 then 'failed' when i % 6 = 0 then 'clicked' when i % 4 = 0 then 'opened' when v_outbound_channel = 'sms' and i % 3 = 0 then 'delivered' else 'sent' end;
    v_sent_at := case when v_outbound_status = 'failed' then null else v_created_at + interval '10 minutes' end; v_opened_at := case when v_outbound_status in ('opened', 'clicked') then v_sent_at + interval '90 minutes' else null end; v_clicked_at := case when v_outbound_status = 'clicked' then v_sent_at + interval '150 minutes' else null end;
    insert into outbound_messages (automation_rule_id, customer_id, channel, provider, recipient, subject, content, status, error_message, metadata, opened_at, clicked_at, sent_at, created_by, created_at, updated_at)
    values (v_automation_id, v_customer_id, v_outbound_channel, case when v_outbound_channel = 'email' then 'resend' else 'twilio' end, v_recipient, v_automation_names_seed[v_automation_index], v_automation_contents_seed[v_automation_index], v_outbound_status, case when v_outbound_status = 'failed' then 'Nha cung cap phan hoi loi tam thoi.' else null end, jsonb_build_object('_seed_signature', v_seed_signature, 'group', 'automation'), v_opened_at, v_clicked_at, v_sent_at, v_actor_id, v_created_at, v_created_at)
    returning id into v_outbound_message_id;
    v_outbound_message_ids := array_append(v_outbound_message_ids, v_outbound_message_id);
  end loop;

  update campaigns c
  set recipient_count = agg.total_count, sent_count = agg.sent_count, opened_count = agg.opened_count, click_count = agg.click_count, failed_count = agg.failed_count, sent_at = case when c.status in ('sent', 'sending') then coalesce(c.sent_at, agg.last_sent_at) else c.sent_at end, updated_at = now()
  from (
    select om.campaign_id, count(*) as total_count, count(*) filter (where om.status in ('sent', 'delivered', 'opened', 'clicked')) as sent_count, count(*) filter (where om.status in ('opened', 'clicked')) as opened_count, count(*) filter (where om.status = 'clicked') as click_count, count(*) filter (where om.status = 'failed') as failed_count, max(om.sent_at) as last_sent_at
    from outbound_messages om where om.campaign_id is not null and coalesce(om.metadata ->> '_seed_signature', '') = v_seed_signature group by om.campaign_id
  ) agg
  where c.id = agg.campaign_id;

  update automation_rules ar
  set action_config = coalesce(ar.action_config, '{}'::jsonb) || jsonb_build_object('sent_count', agg.sent_count, 'last_run_at', agg.last_run_at, 'content', coalesce(ar.action_config ->> 'content', ''), 'summary', coalesce(ar.action_config ->> 'summary', '')), updated_at = now()
  from (
    select om.automation_rule_id, count(*) filter (where om.status <> 'failed') as sent_count, max(om.sent_at)::text as last_run_at
    from outbound_messages om where om.automation_rule_id is not null and coalesce(om.metadata ->> '_seed_signature', '') = v_seed_signature group by om.automation_rule_id
  ) agg
  where ar.id = agg.automation_rule_id;

  for i in 1..v_customer_note_seed_count loop
    v_customer_index := ((i * 4 - 1) % array_length(v_customer_ids, 1)) + 1; v_selected_user_id := v_all_profiles[((i - 1) % v_all_count) + 1]; v_created_at := v_now - make_interval(days => 2 + (i % 32), hours => 8 + (i % 7), mins => (i * 6) % 35);
    v_note_type := case i % 4 when 0 then 'call' when 1 then 'meeting' when 2 then 'internal' else 'general' end;
    v_description := case i % 7 when 0 then 'Da goi xac nhan dau moi phu trach khu vuc mien Trung.' when 1 then 'Khach uu tien nhan bao gia truoc 15h thu Sau.' when 2 then 'Da hen buoi trao doi ngan cho quan ly van hanh vao tuan toi.' when 3 then 'Khach can bo sung ma so thue truoc khi xuat lai hoa don.' when 4 then 'Doi ngu noi bo da chot nguoi dau moi tiep nhan ticket ky thuat.' when 5 then 'Can nhac lai ve lich nghiem thu va danh sach dau viec ton.' else 'Khach mong muon duoc cap nhat tien do qua email thay vi goi dien.' end;
    insert into audit_logs (user_id, action, entity_type, entity_id, old_data, new_data, created_at)
    values (v_selected_user_id, 'create', 'customer_note', v_customer_ids[v_customer_index], null, jsonb_build_object('customer_id', v_customer_ids[v_customer_index], 'author_id', v_selected_user_id, 'note_type', v_note_type, 'content', v_description, 'created_at', v_created_at, 'message', 'Them ghi chu khach hang', '_seed_signature', v_seed_signature), v_created_at)
    returning id into v_audit_id;
    v_audit_ids := array_append(v_audit_ids, v_audit_id);
  end loop;

  for i in 1..v_notification_seed_count loop
    v_selected_user_id := v_all_profiles[((i - 1) % v_all_count) + 1];
    v_entity_type := case i % 6 when 0 then 'ticket' when 1 then 'customer' when 2 then 'campaign' when 3 then 'transaction' when 4 then 'task' else 'deal' end;
    v_selected_id := case v_entity_type when 'ticket' then v_ticket_ids[((i * 3 - 1) % array_length(v_ticket_ids, 1)) + 1] when 'customer' then v_customer_ids[((i * 5 - 1) % array_length(v_customer_ids, 1)) + 1] when 'campaign' then v_campaign_ids[((i * 2 - 1) % array_length(v_campaign_ids, 1)) + 1] when 'transaction' then v_transaction_ids[((i * 7 - 1) % array_length(v_transaction_ids, 1)) + 1] when 'task' then v_task_ids[((i * 11 - 1) % array_length(v_task_ids, 1)) + 1] else v_deal_ids[((i * 13 - 1) % array_length(v_deal_ids, 1)) + 1] end;
    v_notification_type := case i % 4 when 0 then 'info' when 1 then 'success' when 2 then 'warning' else 'error' end;
    v_title := case v_entity_type when 'ticket' then 'Ticket can phan hoi truoc SLA' when 'customer' then 'Khach hang vua phat sinh giao dich moi' when 'campaign' then 'Chien dich ghi nhan tuong tac moi' when 'transaction' then 'Giao dich da duoc xac nhan thanh toan' when 'task' then 'Nhiem vu sap den han trong hom nay' else 'Co hoi vua chuyen sang giai doan moi' end;
    v_description := case v_entity_type when 'ticket' then 'Co mot ticket can uu tien cap nhat trong khung gio lam viec hien tai.' when 'customer' then 'Khach hang da co them mot giao dich moi va can duoc doi ngu theo sat.' when 'campaign' then 'Chien dich vua ghi nhan them luot mo hoac click trong dot gui gan day.' when 'transaction' then 'Giao dich da duoc xac nhan, co the cap nhat tiep cac dau viec sau ban.' when 'task' then 'Can kiem tra nhiem vu dang sap den han de tranh tre SLA noi bo.' else 'Co hoi da co thay doi ve trang thai va can kiem tra lai kha nang chot.' end;
    v_created_at := v_now - make_interval(days => i % 9, hours => 8 + (i % 10), mins => (i * 4) % 35);
    insert into notifications (user_id, title, message, type, entity_type, entity_id, is_read, read_at, created_at)
    values (v_selected_user_id, v_title, v_description, v_notification_type, v_entity_type, v_selected_id, i % 3 = 0, case when i % 3 = 0 then v_created_at + interval '2 hours' else null end, v_created_at)
    returning id into v_notification_id;
    v_notification_ids := array_append(v_notification_ids, v_notification_id);
  end loop;

  for i in 1..v_audit_seed_count loop
    v_audit_action := case i % 3 when 0 then 'create' when 1 then 'update' else 'delete' end;
    v_entity_type := case i % 7 when 0 then 'customer' when 1 then 'transaction' when 2 then 'ticket' when 3 then 'deal' when 4 then 'task' when 5 then 'campaign' else 'automation_run' end;
    v_selected_id := case v_entity_type when 'customer' then v_customer_ids[((i * 3 - 1) % array_length(v_customer_ids, 1)) + 1] when 'transaction' then v_transaction_ids[((i * 5 - 1) % array_length(v_transaction_ids, 1)) + 1] when 'ticket' then v_ticket_ids[((i * 7 - 1) % array_length(v_ticket_ids, 1)) + 1] when 'deal' then v_deal_ids[((i * 11 - 1) % array_length(v_deal_ids, 1)) + 1] when 'task' then v_task_ids[((i * 13 - 1) % array_length(v_task_ids, 1)) + 1] when 'campaign' then v_campaign_ids[((i * 2 - 1) % array_length(v_campaign_ids, 1)) + 1] else v_automation_ids[((i * 3 - 1) % array_length(v_automation_ids, 1)) + 1] end;
    v_title := case v_entity_type when 'customer' then 'Cap nhat thong tin dau moi khach hang' when 'transaction' then 'Dieu chinh trang thai giao dich' when 'ticket' then 'Cap nhat muc uu tien ticket' when 'deal' then 'Dieu chinh gia tri co hoi' when 'task' then 'Cap nhat tien do nhiem vu' when 'campaign' then 'Dieu chinh lich gui chien dich' else 'Ghi nhan ket qua chay quy tac tu dong' end;
    v_created_at := v_now - make_interval(days => 1 + (i % 28), hours => 7 + (i % 11), mins => (i * 5) % 40);
    insert into audit_logs (user_id, action, entity_type, entity_id, old_data, new_data, created_at)
    values (v_all_profiles[((i - 1) % v_all_count) + 1], v_audit_action, v_entity_type, v_selected_id, case when v_audit_action = 'update' then jsonb_build_object('message', 'Trang thai truoc do', '_seed_signature', v_seed_signature) when v_audit_action = 'delete' then jsonb_build_object('message', 'Ban ghi truoc khi xoa', '_seed_signature', v_seed_signature) else null end, jsonb_build_object('message', v_title, '_seed_signature', v_seed_signature), v_created_at)
    returning id into v_audit_id;
    v_audit_ids := array_append(v_audit_ids, v_audit_id);
  end loop;

  update app_settings
  set integrations = jsonb_set(coalesce(integrations, '{}'::jsonb) - 'seed_control', '{seed_control}', jsonb_build_object('signature', v_seed_signature, 'seeded_at', v_now, 'customer_ids', to_jsonb(v_customer_ids), 'transaction_ids', to_jsonb(v_transaction_ids), 'ticket_ids', to_jsonb(v_ticket_ids), 'deal_ids', to_jsonb(v_deal_ids), 'task_ids', to_jsonb(v_task_ids), 'campaign_ids', to_jsonb(v_campaign_ids), 'automation_ids', to_jsonb(v_automation_ids), 'notification_ids', to_jsonb(v_notification_ids), 'outbound_message_ids', to_jsonb(v_outbound_message_ids), 'audit_ids', to_jsonb(v_audit_ids), 'ticket_comment_ids', to_jsonb(v_ticket_comment_ids), 'email_domains', to_jsonb(v_seed_email_domains)), true), updated_at = now()
  where id = 'default';
end $$;
