# Hướng Dẫn Sử Dụng Và Triển Khai NexCRM

## 1. NexCRM là gì

NexCRM là ứng dụng CRM web cho doanh nghiệp Việt Nam, gồm các phân hệ:

- Dashboard tổng quan
- Quản lý khách hàng
- Quản lý giao dịch
- Ticket hỗ trợ
- Chiến dịch marketing
- Chăm sóc tự động
- Báo cáo
- Quản lý người dùng
- Cài đặt và nhật ký hệ thống

Tài liệu này dành cho cả:

- Người dùng nghiệp vụ: `sales`, `cskh`, `marketing`, `director`
- Người quản trị: `super_admin`, `admin`

## 2. Điều quan trọng nhất khi app bị trắng màn

Nếu anh/chị đã tạo `.env.local` nhưng mở app ra chỉ thấy trắng màn, nguyên nhân thường nằm ở một trong 4 nhóm dưới đây.

### 2.1 Sai tên biến môi trường

App hiện tại chỉ đọc đúng 2 biến:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Sai phổ biến:

- Gõ nhầm `SUPABASE_URL` thay vì `VITE_SUPABASE_URL`
- Gõ nhầm `SUPABASE_ANON_KEY` thay vì `VITE_SUPABASE_ANON_KEY`
- Copy nhầm key `service_role` vào trình duyệt

Lưu ý:

- Với Vite, biến phải có tiền tố `VITE_` mới được đưa vào frontend.
- Sau khi sửa `.env.local`, phải dừng `npm run dev` rồi chạy lại.

### 2.2 Chưa tạo bảng trong Supabase

`.env.local` chỉ giúp app biết kết nối vào project nào. App vẫn cần database schema thật.

Anh/chị bắt buộc phải:

1. Tạo project Supabase
2. Chạy SQL schema
3. Bật RLS và policy đúng như app đang dùng

Nếu chưa có bảng như `profiles`, `customers`, `support_tickets`, `campaigns` thì app sẽ không hoạt động đúng.

### 2.3 Có user Auth nhưng không có profile

App đăng nhập bằng Supabase Auth nhưng sau đó còn đọc tiếp bảng `profiles`.

Điều kiện đúng là:

- Có tài khoản trong `auth.users`
- Có bản ghi tương ứng trong `profiles`
- `profiles.id = auth.users.id`

Nếu thiếu `profiles`, đăng nhập có thể thất bại hoặc bị quay lại login.

### 2.4 Chưa restart dev server hoặc chưa redeploy

Biến môi trường Vite được lấy ở thời điểm build/dev start.

Điều này có nghĩa là:

- Local: sửa `.env.local` xong phải restart `npm run dev`
- Vercel: sửa env xong phải redeploy

## 3. Vai trò và quyền

### Các vai trò hiện có

- `super_admin`
- `admin`
- `director`
- `sales`
- `cskh`
- `marketing`

### Quyền hiển thị menu hệ thống

| Vai trò | Người dùng | Cài đặt | Nhật ký |
| --- | --- | --- | --- |
| `super_admin` | Có | Có | Có |
| `admin` | Có | Có | Có |
| `director` | Có | Không | Có |
| `sales` | Không | Không | Không |
| `cskh` | Không | Không | Không |
| `marketing` | Không | Không | Không |

Lưu ý:

- `sales`, `cskh`, `marketing` không thấy nhóm `HỆ THỐNG`
- Nếu cố vào route không đủ quyền, app sẽ chuyển sang trang `403`

## 4. Thiết lập Supabase từ đầu

## 4.1 Tạo project Supabase

