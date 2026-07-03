# REST API Endpoints Specification
## Project: Lumis (Academic Document Management & AI Synthesis Platform)

> **Phiên bản:** 2.0 — Cập nhật lần cuối: 2026-07-03  
> Đã xóa bỏ hoàn toàn vai trò `MODERATOR`. Chỉ còn `STUDENT` và `ADMIN`.

---

## 1. Authentication & Users

### `POST /api/auth/register`
- **Access:** Public
- **Body:** `{ name, email, password }`
- **Response:** Success (OTP sent to email)

### `POST /api/auth/verify-otp`
- **Access:** Public
- **Body:** `{ email, otpCode }`
- **Response:** `{ token, user }`

### `POST /api/auth/login`
- **Access:** Public
- **Body:** `{ email, password }`
- **Response:** `{ token, user }`

### `POST /api/auth/google`
- **Access:** Public — Chỉ chấp nhận email `@fpt.edu.vn`
- **Body:** `{ email, name, avatarUrl? }`
- **Response:** `{ token, user }` (Tự động tạo tài khoản nếu chưa tồn tại)

### `GET /api/users`
- **Access:** Admin
- **Query:** `?page&limit&role=STUDENT|ADMIN&status=ACTIVE|SUSPENDED`
- **Response:** Danh sách user + thống kê `_count { documents, chatSessions }`

### `PUT /api/users/[id]`
- **Access:** Admin
- **Body:** `{ role?, status?, tier? }`
- **Response:** Updated user (Tự chặn Admin tự xóa/hạ quyền chính mình)

---

## 2. Documents

### `POST /api/documents/upload-url`
- **Access:** Student, Admin
- **Body:** `{ filename, mimeType, fileSize, fileHash? }`
- **Response (mới):** `{ deduplicated: false, uploadUrl, fileUrl, key }` hoặc `{ deduplicated: true, fileUrl }` (nếu file đã tồn tại — tiết kiệm storage)

### `POST /api/documents`
- **Access:** Student, Admin
- **Body:** `{ title, description?, subjectId, visibility, fileUrl, fileHash, fileSize, mimeType, pageCount }`
- **Auto-logic:** `PRIVATE` → status `APPROVED` ngay; `PUBLIC` → status `PENDING` chờ Admin duyệt

### `GET /api/documents`
- **Access:** Public (chỉ APPROVED+PUBLIC), Student/Admin (thêm PRIVATE của mình)
- **Query:** `?subjectId&status&search&page&pageSize&visibility`
- **Response:** Paginated documents

### `GET /api/documents/[id]`
- **Access:** Public (nếu APPROVED+PUBLIC), Student/Admin
- **Side-effect:** Tự động ghi `document_views` mỗi lần xem

### `POST /api/documents/[id]/moderate`
- **Access:** Admin
- **Body:** `{ decision: "APPROVED"|"REJECTED", rejectionReason? }` *(hoặc dùng key `status` thay `decision` — cả hai đều được nhận)*
- **Side-effect:** Ghi `audit_logs`

### `DELETE /api/documents/[id]`
- **Access:** Owner hoặc Admin
- **Action:** Soft delete (set `deletedAt`)

### `POST /api/documents/[id]/restore`
- **Access:** Owner hoặc Admin
- **Action:** Xóa `deletedAt` (chỉ hoạt động trong vòng 30 ngày — đọc từ `system_configs`)

### `DELETE /api/admin/documents/[id]/hard`
- **Access:** Admin only
- **Action:** Hard delete (xóa DB + Cloud Storage)

### `GET /api/documents/[id]/audit`
- **Access:** Admin
- **Response:** Audit logs liên quan đến tài liệu

---

## 3. Document Interactions (Tương tác Tài liệu)

### `POST /api/documents/[id]/ratings`
- **Access:** Student, Admin
- **Body:** `{ rating: 1-5, comment? }`
- **Response:** Rating record (Unique: 1 rating/user/tài liệu)

### `PUT /api/documents/[id]/ratings`
- **Access:** Owner of rating
- **Body:** `{ rating, comment? }`
- **Response:** Updated rating

### `GET /api/documents/[id]/ratings`
- **Access:** Public
- **Response:** `{ average, total, items[] }`

### `POST /api/bookmarks/[documentId]`
- **Access:** Student, Admin
- **Response:** Bookmark record

### `DELETE /api/bookmarks/[documentId]`
- **Access:** Owner
- **Response:** 204 No Content

### `GET /api/bookmarks`
- **Access:** Student, Admin
- **Response:** Danh sách tài liệu đã lưu của user hiện tại

