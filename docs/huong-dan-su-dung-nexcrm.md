# Bộ Tài Liệu Setup + Vận Hành NexCRM (Phiên Bản Hiện Tại)

Cập nhật: 16/04/2026  
Phạm vi: setup, sử dụng, vận hành, test và kiểm thử theo codebase hiện tại.

## 0. Bộ tài liệu đi kèm

1. Setup + vận hành: `docs/huong-dan-su-dung-nexcrm.md` (file này)
2. Test + kiểm thử SIT/UAT: `docs/kiem-thu-nexcrm.md`

## 1. Tổng quan hệ thống

Stack chính:

1. Frontend: React + TypeScript + Vite + TailwindCSS
2. Data/Auth: Supabase PostgreSQL + Auth + Realtime + Edge Functions
3. State: Zustand + TanStack Query
4. Validate form: React Hook Form + Zod

Vai trò đang dùng:

1. `super_admin`
2. `admin`
3. `director`
4. `sales`
5. `cskh`
6. `marketing`

Module chính theo route:

1. `/dashboard`
2. `/customers`
3. `/transactions`
4. `/tickets`
5. `/campaigns`
6. `/automation`
7. `/pipeline`
8. `/reports`
9. `/admin/users`
10. `/admin/settings`
11. `/admin/audit`
12. `/admin/pos-sync`

## 2. Chuẩn bị môi trường

1. Node.js >= 20
2. npm >= 10
3. Supabase CLI mới nhất
4. Supabase project riêng cho DEV và PRODUCTION
5. Vercel account (nếu deploy production)

## 3. Setup mới từ đầu (DEV)

### 3.1 Cài package

```bash
npm install
```

### 3.2 Tạo `.env.local`

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_APP_SETTINGS_ENCRYPTION_KEY=<chuoi-bi-mat-toi-thieu-32-ky-tu>
```

Lưu ý:

1. Không dùng `service_role_key` cho frontend.
2. `VITE_APP_SETTINGS_ENCRYPTION_KEY` là bắt buộc nếu lưu API key trong `app_settings`.

### 3.3 Chạy migration đúng thứ tự

Khuyến nghị: dùng project Supabase mới để tránh xung đột schema legacy.

Chạy lần lượt trong SQL Editor:

1. `supabase/migrations/000_full_schema.sql`
2. `supabase/migrations/20260404_login_identifier_rpc.sql`
3. `supabase/migrations/20260416_production_hardening.sql`
4. `supabase/migrations/20260416_simple_onboarding_default_org.sql`
5. `supabase/migrations/20260416_hotfix_user_theme_rls_alignment.sql`
6. `supabase/migrations/20260416_hotfix_customer_soft_delete_rpc.sql`
7. `supabase/migrations/20260416_hotfix_deal_task_rls_reassert.sql`
8. `supabase/migrations/20260416_hotfix_sales_pipeline_visibility.sql`
9. `supabase/migrations/20260416_schedule_run_automation.sql` (tùy chọn nếu bật cron)

Không dùng cho track hiện tại:

1. `supabase/schema.sql`
2. `supabase/migrations/20260401_sprint1_p0.sql`
3. `supabase/migrations/20260401_sprint2_pipeline_tasks.sql`
4. `supabase/migrations/20260402_sprint3_outbound_automation.sql`
5. `supabase/migrations/20260403_sprint4_performance_and_reporting.sql`
6. `supabase/migrations/20260404_sql_consistency_refresh.sql`
7. `supabase/migrations/20260415_auth_member_sync_hardening.sql`
8. `supabase/migrations/20260415_pos_sync_mvp.sql`
9. `supabase/migrations/20260415_role_rls_security_baseline.sql`

Ghi chú:

1. Các file trên là track legacy/transition theo giai đoạn, có thể gây lệch schema nếu chạy lẫn với track mới.
2. Chỉ chạy theo đúng danh sách mục 3.3 cho project mới.

### 3.4 Verify schema nhanh

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'organizations','profiles','customers','transactions','support_tickets',
    'deals','tasks','campaigns','automation_rules','outbound_messages',
    'notifications','audit_logs','app_settings'
  )
order by table_name;
```

```sql
select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('handle_new_user','app_soft_delete_customer')
order by proname;
```

### 3.5 Deploy Edge Functions

```bash
supabase login
supabase link --project-ref <dev-project-ref>
supabase functions deploy send-campaign
supabase functions deploy run-automation
supabase functions deploy pos-sync
supabase functions deploy test-connection
supabase functions deploy manage-profile-user
supabase functions deploy dispatch-communication
supabase functions deploy pos-sync-webhook
supabase functions deploy test-email-connection
supabase functions deploy test-pos-connection
```

### 3.6 Set secret cho Edge Functions

```bash
supabase secrets set RESEND_API_KEY=<optional>
supabase secrets set SENDGRID_API_KEY=<optional>
supabase secrets set TWILIO_ACCOUNT_SID=<optional>
supabase secrets set TWILIO_AUTH_TOKEN=<optional>
supabase secrets set TWILIO_FROM_NUMBER=<optional>
```

Lưu ý:

1. Không set biến bắt đầu bằng `SUPABASE_` qua `supabase secrets set`.
2. Chỉ set secret tích hợp bên thứ ba.

### 3.7 Bootstrap tài khoản admin đầu tiên

Flow chuẩn:

