# Audit Report - NexCRM SaaS CRM

## 1. Executive Summary

- Tổng số mục đã ghi nhận: **32**
- **CRITICAL:** 5
- **HIGH:** 7
- **MEDIUM:** 11
- **LOW:** 3
- **INFO:** 6

Nhận định tổng quan: hệ thống có nền tảng tốt ở lớp migration (RLS, trigger, index cơ bản), nhưng hiện đang có khoảng cách lớn giữa **schema mới** và **service layer/page layer đang chạy thực tế**. 5 lỗi CRITICAL cần xử lý ngay trước khi đưa production.

## 2. Full Issues Table

| ID | Severity | Category | Location | Vấn đề | Impact | Giải pháp đề xuất |
|---|---|---|---|---|---|---|
| BK-01 | CRITICAL | Backend Security | `supabase/functions/_shared/common.ts:122-190` | `isServiceRoleToken()` chỉ decode JWT payload để check `role=service_role` (không verify chữ ký), sau đó `resolveCaller()` cấp quyền service role. | Có thể forge token để bypass auth/role check ở các Edge Function đang bật `allowServiceRole`. | Bỏ hoàn toàn nhánh tự nhận diện service-role từ JWT payload. Chỉ cho service-role qua secret header riêng hoặc signed internal token có verify cryptographic. |
| DB-09 | CRITICAL | Database Integrity | `src/hooks/useNexcrmQueries.ts:6-29`, `src/pages/**` dùng `useNexcrmQueries`, `src/services/*.ts` legacy | Ứng dụng đang dùng service legacy không khớp migration mới (thiếu `org_id`, sai tên cột như `due_date`, `.owner_id`, `expected_close_at`, `click_count`). | Lỗi ghi dữ liệu diện rộng, fail mutation, sai hành vi multi-tenant, không đạt NFR bảo mật/traceability. | Chuyển toàn bộ pages sang data-layer mới (`src/services/data-layer.ts` + `useDataLayer`) hoặc refactor toàn bộ legacy service để khớp 100% schema mới. |
| DB-10 | CRITICAL | Multi-tenant Isolation | `supabase/migrations/000_full_schema.sql:863-940`, `supabase/functions/manage-profile-user/index.ts:275-283` | `handle_new_user()` tự tạo org mới khi metadata thiếu `org_id`; luồng tạo user admin (`manage-profile-user`) lại không truyền `org_id`. | User mới có thể bị tách sang tenant khác ngoài ý muốn, phá vỡ quản trị user nội bộ doanh nghiệp. | Khi create user phải bắt buộc truyền `org_id` + validate chặt trong trigger. Với use case tạo thành viên nội bộ, disable auto-create org. |
| BK-06 | CRITICAL | Backend Security | `supabase/functions/dispatch-communication/index.ts:211-238` | Function legacy `dispatch-communication` không có verify JWT/role trước khi xử lý gửi outbound. | Nếu function còn deploy public, có thể bị abuse để spam email/SMS hoặc tiêu tốn quota provider. | Gỡ bỏ function legacy khỏi deploy hoặc thêm auth/authorization bắt buộc tương tự function mới. |
| BC-03 | CRITICAL | Consistency (Report vs Code) | `src/utils/permissions.ts:18,43,48`, `supabase/migrations/000_full_schema.sql:1680-1938`, `src/App.tsx:47-73` | Ma trận quyền không nhất quán giữa tài liệu, FE permissions, RLS và route guards (ví dụ FE cho `cskh` tạo customer/deal read rộng hơn DB). | Người dùng gặp 403 khó hiểu, logic phân quyền khó kiểm thử, tăng rủi ro sai quyền khi policy thay đổi. | Định nghĩa một permission matrix chuẩn duy nhất (single source), generate đồng bộ cho FE + RLS + test ACL. |
| DB-02 | HIGH | RLS Coverage / Access Model | `supabase/migrations/000_full_schema.sql:2051-2053,2169-2171`, `src/services/shared.ts:1238-1245`, `src/services/communicationService.ts:265-273` | RLS đã chặn INSERT trực tiếp vào `audit_logs` và `outbound_messages`, nhưng client service legacy vẫn insert trực tiếp. | Các luồng audit/outbound fail runtime hoặc buộc dùng workaround không an toàn. | Mọi insert các bảng này phải đi qua trigger hoặc Edge Function dùng admin client; loại bỏ insert trực tiếp từ client. |
| DB-03 | HIGH | Data Lifecycle / FK | `supabase/migrations/000_full_schema.sql` (FK chủ yếu `ON DELETE SET NULL/RESTRICT`) + soft delete toàn hệ thống | Hệ thống dùng soft delete nhưng không có quy trình đồng bộ lifecycle cho bản ghi liên quan (customer -> deals/tasks/tickets/notes). | Dữ liệu "mồ côi logic", dashboard/list có thể đếm sai hoặc hiển thị record không mong muốn. | Thêm quy tắc lifecycle: trigger/worker xử lý khi parent bị soft delete; chuẩn hóa query filter theo trạng thái parent. |
| DB-07 | HIGH | Soft Delete Consistency | `src/services/customerService.ts:137,275-286`, `src/services/ticketService.ts:58-95`, `src/services/transactionService.ts:52-89` | Legacy services dùng `is_active`/query all records thay vì chuẩn `deleted_at is null`; `softDelete` customer không set `deleted_at`. | Inconsistent giữa module, khó truy vết, sai kỳ vọng "soft delete chuẩn". | Chuẩn hóa toàn bộ service/query theo `deleted_at`; cập nhật `softDelete` set `deleted_at` và status tương ứng. |
| DB-08 | HIGH | Security - Data at Rest | `supabase/migrations/000_full_schema.sql:473-483` | `email_api_key`, `sms_api_key`, `pos_api_key` đang lưu plaintext trong `app_settings`. | Rủi ro lộ secret khi backup/log/SQL dump hoặc cấp quyền đọc sai. | Dùng Supabase Vault/KMS hoặc mã hóa cấp ứng dụng (envelope encryption), chỉ giải mã tại Edge Function runtime. |
| BK-04 | HIGH | Backend Security (SSRF) | `supabase/functions/pos-sync/index.ts:170-176`, `supabase/functions/_shared/test-connection-handler.ts:90-100,248` | Endpoint POS/test connection cho phép fetch URL do user config mà chưa chặn private IP/range hoặc scheme chặt. | Có thể bị khai thác SSRF để quét nội bộ hoặc gọi endpoint nhạy cảm. | Validate URL nghiêm: chỉ `https`, block RFC1918/localhost/link-local, domain allowlist theo provider. |
| FE-06 | HIGH | Frontend RBAC | `src/App.tsx:47-73`, `src/components/shared/Can.tsx` (không được dùng) | Route guard chỉ chặn nhóm admin; nhiều route nghiệp vụ không gate theo quyền. `Can` component đã có nhưng chưa áp dụng. | Người dùng vẫn vào được page không phù hợp rồi fail ở backend/RLS, trải nghiệm và kiểm thử quyền kém ổn định. | Áp dụng `ProtectedRoute(allowedRoles)` hoặc guard theo permission cho toàn bộ route nghiệp vụ; dùng `Can` nhất quán ở action-level UI. |
| BC-05 | HIGH | NFR Compliance | Tổng thể codebase (active path legacy) | NFR trong báo cáo (RLS toàn diện, traceability audit, response ổn định) bị ảnh hưởng vì luồng chạy thực tế chưa khớp schema/policy mới. | Rủi ro fail demo/UAT khi chạy dữ liệu thật đa tenant. | Chốt "runtime path" duy nhất (data-layer mới) rồi đo lại NFR theo checklist định lượng. |
| DB-04 | MEDIUM | Performance / Indexing | `supabase/migrations/000_full_schema.sql:728,790,797` + query pattern `assigned_to` | Thiếu composite index cho pattern phổ biến có kèm tenant scope (ví dụ `org_id + assigned_to` ở customers/deals/tasks). | Truy vấn theo assignee có thể degrade khi dữ liệu tăng lớn nhiều org. | Thêm composite index: `(org_id, assigned_to)` cho customers/deals/tasks; benchmark bằng `EXPLAIN ANALYZE`. |
| DB-06 | MEDIUM | Data Validation | `supabase/migrations/000_full_schema.sql:157,348` | JSONB (`transactions.items`, `campaigns.target_segment`) chưa có DB-level schema check. | Dữ liệu JSON sai shape có thể lọt vào DB, ảnh hưởng report/analytics. | Thêm `CHECK` với json schema function hoặc validate chặt ở Edge Function trước khi ghi. |
| BK-02 | MEDIUM | Abuse Protection | `supabase/functions/_shared/test-connection-handler.ts` | `test-connection` chưa có rate limit/throttling. | Có thể bị gọi dồn dập để brute-force endpoint/provider hoặc tiêu hao quota. | Thêm limit theo `org_id` + `user_id` (ví dụ 5 req/phút), log và cooldown. |
| BK-03 | MEDIUM | Content Security | `supabase/functions/_shared/providers.ts:278-279` | HTML body chỉ `replaceAll("\n","<br />")`, chưa sanitize content template. | Nội dung độc hại có thể đi ra kênh email (phishing/unsafe HTML). | Sanitize HTML whitelist trước khi gửi (DOMPurify/server-side sanitizer). |
| FE-01 | MEDIUM | Type Safety | `src/services/data-layer.ts:376` | Còn dùng `any` ở `applyCursor(query: any, ...)`. | Giảm lợi ích strict mode, dễ lỗi runtime khó trace. | Định nghĩa typed query builder generic thay cho `any`. |
| FE-05 | MEDIUM | State/UX Consistency | `src/hooks/useNexcrmQueries.ts` | Nhiều query hook chưa chuẩn hóa `staleTime`, handling loading/error/empty theo pattern thống nhất. | Refetch không cần thiết và UX không đồng nhất giữa module. | Chuẩn hóa query factory: staleTime, retry, skeleton/error contract chung cho tất cả list/detail hooks. |
| FE-07 | MEDIUM | Validation Drift | `src/pages/customers/CustomerListPage.tsx:79`, `tmp/bao-cao-final-extracted.txt:1178,1515` | Một số rule lệch schema/report: `source` thiếu giá trị `other`; tài liệu và code còn lẫn `due_date`/`due_at`. | Dễ lệch dữ liệu giữa tài liệu SRS và hệ thống thực thi. | Đồng bộ enum/field naming từ DB generated types; cập nhật tài liệu và form schema cùng lúc. |
| FE-08 | MEDIUM | Scalability (Pagination) | `src/services/customerService.ts:121-142`, `ticketService.ts:58-95`, `transactionService.ts:52-89`, `CustomerListPage.tsx:459-461` | List services đang fetch toàn bộ rồi mới phân trang client-side. | Tăng tải network/memory khi dữ liệu lớn, khó đạt mục tiêu response time. | Triển khai server-side pagination/cursor cho tất cả list API + reset page khi filter đổi. |
| PF-02 | MEDIUM | Build/Bundle Performance | Build output (`npm run build`, 2026-04-16), `vite.config.ts` | Không có script `--analyze`; chunk lớn (`xlsx-tools`, `charts`, `jspdf-core`, `pdf-helpers` > ~370KB). | Tăng thời gian tải ban đầu và TTI. | Bổ sung visualizer (`rollup-plugin-visualizer`), lazy-load export/report libs theo route. |
| PF-03 | MEDIUM | Query Caching Strategy | `src/hooks/useNexcrmQueries.ts` | Nhiều list queries dùng default staleTime thay vì policy cache rõ ràng theo nghiệp vụ. | Refetch nhiều, tốn tài nguyên và giảm ổn định UX realtime. | Áp dụng chuẩn staleTime (list 30s-60s, dashboard 1-5 phút), invalidate có mục tiêu. |
| BC-01 | MEDIUM | Documentation Consistency | `tmp/bao-cao-final-extracted.txt:1178,1515` | Báo cáo còn dùng `due_date` và thiếu nhắc tới `pos_sync_logs` dù schema đã có. | Traceability report <-> code không trùng 100%. | Cập nhật chương ERD/UC/NFR theo đúng tên cột/bảng hiện hành từ migration. |
| PF-04 | LOW | Media Optimization | `src/services/data-layer.ts:2502-2515` | Có `getPublicUrl` nhưng chưa áp dụng transform/resize strategy cho ảnh storage. | Tăng bandwidth nếu sau này dùng avatar/file ảnh thật kích thước lớn. | Dùng image transform params hoặc tạo thumbnail pipeline cho ảnh hiển thị list. |
| FE-04 | LOW | Client-side Storage Hygiene | `src/services/supabase.ts`, `src/store/authStore.ts` | Cơ chế custom storage adapter khá phức tạp (local/session dual mode), tăng bề mặt lỗi đồng bộ session. | Rủi ro bug phiên đăng nhập khó tái hiện. | Bổ sung integration test cho chuyển mode remember-me, chuẩn hóa clear session path. |
| BK-05 | LOW | Secret Governance | Toàn bộ repo + deployment config | Không thấy hardcode secret trong code, nhưng chưa có bằng chứng policy xoay vòng/kiểm kê secret theo môi trường. | Rủi ro vận hành khi mở rộng team/deployment. | Thiết lập secret inventory + rotation schedule + CI check chặn commit secrets. |
| DB-01 | INFO | Database Integrity | `supabase/migrations/000_full_schema.sql:953-981` | Race condition tạo mã KH/TK đã được xử lý bằng sequence (`nextval`) thay vì `COUNT(*)`. | Giảm nguy cơ trùng mã khi concurrent insert. | Giữ nguyên, chỉ cần monitor sequence exhaustion theo năm nếu có format reset. |
| DB-05 | INFO | Trigger Correctness | `supabase/migrations/000_full_schema.sql:1000-1062,1188-1232` | Trigger stats đã loại trừ `cancelled/refunded`; trigger audit chỉ gắn cho 4 bảng mục tiêu nên không tạo vòng lặp audit->audit. | Đảm bảo KPI customer ổn định hơn và tránh recursion. | Giữ nguyên, bổ sung test SQL regression cho các trạng thái payment/status. |
| FE-02 | INFO | Frontend Resilience | `src/components/shared/app-error-boundary.tsx`, `src/App.tsx:40-81` | Có Error Boundary bọc toàn app. | Giảm khả năng crash toàn bộ app khi lỗi runtime cục bộ. | Giữ nguyên, có thể bổ sung telemetry (Sentry) cho stack trace production. |
| FE-03 | INFO | Realtime Cleanup | `src/hooks/useRealtime.ts`, `src/pages/tickets/TicketListPage.tsx:381-382` | Subscription realtime có cleanup `removeChannel` khi unmount. | Giảm nguy cơ memory leak/subscription leak. | Giữ nguyên, thêm test mount/unmount cho hooks realtime. |
| BC-02 | INFO | Report vs Runtime Flow | `tmp/bao-cao-final-extracted.txt:630-716`, `src/services/auth.service.ts`, `src/pages/tickets/TicketListPage.tsx` | Sequence auth + ticket realtime nhìn chung phù hợp với code runtime hiện tại. | Tài liệu luồng chính có thể dùng cho demo kỹ thuật. | Duy trì đồng bộ khi refactor sang data-layer mới. |
| BC-04 | INFO | Scope Completeness | `src/App.tsx:47-73` | Thực tế đã có route cho đủ 8 module chính (Auth, Customer, Transaction, Ticket, Automation, Campaign, Analytics/Reports, Admin/Pipeline). | Đảm bảo phạm vi chức năng bám sát mục tiêu báo cáo. | Giữ nguyên, chỉ cần chuẩn hóa permission gate theo module. |

