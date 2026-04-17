# Kế Hoạch Test Và Kiểm Thử NexCRM (Phiên Bản Hiện Tại)

Cập nhật: 17/04/2026

## 1. Mục tiêu

1. Xác nhận hệ thống hoạt động đúng theo vai trò và module.
2. Đảm bảo không còn trạng thái “thành công ảo” khi thao tác thất bại.
3. Xác nhận build/test tự động pass trước khi release.

## 2. Môi trường kiểm thử

1. Frontend local: `http://localhost:5173`
2. Backend: Supabase project DEV đã chạy đúng canonical track (`20260417090000_canonical_baseline.sql`; optional `20260417090100_ops_scheduler_optional.sql`)
3. Dữ liệu: seed v2 (`clear_large_demo_seed_v2.sql` -> `large_demo_seed_v2.sql`)

## 3. Test tự động

## 3.1 Lệnh chạy

```bash
npm run build
npm run test
```

## 3.2 Danh sách test hiện có

1. `tests/authValidation.test.ts`
2. `tests/authPasswordResetFlow.test.ts`
3. `tests/authPasswordUpdateFlow.test.ts`
4. `tests/profileEmailMapping.test.ts`
5. `tests/profileServiceResetPassword.test.ts`
6. `tests/profileServiceVisibility.test.ts`
7. `tests/sharedAsyncAction.test.ts`
8. `tests/useAppMutation.test.tsx`
9. `tests/exportService.test.ts`
10. `tests/reportService.test.ts`

Tiêu chí pass:

1. `npm run build` không có TypeScript error
2. `npm run test` pass toàn bộ test file

## 4. Checklist kiểm thử thủ công (UAT/SIT)

## 4.1 Auth và user management

| ID | Vai trò | Bước kiểm thử | Kết quả mong đợi |
|----|--------|---------------|------------------|
| TC-AUTH-01 | admin | Đăng nhập `/login` với email/password hợp lệ | Đăng nhập thành công, chuyển `/dashboard` |
| TC-AUTH-02 | user bị khóa | Đăng nhập tài khoản `is_active=false` | Bị chặn, thông báo đúng tiếng Việt |
| TC-USER-01 | admin | Tạo user mới từ `/admin/users` với role `admin` | User tạo thành công, hiển thị email/role/department đúng |
| TC-USER-02 | super_admin | Tự đổi role của chính mình xuống role thấp hơn | Bị chặn, không cho tự hạ quyền |
| TC-USER-03 | super_admin | Tự vô hiệu hóa hoặc xóa chính mình | Bị chặn |
| TC-USER-04 | admin/super_admin | Cập nhật role user khác | Cập nhật thành công, UI phản ánh đúng |

## 4.2 Customer và soft delete

| ID | Vai trò | Bước kiểm thử | Kết quả mong đợi |
|----|--------|---------------|------------------|
| TC-CUS-01 | sales | Tạo khách hàng mới | Tạo thành công |
| TC-CUS-02 | sales/admin/super_admin/director | Xóa mềm khách hàng | Xóa mềm thành công nếu đúng quyền |
| TC-CUS-03 | role không đủ quyền | Bấm xóa khách hàng | Không cho thao tác hoặc báo lỗi đúng, không có toast “thành công ảo” |
| TC-CUS-04 | bất kỳ | Sau khi xóa mềm, tải lại danh sách | Bản ghi không còn trong list active |

## 4.3 Pipeline, deal, task

| ID | Vai trò | Bước kiểm thử | Kết quả mong đợi |
|----|--------|---------------|------------------|
| TC-PIPE-01 | sales | Vào `/pipeline` xem KPI/số liệu | Có dữ liệu hiển thị |
| TC-PIPE-02 | sales | Kéo thả stage deal được assign cho chính mình | Cập nhật stage thành công |
| TC-PIPE-03 | director | Thử xóa deal/task | Bị chặn đúng quyền, không báo thành công ảo |
| TC-PIPE-04 | super_admin/admin | Xóa deal/task | Xóa thành công, dữ liệu biến mất sau refresh |
| TC-PIPE-05 | role không đủ quyền | Thử cập nhật/xóa qua UI | UI khóa thao tác hoặc báo lỗi đúng tiếng Việt |

## 4.4 Ticket, Campaign, Automation

| ID | Vai trò | Bước kiểm thử | Kết quả mong đợi |
|----|--------|---------------|------------------|
| TC-TICKET-01 | cskh | Tạo ticket mới | Thành công |
| TC-TICKET-02 | cskh | Đổi trạng thái ticket | Thành công, realtime cập nhật |
| TC-CAMP-01 | marketing/admin | Tạo campaign và lưu draft | Thành công |
| TC-AUTO-01 | marketing/admin | Tạo automation rule | Thành công |

## 4.5 Admin/Audit/Settings

| ID | Vai trò | Bước kiểm thử | Kết quả mong đợi |
|----|--------|---------------|------------------|
| TC-ADM-01 | admin | Vào `/admin/settings` và lưu config | Thành công |
| TC-ADM-02 | admin | Lưu API key provider | Dữ liệu được mã hóa, không lưu plaintext |
| TC-AUD-01 | admin/director | Vào `/admin/audit` | Có log thao tác gần nhất |

## 5. SQL verify sau test

## 5.1 Verify soft delete customer

```sql
select id, full_name, deleted_at, customer_type
from public.customers
where id = '<CUSTOMER_ID>';
```

Kỳ vọng:

1. `deleted_at` khác `null`
2. `customer_type = 'inactive'`

## 5.2 Verify không thành công ảo khi delete deal/task

```sql
select id, deleted_at, stage
from public.deals
where id = '<DEAL_ID>';

select id, deleted_at, status
from public.tasks
where id = '<TASK_ID>';
```

Kỳ vọng:

1. Nếu UI báo thành công thì `deleted_at` phải khác `null`
2. Nếu không đủ quyền thì không có thay đổi dữ liệu

## 5.3 Verify role và profile

```sql
select p.id, u.email, p.role, p.department, p.is_active, p.org_id
from public.profiles p
join auth.users u on u.id = p.id
where lower(u.email) = lower('<EMAIL>');
```

## 6. Tiêu chí nghiệm thu

1. Build pass
2. Test tự động pass
3. Toàn bộ test critical trong mục 4 pass
4. Không còn lỗi “thành công ảo”
5. Không còn thông báo lỗi tiếng Anh ở các flow chính

## 7. Mẫu ghi lỗi kiểm thử

1. Mã test case: `TC-...`
2. Môi trường: DEV/STAGING/PROD
3. Vai trò test
4. Bước tái hiện
5. Kết quả thực tế
6. Kỳ vọng
7. Log/Screenshot/SQL chứng minh
