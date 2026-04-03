# NexCRM

NexCRM là ứng dụng CRM web dành cho doanh nghiệp Việt Nam, tập trung vào quản lý khách hàng, giao dịch, ticket hỗ trợ, chiến dịch marketing và vận hành nội bộ.

## Tài liệu chính

- [Hướng dẫn sử dụng NexCRM](./docs/huong-dan-su-dung-nexcrm.md)

## Công nghệ chính

- React + TypeScript + Vite
- TailwindCSS + shadcn/ui
- React Router DOM v6
- Zustand
- TanStack Query
- Supabase Auth + Database + Realtime

## Cách chạy dự án

1. Cài dependency:

```bash
npm install
```

2. Tạo file `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

3. Chạy môi trường phát triển:

```bash
npm run dev
```

4. Build production:

```bash
npm run build
```

## Yêu cầu Supabase

- Ứng dụng đăng nhập bằng Supabase Auth.
- Mỗi tài khoản trong `auth.users` cần có bản ghi tương ứng trong bảng `profiles`.
- Schema SQL và các lưu ý sử dụng được mô tả trong tài liệu hướng dẫn sử dụng ở `docs/`.

## Ghi chú

- README này chỉ giữ phần giới thiệu và chạy dự án.
- Hướng dẫn nghiệp vụ và quản trị chi tiết nằm trong file `docs/huong-dan-su-dung-nexcrm.md`.