### `POST /api/documents/[id]/share`
- **Access:** Owner
- **Body:** `{ sharedWith: userId, permission: "view"|"comment"|"edit" }`
- **Response:** DocumentShare record

---

## 4. Subjects (Môn học)

### `GET /api/subjects`
- **Access:** Public
- **Query:** `?search&status`
- **Response:** Danh sách subjects

### `POST /api/subjects`
- **Access:** Admin
- **Body:** `{ name, code }`
- **Side-effect:** Ghi `audit_logs`

### `PUT /api/subjects/[id]`
- **Access:** Admin
- **Body:** `{ name?, code?, status? }`
- **Side-effect:** Ghi `audit_logs`

### `DELETE /api/subjects/[id]`
- **Access:** Admin
- **Action:** Soft suspend (status → SUSPENDED)
- **Side-effect:** Ghi `audit_logs`

### `POST /api/subjects/suggest`
- **Access:** Student
- **Body:** `{ name }`

### `GET /api/subjects/suggest`
- **Access:** Admin
- **Response:** Danh sách đề xuất PENDING

### `POST /api/subjects/suggest/[id]/moderate`
- **Access:** Admin
- **Body:** `{ action: "APPROVED"|"REJECTED" }`

---

## 5. Collections & Tags

### `GET /api/collections`
- **Access:** Student, Admin
- **Response:** Danh sách collection của user hiện tại

### `POST /api/collections`
- **Access:** Student, Admin
- **Body:** `{ name }`

### `POST /api/collections/[id]/documents`
- **Access:** Owner
- **Body:** `{ documentId }`

### `DELETE /api/collections/[id]/documents/[documentId]`
- **Access:** Owner

---

## 6. AI Chatbot & RAG

### `POST /api/ai/chat`
- **Access:** Student, Admin
- **Body:** `{ message, sessionId?, documentId?, scope: "SINGLE_DOCUMENT"|"SUBJECT"|"GLOBAL" }`
- **Flow:**
  1. Kiểm tra `ai_usage_logs` — nếu đạt giới hạn ngày (đọc từ `system_configs`) → `429 Too Many Requests`
  2. Kiểm tra `ai_cache` — nếu cache hit → trả về ngay (không gọi OpenAI)
  3. Gọi n8n Webhook RAG → nhận `{ answer, citations }`
  4. Lưu `chat_messages`, `citations`, `ai_usage_logs`, `ai_cache`
- **Response:** `{ answer, citations[], sessionId }`

### `GET /api/ai/limit`
- **Access:** Student, Admin
- **Response:** `{ usedToday, limit, tier, remaining }`

### `GET /api/ai/sessions`
- **Access:** Student, Admin
- **Response:** Danh sách chat sessions của user

### `GET /api/ai/sessions/[sessionId]/messages`
- **Access:** Owner
- **Response:** Lịch sử tin nhắn + citations

---

## 7. Admin Settings (System Configs)

### `GET /api/admin/configs`
- **Access:** Admin
- **Response:** Toàn bộ cấu hình hệ thống

### `PUT /api/admin/configs/[key]`
- **Access:** Admin
- **Body:** `{ value }`
- **Response:** Updated config (Thay đổi có hiệu lực ngay, không cần redeploy)

---

## 8. Analytics Dashboard

### `GET /api/admin/stats`
- **Access:** Admin
- **Response:**
  ```json
  {
    "totalUsers": 0,
    "totalDocuments": 0,
    "pendingModeration": 0,
    "totalViews": 0,
    "aiUsageToday": 0,
    "topDocuments": [],
    "newUsersThisWeek": 0
  }
  ```

### `GET /api/admin/stats/documents`
- **Access:** Admin
- **Query:** `?from&to&subjectId`
- **Response:** Document views theo ngày (dùng bảng `document_views`)

---

## 9. Notifications

### `GET /api/notifications`
- **Access:** Student, Admin
- **Response:** Danh sách thông báo chưa đọc/đã đọc

### `PUT /api/notifications/[id]/read`
- **Access:** Owner
- **Response:** 200 OK

### `PUT /api/notifications/read-all`
- **Access:** Student, Admin
- **Response:** 200 OK

---

## 10. Payments & Subscriptions

### `POST /api/payments/checkout`
- **Access:** Student
- **Body:** `{ planId }`
- **Response:** Thông tin chuyển khoản + VietQR template

### `POST /api/payments/webhook`
- **Access:** System/Service
- **Body:** `{ transferContent, amount, status }`
- **Side-effect:** Nâng tier user lên PREMIUM nếu thanh toán thành công

### `GET /api/payments/receipts`
- **Access:** Student, Admin
- **Response:** Lịch sử giao dịch của user
