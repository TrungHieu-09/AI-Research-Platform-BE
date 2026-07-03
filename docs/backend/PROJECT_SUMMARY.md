# TỔNG HỢP TIẾN ĐỘ VÀ KIẾN TRÚC HỆ THỐNG LUMIS
**Dự án:** Nền tảng Quản lý Tài liệu Học thuật & Tổng hợp Kiến thức bằng AI (FPT University)  
**Tình trạng cập nhật:** Hoàn thiện Giai đoạn 1, 2, 3 (Core Backend & RBAC Architecture)

---

## 🏗️ 1. Cải tổ Kiến trúc Phân quyền (RBAC Refactor)
- **Loại bỏ hoàn toàn vai trò `MODERATOR`:** Đã tiến hành quét và xóa bỏ role `MODERATOR` khỏi toàn bộ hệ thống (tài liệu Business Analysis, bảng phân quyền API, và mã nguồn Backend).
- **Quyền hạn gộp vào `ADMIN`:** Quản trị viên (`ADMIN`) hiện nắm giữ toàn quyền quản lý hệ thống, bao gồm kiểm duyệt tài liệu (`/moderate`), đề xuất môn học (`/suggest`), và quản lý người dùng (`/users`).
- **Tối ưu Middleware (`BE/src/middleware.ts`):** Chuẩn hóa cấu trúc phân cấp `ROLE_HIERARCHY` (Chỉ còn `STUDENT` và `ADMIN`). Tự động bảo vệ các API riêng tư và inject headers `x-user-id`, `x-user-role` định danh người dùng cho các route phía sau.

---

## 🚀 2. Chi tiết Các Giai đoạn Đã Hoàn Thành

### 🟢 Giai đoạn 1: Xác thực & Quản lý Người dùng (Authentication & User Management)
| API Endpoint | Phương thức | Mô tả & Nghiệp vụ đã xử lý |
| :--- | :---: | :--- |
| `/api/auth/google` | `POST` | **Đăng nhập Google SSO:** Kiểm tra nghiêm ngặt email đuôi `@fpt.edu.vn`. Tự động khởi tạo tài khoản nếu chưa tồn tại, lưu ảnh đại diện (`avatarUrl`), và cấp token JWT bảo mật (7 ngày). |
| `/api/users` | `GET` | **Danh sách User (Admin):** Lấy danh sách phân trang, hỗ trợ lọc theo `role` (STUDENT/ADMIN) và `status` (ACTIVE/SUSPENDED). Kèm thống kê số tài liệu và số phiên chat của từng sinh viên. |
| `/api/users/[id]` | `PUT` | **Cập nhật quyền & trạng thái:** Cho phép Admin khóa/mở khóa tài khoản hoặc nâng quyền Admin. *Tính năng an toàn:* Tự động chặn Admin khóa hoặc hạ quyền của chính mình. |

---

### 🟡 Giai đoạn 2: Tải lên Tài liệu & Khử trùng lặp thông minh (Deduplication Storage)
| API Endpoint | Phương thức | Mô tả & Nghiệp vụ đã xử lý |
| :--- | :---: | :--- |
| `/api/documents/upload-url` | `POST` | **Khử trùng lặp (Deduplication):** Nhận `fileHash` (SHA-256). Nếu file đã tồn tại trên Cloud -> Trả về `deduplicated: true` kèm link file cũ, giúp FE **không cần upload lại file lớn (tiết kiệm storage)**. |
| `/api/documents` | `POST` | **Lưu metadata tài liệu:** Tạo bản ghi tài liệu mới. *Cải tiến UX:* Nếu chọn hiển thị `PRIVATE` -> Tự động duyệt (`APPROVED`) để dùng AI ngay. Nếu chọn `PUBLIC` -> Vào trạng thái chờ duyệt (`PENDING`). |
| `/api/documents/mock-upload` | `PUT/POST` | **Giả lập Upload (Local Dev):** Fallback tự động khi lập trình viên chưa cấu hình key AWS S3 hoặc Supabase Storage, giúp UI không bị lỗi 404/500 khi test luồng upload. |

---

### 🟠 Giai đoạn 3: Kiểm duyệt Tài liệu & Quản lý Môn học (Admin Workflow)
| API Endpoint | Phương thức | Mô tả & Nghiệp vụ đã xử lý |
| :--- | :---: | :--- |
| `/api/documents/[id]/moderate` | `POST` | **Duyệt/Từ chối tài liệu:** Admin duyệt (`APPROVED`) hoặc từ chối (`REJECTED`) kèm lý do. *Tối ưu Zod:* Hỗ trợ alias linh hoạt nhận cả key `status` hoặc `decision` từ Frontend. |
| `/api/subjects` | `GET / POST` | **Quản lý Môn học:** Lấy danh sách hoặc tạo mới môn học (Mã môn học `code` là duy nhất). Tự động ghi nhận `AuditLog` cho mọi thao tác của Admin. |
| `/api/subjects/[id]` | `PUT / DELETE` | **Sửa/Khóa Môn học:** Cập nhật thông tin môn học hoặc chuyển sang trạng thái `SUSPENDED` (Soft delete) thay vì xóa vĩnh viễn, đảm bảo toàn vẹn dữ liệu khóa học cũ. |

---

## 🗄️ 3. Tình trạng Cơ sở dữ liệu (Database Setup)
- **Supabase PostgreSQL:** Đã kết nối thành công qua connection string (`DATABASE_URL`).
- **Prisma Schema Sync:** Toàn bộ bảng dữ liệu (`users`, `documents`, `subjects`, `audit_logs`, v.v.) đã được đồng bộ lên DB qua lệnh `npx prisma db push`.
- **Cập nhật Schema:** Đã nâng cấp `schema.prisma` cho phép `passwordHash String?` (null) và thêm `avatarUrl String?` để phục vụ Google SSO.

---

## 🔮 4. Định hướng Giai đoạn 4 (AI RAG & Automation)
*Theo ghi nhận, luồng AI RAG (Retrieval-Augmented Generation) đang được lên kế hoạch xây dựng trên nền tảng low-code **n8n** thay vì xử lý trực tiếp bằng code Next.js API.*

**Lợi ích của hướng đi sử dụng n8n:**
1. **Tách biệt tải xử lý (Decoupling):** Node Next.js Backend tập trung xử lý API nghiệp vụ nhanh chóng, để việc cắt file (Chunking), gọi OpenAI Embedding và Vector Search cho webhook workflow của n8n xử lý ngầm.
2. **Dễ chỉnh sửa Prompt & Flow:** Có thể thay đổi luồng RAG, prompt AI hoặc đổi model (GPT-4o sang Claude 3.5 Sonnet) kéo thả trên n8n mà không cần redeploy code Backend.
3. **Kết nối DB dễ dàng:** n8n có sẵn node kết nối Postgres/Supabase để đọc ghi bảng `document_chunks` (vector 1536) một cách mượt mà.

---
*Tài liệu này được tạo tự động để bàn giao cho đội ngũ Phát triển Frontend & Backend kiểm chứng và tích hợp.*