## 3. Top 5 Issues Cần Fix Ngay (CRITICAL)

1. **BK-01** - Sửa ngay cơ chế xác thực service role trong `resolveCaller` để chặn token forge.
2. **DB-09** - Dừng dùng legacy service layer không khớp schema; migrate toàn bộ runtime sang data-layer chuẩn.
3. **DB-10** - Bắt buộc truyền `org_id` khi tạo user nội bộ, ngăn auto-create tenant ngoài ý muốn.
4. **BK-06** - Gỡ hoặc khóa chặt `dispatch-communication` (auth bắt buộc + role check).
5. **BC-03** - Hợp nhất permission matrix giữa FE, RLS và route guards để tránh sai lệch quyền.

## 4. Estimated Effort Per Issue

| ID | Effort ước tính | Ghi chú triển khai |
|---|---|---|
| BK-01 | 0.5-1 ngày | Refactor auth helper + regression test cho tất cả Edge Functions dùng `resolveCaller`. |
| DB-09 | 4-7 ngày | Refactor hooks/pages sang data-layer hoặc sửa toàn bộ legacy services theo schema mới. |
| DB-10 | 1-2 ngày | Sửa create-user flow + trigger guard + migration data cho user đã tạo sai tenant. |
| BK-06 | 0.5 ngày | Remove deployment hoặc thêm auth/authorization + smoke test. |
| BC-03 | 2-3 ngày | Chuẩn hóa ACL matrix và đồng bộ FE/RLS/tests. |
| DB-02 | 1-2 ngày | Chuyển insert audit/outbound qua trigger/function đường chuẩn. |
| DB-03 | 1-2 ngày | Thiết kế lifecycle khi soft delete parent + script backfill. |
| DB-07 | 2-3 ngày | Chuẩn hóa filter `deleted_at` ở tất cả query/mutation path đang dùng. |
| DB-08 | 1-2 ngày | Tích hợp Vault/KMS + rotate key migration. |
| BK-04 | 1-2 ngày | URL validator + denylist private network + test SSRF. |
| FE-06 | 1-2 ngày | Áp guard route + `Can` cho action-level components. |
| BC-05 | 1-2 ngày | Re-run NFR checklist sau khi chốt runtime path chuẩn. |
| DB-04 | 0.5-1 ngày | Thêm index + benchmark truy vấn thực tế. |
| DB-06 | 1-2 ngày | JSON schema check hoặc validator function ở DB/Edge. |
| BK-02 | 0.5-1 ngày | Rate-limit middleware cho `test-connection`. |
| BK-03 | 0.5-1 ngày | Tích hợp sanitizer và test template độc hại. |
| FE-01 | 0.25 ngày | Loại `any`, bổ sung type cho cursor query. |
| FE-05 | 1 ngày | Chuẩn hóa query hook config và state contract. |
| FE-07 | 0.5-1 ngày | Đồng bộ enum/field naming với generated types + update docs. |
| FE-08 | 2-3 ngày | Server-side pagination/cursor cho toàn bộ list module. |
| PF-02 | 0.5-1 ngày | Bổ sung bundle analyzer + tách lazy chunks. |
| PF-03 | 0.5 ngày | Thiết lập staleTime policy theo loại dữ liệu. |
| BC-01 | 0.5 ngày | Chỉnh báo cáo FINAL để đồng bộ schema hiện hành. |
| PF-04 | 0.5 ngày | Thêm chiến lược resize/thumbnail khi dùng ảnh từ storage. |
| FE-04 | 0.5 ngày | Viết integration tests cho auth persistence mode. |
| BK-05 | 0.5-1 ngày | Thiết lập quy trình secret inventory/rotation và CI guard. |

