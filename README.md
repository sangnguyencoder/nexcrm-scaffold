# NexCRM

NexCRM là ứng dụng CRM web dành cho doanh nghiệp Việt Nam, tập trung vào quản lý khách hàng, giao dịch, ticket hỗ trợ, chiến dịch marketing và vận hành nội bộ.

## Tài liệu chính

- [Hướng dẫn setup và vận hành NexCRM (DEV + PRODUCTION)](./docs/huong-dan-su-dung-nexcrm.md)
- [Hướng dẫn test và kiểm thử NexCRM (SIT/UAT)](./docs/kiem-thu-nexcrm.md)

## Công nghệ chính

- React + TypeScript + Vite
- TailwindCSS + shadcn/ui
- React Router DOM v6
- Zustand
- TanStack Query
- Supabase Auth + Database + Realtime

## Chạy nhanh local

1. Cài dependency:

```bash
npm install
```

2. Tạo file `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_SETTINGS_ENCRYPTION_KEY=replace-with-32-char-or-more-secret
```

3. Chạy môi trường phát triển:

```bash
npm run dev
```

4. Build production:

```bash
npm run build
```

## Bộ tài liệu hiện tại (khuyến nghị)

- Setup + vận hành: [`docs/huong-dan-su-dung-nexcrm.md`](./docs/huong-dan-su-dung-nexcrm.md)
- Test + kiểm thử: [`docs/kiem-thu-nexcrm.md`](./docs/kiem-thu-nexcrm.md)

## Onboarding admin nhanh (không metadata)

Sau khi chạy đủ migration mới nhất:

1. Tạo user bình thường tại `Supabase > Authentication > Users > Add user`.
2. Không cần điền `user_metadata`.
3. Chạy SQL promote role theo hướng dẫn ở Bước 7 trong tài liệu setup để nâng tài khoản lên `admin`.

Lưu ý quan trọng: track migration mới nhất gồm `000_full_schema.sql` + `20260404_login_identifier_rpc.sql` + `20260416_production_hardening.sql` + `20260416_simple_onboarding_default_org.sql`; không dùng `supabase/schema.sql`.
Lưu ý thêm: không set secret có prefix `SUPABASE_` bằng `supabase secrets set` (reserved names).

## Seed demo local (v2)

Dùng bộ seed mới theo schema hiện tại:

1. Chạy `supabase/seeds/clear_large_demo_seed_v2.sql`
2. Chạy `supabase/seeds/large_demo_seed_v2.sql`

Thứ tự bắt buộc: `clear -> seed`.

Không dùng:

1. `supabase/seeds/large_demo_seed.sql` (LEGACY schema cũ)
2. `supabase/seeds/clear_large_demo_seed.sql` (LEGACY schema cũ)

## Khắc phục nhanh lỗi "Tài khoản chưa được cấp quyền truy cập CRM"

Nếu đã nâng role nhưng vẫn bị chặn đăng nhập, cần kiểm tra thêm:

1. `profiles.deleted_at IS NULL`
2. `profiles.is_active = true`
3. `profiles.org_id` hợp lệ và tổ chức chưa bị soft delete

Chi tiết SQL check/fix có trong mục đầu của tài liệu:
[`docs/huong-dan-su-dung-nexcrm.md`](./docs/huong-dan-su-dung-nexcrm.md)

## Ghi chú

- README này chỉ giữ phần giới thiệu và chạy dự án.
- Hướng dẫn setup/vận hành chi tiết nằm trong file `docs/huong-dan-su-dung-nexcrm.md`.