1. Tạo user trong `Authentication > Users` (không cần metadata).
2. Chạy SQL promote role:

```sql
with target_user as (
  select id, email
  from auth.users
  where lower(email) = lower('<ADMIN_EMAIL>')
  limit 1
),
promote as (
  update public.profiles p
  set
    role = 'admin',
    is_active = true,
    deleted_at = null,
    updated_at = now()
  from target_user t
  where p.id = t.id
  returning p.id
)
select
  p.id,
  u.email,
  p.org_id,
  o.slug as org_slug,
  p.role,
  p.is_active,
  p.deleted_at
from public.profiles p
join auth.users u on u.id = p.id
left join public.organizations o on o.id = p.org_id
where p.id in (select id from promote);
```

## 4. Seed dữ liệu demo local (v2)

Chạy đúng thứ tự:

1. `supabase/seeds/clear_large_demo_seed_v2.sql`
2. `supabase/seeds/large_demo_seed_v2.sql`

Không dùng:

1. `supabase/seeds/large_demo_seed.sql` (legacy)
2. `supabase/seeds/clear_large_demo_seed.sql` (legacy)

## 5. Chạy ứng dụng

```bash
npm run dev
```

Mặc định: `http://localhost:5173`

## 6. Hướng dẫn sử dụng theo vai trò

### 6.1 `admin`

1. Quản trị user tại `/admin/users`
2. Quản trị cấu hình tại `/admin/settings`
3. Theo dõi audit tại `/admin/audit`
4. Thực hiện nghiệp vụ CRM đầy đủ

### 6.2 `super_admin`

1. Dành cho vận hành cấp nền tảng hoặc tenant owner
2. Có quyền cao nhất trong hệ thống
3. Không được tự hạ quyền chính mình
4. Không được tự vô hiệu hóa/xóa chính mình
5. Không được để mất `super_admin` cuối cùng của tổ chức

### 6.3 `director`

1. Xem dashboard, report, pipeline
2. Xem audit
3. Không thao tác các chức năng quản trị hệ thống quan trọng

### 6.4 `sales`

1. Quản lý khách hàng, giao dịch, pipeline
2. Được xem số liệu pipeline toàn org (read-only ở tầng policy đọc)
3. Quyền sửa/xóa vẫn theo permission matrix hiện tại

### 6.5 Luồng vận hành ngày thường cho admin

1. Vào `/admin/users` tạo user mới và gán role.
2. Vào `/admin/settings` cấu hình email/SMS/POS.
3. Theo dõi cảnh báo và lịch sử thao tác tại `/admin/audit`.
4. Theo dõi dữ liệu vận hành tại `/dashboard`, `/pipeline`, `/reports`.

## 7. Setup production

1. Tạo Supabase project production riêng
2. Chạy cùng migration track như mục 3.3
3. Deploy Edge Functions production
4. Set secrets production
5. Deploy frontend lên Vercel với:
   1. `VITE_SUPABASE_URL`
   2. `VITE_SUPABASE_ANON_KEY`
   3. `VITE_APP_SETTINGS_ENCRYPTION_KEY`

Lưu ý cron:

1. Không hardcode `service_role_key` trong file migration.
2. Nếu bật schedule `run-automation`, dùng SQL template theo môi trường production thực tế.

## 8. Test kỹ thuật nhanh

```bash
npm run build
npm run test
```

Kết quả mong đợi hiện tại:

1. Build TypeScript/Vite pass
2. Vitest pass toàn bộ

## 9. Kiểm thử thủ công (UAT/SIT)

Xem checklist chi tiết tại file kiểm thử:

1. [docs/kiem-thu-nexcrm.md](./kiem-thu-nexcrm.md)

## 10. Troubleshooting thường gặp

### 10.1 `column "department" ... schema cache`

Nguyên nhân: DB chưa chạy migration thêm cột mới trong `profiles`.

Xử lý:

1. Chạy `20260416_hotfix_user_theme_rls_alignment.sql`

### 10.2 `new row violates row-level security policy` khi xóa mềm

Nguyên nhân:

1. DB thiếu policy hotfix
2. DB thiếu RPC `app_soft_delete_customer`

Xử lý:

1. Chạy `20260416_hotfix_customer_soft_delete_rpc.sql`

### 10.3 Sales không thấy số liệu pipeline

Nguyên nhân: policy đọc `deals/tasks` chưa cập nhật.

Xử lý:

1. Chạy `20260416_hotfix_sales_pipeline_visibility.sql`

### 10.4 Lỗi `ON CONFLICT` ở `app_settings`

Nguyên nhân: DB cũ bị lệch unique constraint.

Xử lý:

1. Chạy `20260416_simple_onboarding_default_org.sql` để dedupe + đảm bảo unique theo `org_id`.

### 10.5 Không thể lưu API key ở Settings

Nguyên nhân: thiếu `VITE_APP_SETTINGS_ENCRYPTION_KEY`.

Xử lý:

1. Bổ sung biến env này ở frontend.
2. Restart `npm run dev` hoặc redeploy production.

## 11. Danh sách file quan trọng

1. `README.md`
2. `docs/huong-dan-su-dung-nexcrm.md`
3. `docs/kiem-thu-nexcrm.md`
4. `supabase/migrations/*.sql`
5. `supabase/functions/*`
6. `supabase/seeds/clear_large_demo_seed_v2.sql`
7. `supabase/seeds/large_demo_seed_v2.sql`