1. Truy cập [Supabase Dashboard](https://supabase.com/dashboard)
2. Bấm `New project`
3. Chọn organization
4. Đặt:
   - Project name
   - Database password
   - Region
5. Chờ project khởi tạo xong

Sau khi tạo xong, lấy:

- Project URL
- Anon key

Vị trí lấy:

- `Project Settings` → `API`

### 4.2 Tạo file môi trường local

Tạo file `.env.local` ở root của app:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Có thể dùng file mẫu:

- [`.env.example`](/D:/Project/Hệ thống CRM quản lý khách hàng/nexcrm-scaffold/.env.example)

### 4.3 Chạy database schema

Trong repo đã có sẵn file SQL:

- [`supabase/schema.sql`](/D:/Project/Hệ thống CRM quản lý khách hàng/nexcrm-scaffold/supabase/schema.sql)

Thao tác:

1. Vào Supabase Dashboard
2. Chọn `SQL Editor`
3. Mở file `supabase/schema.sql`
4. Copy toàn bộ nội dung vào SQL Editor
5. Bấm `Run`

Schema này sẽ tạo:

- `profiles`
- `customers`
- `transactions`
- `deals`
- `tasks`
- `support_tickets`
- `ticket_comments`
- `campaigns`
- `outbound_messages`
- `notifications`
- `automation_rules`
- `app_settings`
- `audit_logs`

Ngoài ra còn có:

- Trigger sinh `customer_code` và `ticket_code` theo sequence
- Trigger tự cập nhật thống kê khách hàng từ giao dịch
- RPC `resolve_login_identifier` cho flow login bằng username/email
- RPC `get_dashboard_snapshot` cho dashboard
- Index, RLS và policy của baseline hiện tại

Nếu anh/chị đang nâng cấp trên một project đã có dữ liệu cũ, chạy thêm toàn bộ file trong thư mục:

- [`supabase/migrations`](/D:/Project/Hệ thống CRM quản lý khách hàng/nexcrm-scaffold/supabase/migrations)

Theo thứ tự tên file, đặc biệt gồm migration đồng bộ mới:

- [`20260404_sql_consistency_refresh.sql`](/D:/Project/Hệ thống CRM quản lý khách hàng/nexcrm-scaffold/supabase/migrations/20260404_sql_consistency_refresh.sql)

### 4.4 Tạo user đầu tiên trong Supabase Auth

App không tự có sẵn tài khoản quản trị. Anh/chị cần tạo user đầu tiên.

Cách nhanh nhất:

1. Vào `Authentication`
2. Chọn `Users`
3. Bấm `Add user`
4. Nhập email và password

Ví dụ:

- Email: `admin@nexcrm.vn`
- Password: `12345678`

Lưu ý cho flow login mới:

- Có thể đăng nhập bằng `email` đầy đủ
- Hoặc đăng nhập bằng `username` là phần đứng trước dấu `@` của email, ví dụ `admin`
- Nếu có 2 tài khoản trùng local-part trước `@`, phải đăng nhập bằng email đầy đủ
- Google login chỉ hoạt động ổn định khi user trong `auth.users` đã có bản ghi tương ứng trong `profiles`

### 4.5 Tạo profile tương ứng cho user đó

Sau khi tạo user ở `Authentication`, cần tạo bản ghi trong `profiles`.

Bước 1:

- Copy `UUID` của user vừa tạo trong `Authentication > Users`

Bước 2:

- Chạy SQL sau trong `SQL Editor`

```sql
insert into profiles (
  id,
  full_name,
  role,
  department,
  is_active
) values (
  'UUID_CUA_USER',
  'Quản trị hệ thống',
  'super_admin',
  'Ban Quản Trị',
  true
);
```

Nếu anh/chị muốn kiểm tra nhanh local-part nào đang bị trùng để tránh login bằng username bị mơ hồ, chạy:

```sql
select
  split_part(lower(email), '@', 1) as login_username,
  count(*) as total_accounts,
  array_agg(lower(email) order by lower(email)) as emails
from auth.users
group by 1
having count(*) > 1;
```

### 4.6 Seed demo gọn để test phiên bản mới

SQL seed gọn hiện nằm ở:

- [`supabase/seeds/large_demo_seed.sql`](/D:/Project/Hệ thống CRM quản lý khách hàng/nexcrm-scaffold/supabase/seeds/large_demo_seed.sql)

Seed này:

- Tạo bộ dữ liệu gọn hơn nhưng vẫn đủ `dashboard`, `pipeline`, `tickets`, `campaign`, `automation`, `notifications`, `audit logs`
- Có thể chạy lại nhiều lần vì script sẽ dọn các bản ghi demo cũ trước khi tạo mới
- Yêu cầu project đã có ít nhất 1 profile active

### 4.7 Khuyến nghị cho môi trường dev

Nếu anh/chị muốn đăng nhập ngay mà không cần xác nhận email:

1. Vào `Authentication`
2. Chọn `Providers`
3. Mở provider `Email`
4. Tắt yêu cầu xác nhận email nếu đang bật

Điểm này giúp test nội bộ nhanh hơn.

## 5. Cách chạy local

### 5.1 Cài package

```bash
npm install
```

### 5.2 Chạy dev server

```bash
npm run dev
```

### 5.3 Nếu bị trắng màn, kiểm tra theo thứ tự này

1. Kiểm tra `.env.local` có đúng tên biến không
2. Restart dev server
3. Mở DevTools Console và xem có lỗi `supabaseUrl is required` hay không
4. Kiểm tra schema đã chạy chưa
5. Kiểm tra đã tạo user trong Auth chưa
6. Kiểm tra đã tạo profile trùng UUID chưa

### 5.4 Dấu hiệu cấu hình đúng

Khi cấu hình đúng:

- Mở app sẽ thấy trang login
- Đăng nhập xong vào được dashboard
- Nếu là `super_admin` hoặc `admin` sẽ thấy menu `Cài Đặt`

## 6. Điều hướng và thao tác chung

### Sidebar

Sidebar bên trái chứa:

- `TỔNG QUAN`
- `KHÁCH HÀNG`
- `HỖ TRỢ`
- `MARKETING`
- `HỆ THỐNG` nếu đủ quyền

Sidebar có thể:

- Thu gọn về 64px
- Mở rộng đầy đủ

### Header

Header gồm:

- Breadcrumb
- Nút `Tìm kiếm`
- Nút dark/light mode
- Chuông thông báo
- Menu người dùng

### Global search

Mở bằng:

- `Cmd + K`
- `Ctrl + K`
- Hoặc nút `Tìm kiếm`

Nhóm kết quả:

- Khách hàng
- Ticket
- Chiến dịch

### Notification center

Chuông thông báo:

- Hiển thị số lượng chưa đọc
- Có nút `Đánh dấu tất cả đã đọc`
- Bấm vào item sẽ đánh dấu đọc và chuyển tới màn liên quan

Realtime:

- Có notification mới cho đúng `user_id` thì badge cập nhật ngay

## 7. Hướng dẫn theo từng phân hệ

## 7.1 Dashboard

Mục đích:

- Xem tổng số khách hàng
- Theo dõi doanh thu tháng
- Xem số đơn hàng tháng
- Theo dõi ticket đang mở

Có các bộ lọc nhanh:

- `Hôm nay`
- `7 ngày`
- `30 ngày`

Ngoài ra còn có:

- Biểu đồ doanh thu
- Phân bổ loại khách hàng
- Top khách hàng
- Ticket ưu tiên cao

## 7.2 Khách hàng

### Danh sách khách hàng

Hỗ trợ:

- Tìm theo tên, phone, email
- Lọc theo loại khách hàng
- Sort
- Phân trang
- Bulk select
- Bulk change type
- Xóa mềm hàng loạt

### Thêm khách hàng

Validation chính:

- Họ tên tối thiểu 2 ký tự
- Phone đúng regex Việt Nam
- Email hợp lệ nếu có nhập
- Phân loại bắt buộc

### Xóa khách hàng

Xóa hiện tại là soft delete:

- `is_active = false`
- `customer_type = inactive`

### Chi tiết khách hàng

Có các tab:

- `Lịch Sử`
- `Giao Dịch`
- `Tickets`
- `Ghi Chú`

Có thể:

- Đổi loại khách hàng
- Đổi người phụ trách
- Thêm ghi chú

## 7.3 Giao dịch

Màn giao dịch hỗ trợ:

- Lọc ngày
- Lọc phương thức thanh toán
- Lọc trạng thái
- Tìm theo hóa đơn hoặc khách hàng

### Tạo giao dịch

Form cho phép:

- Chọn khách hàng
- Tự sinh mã hóa đơn nếu bỏ trống
- Thêm nhiều dòng sản phẩm
- Tính subtotal, discount, tax và total
- Chọn payment method

Lưu ý:

- Trigger DB sẽ tự cập nhật `total_spent`, `total_orders`, `last_order_at` cho khách hàng

## 7.4 Ticket hỗ trợ

### Danh sách ticket

Có 2 chế độ:

- `Kanban`
- `Bảng`

Kanban cho phép:

- Kéo thả ticket sang cột khác để đổi trạng thái
- Bấm vào card để mở chi tiết

Realtime:

- Insert vào `support_tickets`: toast và refetch
- Update vào `support_tickets`: refetch và highlight

### Tạo ticket

Có thể chọn:

- Khách hàng
- Danh mục
- Ưu tiên
- Kênh
- Người phụ trách

### Chi tiết ticket

Cho phép:

- Sửa tiêu đề
- Đổi trạng thái
- Đổi ưu tiên
- Đổi người phụ trách
- Gửi phản hồi
- Gửi ghi chú nội bộ
- Đóng ticket nếu đang `resolved`

## 7.5 Chiến dịch marketing

Hỗ trợ:

- Lọc theo trạng thái
- Tạo chiến dịch bằng wizard 4 bước
- Sửa
- Nhân bản
- Xóa

Wizard gồm:

1. Thông tin
2. Đối tượng
3. Nội dung
4. Xem lại và khởi động

## 7.6 Chăm sóc tự động

Hỗ trợ:

- Xem danh sách rule
- Bật/tắt rule
- Tạo rule mới

Form tạo rule gồm:

- Tên quy tắc
- Điều kiện kích hoạt
- Kênh gửi
- Nội dung

## 7.7 Báo cáo

Có các tab:

- `Doanh Thu`
- `Khách Hàng`
- `Ticket`
- `Marketing`

Có thể:

- Chọn date range
- Chọn nhóm theo ngày/tuần/tháng
- Bấm `Xuất Excel`

## 7.8 Quản lý người dùng

Chỉ `super_admin`, `admin`, `director` thấy màn này.

Hỗ trợ:

- Xem user
- Đổi role
- Bật/tắt active
- Tạo user mới
- Sửa user
- Xóa hoặc vô hiệu hóa user

Lưu ý:

- App đang tạo user bằng Supabase Auth rồi tạo tiếp `profiles`
- Nếu user còn liên kết dữ liệu, app có thể chuyển sang vô hiệu hóa thay vì xóa cứng

## 7.9 Cài đặt

Chỉ `super_admin` và `admin` thấy màn này.

Có 3 tab:

- `Tổ Chức`
- `Thông Báo`
- `Tích Hợp`

### Dữ Liệu Demo

Trong tab `Tổ Chức` có nút `Dữ Liệu Demo`.

Nút này sẽ tạo:

- 3 khách hàng
- 3 giao dịch
- 2 ticket
- 1 chiến dịch

Lưu ý:

- Có thể seed trùng nếu bấm nhiều lần

### Tích Hợp

Tab `Tích Hợp` hiện:

- POS webhook URL
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 7.10 Nhật ký hệ thống

Chỉ `super_admin`, `admin`, `director` thấy màn này.

Có thể:

- Lọc theo user
- Lọc theo action
- Lọc theo entity
- Lọc theo ngày
- Xem before/after

## 8. Các giới hạn hiện tại của app

### 8.1 `profiles` chưa có cột `email`

Hệ quả:

- Email ở màn danh sách user đang dựa vào cache cục bộ phía client
- Sửa email ở màn user chưa đồng bộ ngược vào `auth.users`

### 8.2 Settings có fallback local nếu thiếu migration hoặc thiếu row

Hệ quả:

- Settings hiện đã có bảng `app_settings` trong Supabase
- Nếu chưa chạy schema/migration mới hoặc thiếu row `default`, app sẽ fallback tạm về local cache
- Nên đảm bảo schema mới đã được chạy để settings, logo và notification preferences lưu đúng vào DB

### 8.3 Customer notes và system events ticket đang đi qua `audit_logs`

Hệ quả:

- Ghi chú khách hàng và system event ticket không có bảng domain riêng
- Dữ liệu này đang được dựng từ `audit_logs`

## 9. Cách deploy lên Vercel

## 9.1 Chuẩn bị repo

Khuyến nghị:

1. Đưa mã nguồn lên GitHub
2. Đảm bảo app build được local bằng `npm run build`

## 9.2 Import project vào Vercel

1. Vào [Vercel Dashboard](https://vercel.com/dashboard)
2. Bấm `Add New Project`
3. Import repo GitHub
4. Chọn project `nexcrm-scaffold`

Với Vite app, Vercel thường tự nhận đúng cấu hình. Nếu cần nhập tay:

- Framework: `Vite`
- Build command: `npm run build`
- Output directory: `dist`

Repo hiện đã có sẵn file [`vercel.json`](/D:/Project/Hệ thống CRM quản lý khách hàng/nexcrm-scaffold/vercel.json) để rewrite mọi route về `index.html`, giúp các đường dẫn như `/dashboard`, `/customers/123` hoạt động đúng khi refresh hoặc mở trực tiếp trên Vercel.

## 9.3 Cấu hình biến môi trường trên Vercel

Trong `Project Settings` → `Environment Variables`, thêm:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Thêm cho ít nhất:

- Production
- Preview

Nếu anh/chị dùng dev trên Vercel thì thêm cả Development.

Lưu ý rất quan trọng:

- Với Vite, env được nhúng lúc build
- Sau khi sửa env trên Vercel, phải redeploy

## 9.4 Deploy

Sau khi thêm env:

1. Bấm deploy lần đầu
2. Chờ build xong
3. Mở URL `*.vercel.app`

Nếu mở ra trắng màn trên Vercel, kiểm tra:

- Env có nhập đúng tên chưa
- Có redeploy sau khi sửa env chưa
- Supabase schema đã chạy chưa
- User/profile đã tạo chưa

## 10. Cách tạo domain riêng trên Vercel

Theo tài liệu chính thức của Vercel, domain được thêm trong `Project Settings > Domains`, sau đó cấu hình DNS theo loại domain. Với apex domain thường dùng A record, còn subdomain thường dùng CNAME; Vercel cũng hỗ trợ nameserver method. Nguồn: [Vercel Docs: Setting up a custom domain](https://vercel.com/docs/domains/set-up-custom-domain), [Vercel Docs: Adding & Configuring a Custom Domain](https://vercel.com/docs/concepts/projects/domains/add-a-domain).

### 10.1 Nếu chưa có domain

Anh/chị có thể:

- Mua domain tại Vercel
- Hoặc mua tại nhà đăng ký khác như Cloudflare, Namecheap, GoDaddy

## 10.2 Gắn domain vào project

1. Vào project trên Vercel
2. Chọn `Settings`
3. Chọn `Domains`
4. Bấm `Add Domain`
5. Nhập domain, ví dụ:
   - `nexcrm.vn`
   - `www.nexcrm.vn`

Khuyến nghị:

- Thêm cả domain gốc và `www`
- Chọn 1 domain làm domain chính

## 10.3 Cấu hình DNS

### Trường hợp domain gốc

Ví dụ `nexcrm.vn`

Vercel thường yêu cầu:

- A record cho apex domain

Theo hướng dẫn hiện tại của Vercel, giá trị A record phổ biến là:

- `76.76.21.21`

### Trường hợp subdomain

Ví dụ `www.nexcrm.vn`

Vercel sẽ hiển thị giá trị CNAME cụ thể cho project. Anh/chị nên dùng đúng giá trị mà Vercel đang yêu cầu trong dashboard hoặc `Domains > Inspect`, thay vì đoán thủ công.

### Trường hợp dùng nameserver của Vercel

Nếu chọn nameserver method:

- Đổi nameserver của domain về nameserver do Vercel cung cấp
- Sau đó quản lý DNS ngay trong Vercel

## 10.4 Xác minh và SSL

Sau khi DNS trỏ đúng:

- Vercel sẽ verify domain
- SSL certificate được cấp tự động

Thông thường chỉ cần chờ DNS propagate.

## 10.5 Redirect domain

Khuyến nghị:

- Chọn `www.nexcrm.vn` hoặc `nexcrm.vn` làm domain chính
- Redirect domain còn lại về domain chính để tránh duplicate URL

## 11. FAQ / xử lý sự cố

### Tôi đã có `.env.local`, vì sao vẫn trắng màn?

Kiểm tra theo thứ tự:

1. Tên biến có đúng `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` không
2. Đã restart `npm run dev` chưa
3. Đã chạy `supabase/schema.sql` chưa
4. Đã tạo user trong `Authentication > Users` chưa
5. Đã tạo `profiles` trùng `auth.users.id` chưa

### Ngoài `.env.local` tôi có cần tạo bảng không?

Có. Chắc chắn cần.

App hiện tại phụ thuộc vào schema thật trong Supabase, không thể chạy chỉ với env.

### Ngoài `.env.local` tôi có cần tạo tài khoản trong Supabase không?

Có. Chắc chắn cần.

Ít nhất phải có:

- 1 user trong Supabase Auth
- 1 profile tương ứng trong bảng `profiles`

### Tôi tạo user trong Auth rồi, sao vẫn không login được?

Nguyên nhân hay gặp:

- Chưa tạo `profiles`
- `profiles.id` không khớp với `auth.users.id`
- Email confirmation đang bật nhưng chưa xác nhận

### Tôi đã thêm env trên Vercel nhưng site production vẫn lỗi

Rất thường do:

- Env thêm sau khi build xong
- Chưa redeploy

Với Vite, sửa env trên Vercel xong phải redeploy.

### Tôi seed demo nhiều lần thì sao?

- Nút `Dữ Liệu Demo` trong Settings vẫn có thể tạo trùng nếu bấm nhiều lần
- Riêng file SQL [`supabase/seeds/large_demo_seed.sql`](/D:/Project/Hệ thống CRM quản lý khách hàng/nexcrm-scaffold/supabase/seeds/large_demo_seed.sql) đã dọn dữ liệu demo cũ trước khi seed lại, nên có thể dùng để reset bộ dữ liệu test gọn

### User role nào nên dùng để test toàn bộ hệ thống?

Khuyến nghị:

- Tạo một user `super_admin` để test đầy đủ mọi màn

## 12. Tài liệu chính thức tham khảo

- [Supabase Docs: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Docs: User Management](https://supabase.com/docs/guides/auth/managing-user-data)
- [Vercel Docs: Setting up a custom domain](https://vercel.com/docs/domains/set-up-custom-domain)
- [Vercel Docs: Add a domain](https://vercel.com/docs/getting-started-with-vercel/domains)

## 13. Khuyến nghị tiếp theo

Nếu anh/chị muốn vận hành ổn định hơn, nên làm tiếp 3 việc:

1. Thêm cột `username` hoặc `email` vào `profiles` để bỏ phụ thuộc vào local-part của `auth.users`
2. Thêm trigger hoặc provisioning flow tự tạo `profiles` sau khi tạo `auth.users` nếu muốn mở rộng Google sign-in/self-service onboarding
3. Tách `customer notes` và `ticket status events` khỏi `audit_logs` thành bảng domain riêng
