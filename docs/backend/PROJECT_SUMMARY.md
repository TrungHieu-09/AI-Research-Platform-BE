# TỔNG HỢP TIẾN ĐỘ VÀ KIẾN TRÚC HỆ THỐNG LUMIS
**Dự án:** Nền tảng Quản lý Tài liệu Học thuật & Tổng hợp Kiến thức bằng AI (FPT University)  
**Cập nhật lần cuối:** 2026-07-03 — Schema v2.0, 21 bảng

---

## 🏗️ 1. Kiến trúc Phân quyền (RBAC)
- **Chỉ có 2 Role:** `STUDENT` và `ADMIN` (đã loại bỏ hoàn toàn `MODERATOR`).
- **Middleware tự động** bảo vệ các API và inject `x-user-id`, `x-user-role`, `x-user-tier` vào headers cho mọi route phía sau.
- **Port Backend:** `4000` (Next.js API Routes)

---

## 🗄️ 2. Tình trạng Database (Supabase PostgreSQL)

| Hạng mục | Trạng thái |
|:---|:---:|
| Kết nối Supabase | ✅ |
| pgvector extension | ✅ |
| Toàn bộ bảng sync | ✅ 21 bảng |
| HNSW Index (embedding) | ✅ |
| System Configs seeded | ✅ 7 cấu hình |
| Prisma Client generated | ✅ v5.22.0 |

### Danh sách 21 bảng trong DB

| # | Tên bảng | Nhóm |
|:---:|:---|:---|
| 1 | `users` | Auth |
| 2 | `one_time_passwords` | Auth |
| 3 | `subjects` | Môn học |
| 4 | `subject_suggestions` | Môn học |
| 5 | `tags` | Môn học |
| 6 | `documents` | Tài liệu |
| 7 | `document_chunks` | Tài liệu / RAG |
| 8 | `document_views` | Tài liệu / Analytics |
| 9 | `document_ratings` | Tài liệu / Community |
| 10 | `document_shares` | Tài liệu / Social |
| 11 | `bookmarks` | Tổ chức cá nhân |
| 12 | `collections` | Tổ chức cá nhân |
| 13 | `collection_documents` | Tổ chức cá nhân |
| 14 | `chat_sessions` | AI Chat |
| 15 | `chat_messages` | AI Chat |
| 16 | `citations` | AI Chat |
| 17 | `ai_usage_logs` | AI / Rate Limit |
| 18 | `ai_cache` | AI / Cost Saving |
| 19 | `notifications` | Hệ thống |
| 20 | `audit_logs` | Hệ thống |
| 21 | `payment_receipts` | Thanh toán |
| 22 | `system_configs` | Admin Config |

---

## 🚀 3. Chi tiết Các Giai đoạn Đã Hoàn Thành

### 🟢 Giai đoạn 1: Xác thực & Quản lý Người dùng
| API | Method | Nghiệp vụ |
|:---|:---:|:---|
| `/api/auth/google` | `POST` | Google SSO: Kiểm tra `@fpt.edu.vn`, auto tạo tài khoản, cấp JWT 7 ngày |
| `/api/users` | `GET` | Danh sách user + filter + thống kê documents/chats |
| `/api/users/[id]` | `PUT` | Khóa/mở/nâng quyền (chặn Admin tự hại mình) |

### 🟡 Giai đoạn 2: Upload Tài liệu & Deduplication
| API | Method | Nghiệp vụ |
|:---|:---:|:---|
| `/api/documents/upload-url` | `POST` | Hash-based dedup: Nếu file đã có → không upload lại, tiết kiệm storage |
| `/api/documents` | `POST` | Auto-approve PRIVATE, PENDING cho PUBLIC |
| `/api/documents/mock-upload` | `PUT` | Local dev fallback (không cần AWS key) |

### 🟠 Giai đoạn 3: Kiểm duyệt & Quản lý Môn học
| API | Method | Nghiệp vụ |
|:---|:---:|:---|
| `/api/documents/[id]/moderate` | `POST` | APPROVED/REJECTED + ghi audit_logs |
| `/api/subjects` | `GET/POST` | Danh sách + tạo mới (audit logged) |
| `/api/subjects/[id]` | `PUT/DELETE` | Sửa/Suspend môn học (audit logged) |

---

## 🔮 4. Giai đoạn 4: AI RAG Pipeline (n8n)

Luồng RAG được xây dựng trên **n8n** (Docker container port `5678`) thay vì xử lý trực tiếp trong code Next.js:

```
[Admin Duyệt Tài liệu]
      ↓
Backend gọi Webhook n8n (POST /webhook/ingest-doc)
      ↓
n8n: Tải PDF → Cắt chunk (1000 chars/150 overlap)
      ↓
n8n: OpenAI Embedding (text-embedding-3-small)
      ↓
n8n: Lưu vào Supabase (bảng document_chunks, cột embedding vector(1536))

[Sinh viên Chat]
      ↓
Backend kiểm tra ai_usage_logs (rate limit từ system_configs)
      ↓
Backend kiểm tra ai_cache (cache hit → trả về ngay)
      ↓ (cache miss)
Backend gọi Webhook n8n (POST /webhook/rag-chat)
      ↓
n8n: Vector Search Supabase → Top-k chunks → GPT-4o → Answer + Citations
      ↓
Backend lưu chat_messages, citations, ai_usage_logs, ai_cache
      ↓
Frontend hiển thị câu trả lời + trích dẫn có thể click vào PDF
```

---

## ⚙️ 5. System Configs (Admin có thể sửa mà không cần redeploy)

| Key | Giá trị hiện tại | Ý nghĩa |
|:---|:---:|:---|
| `max_file_size_mb` | `50` | Dung lượng file tối đa |
| `free_ai_limit_per_day` | `10` | Lượt AI/ngày cho Free |
| `premium_ai_limit_per_day` | `50` | Lượt AI/ngày cho Premium |
| `ai_cache_ttl_days` | `7` | Số ngày cache câu trả lời |
| `soft_delete_retention_days` | `30` | Số ngày giữ file đã xóa |
| `max_uploads_per_day` | `20` | File upload tối đa/ngày |
| `allowed_mime_types` | `pdf, docx, txt, png, jpg` | Định dạng được phép |

---

## 🛠️ 6. Lệnh Chạy Backend

```bash
# Cài dependencies
npm install

# Setup DB lần đầu (mới clone về)
node src/scripts/setup-vector.js   # Bật pgvector + tạo cột embedding
npx prisma db push                 # Sync tất cả bảng lên Supabase
node prisma/seed.js                # Seed system_configs mặc định
npx prisma generate                # Generate Prisma Client

# Chạy dev server (port 4000)
npm run dev

# Chạy n8n (Docker Desktop phải đang bật)
docker compose up -d               # n8n tại http://localhost:5678
```

---
*Tài liệu này được cập nhật tự động theo tiến độ phát triển dự án.*
