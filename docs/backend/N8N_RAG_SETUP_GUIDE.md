# HƯỚNG DẪN CHI TIẾT XÂY DỰNG AI RAG VỚI N8N & SUPABASE

Tài liệu này hướng dẫn từng bước (Step-by-step) cách cài đặt n8n bằng Docker Desktop và thiết lập 2 luồng workflow quan trọng cho hệ thống RAG:
1. **Ingestion Workflow:** Đọc file tài liệu mới tải lên -> Cắt nhỏ (Chunking) -> Tạo Embedding -> Lưu vào Supabase Vector Store.
2. **Chat & Retrieval Workflow:** Nhận câu hỏi từ người dùng -> Tìm kiếm Vector trong Supabase -> Đưa vào LLM (OpenAI/Claude) trả lời.

---

## 🚀 PHẦN 1: CÀI ĐẶT N8N TRONG PROJECT VỚI DOCKER DESKTOP

### Bước 1: Khởi động Docker Desktop
Đảm bảo phần mềm **Docker Desktop** trên Windows của bạn đang bật và chạy ổn định (icon cá voi dưới taskbar không bị màu đỏ/vàng).

### Bước 2: Chạy lệnh Docker Compose
Tại thư mục gốc của dự án (`D:\SDN302-AI-Research-Platform-FE`), mình đã tạo sẵn file `docker-compose.yml`. Bạn mở Terminal và chạy lệnh sau:

```powershell
docker compose up -d
```

### Bước 3: Truy cập giao diện n8n
- Sau khi container chạy thành công, mở trình duyệt và truy cập: **http://localhost:5678**
- Ở lần đầu tiên, n8n sẽ yêu cầu bạn tạo tài khoản quản trị nội bộ (nhập Email & Password bất kỳ của bạn).

---

## 🗄️ PHẦN 2: CHUẨN BỊ BẢNG VECTOR TRONG SUPABASE

Để n8n có thể lưu trữ vector embedding, bạn cần mở **SQL Editor** trên Supabase Dashboard và chạy đoạn script sau để tạo extension và bảng `document_chunks`:

```sql
-- 1. Bật extension pgvector (nếu chưa bật)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Thêm cột embedding và metadata vào bảng document_chunks (do Prisma đã tạo trước đó)
ALTER TABLE document_chunks 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3. Tạo chỉ mục (Index) HNSW để tìm kiếm vector cực nhanh
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx 
ON document_chunks USING hnsw (embedding vector_cosine_ops);
```

> **💡 Mẹo nhỏ:** Hoặc bạn có thể chạy thẳng lệnh tiện ích sau trong terminal tại thư mục `BE`:  
> `npm run db:setup-vector` (Hệ thống tự động chạy toàn bộ SQL trên giúp bạn!).

---

## ⚙️ PHẦN 3: SETUP TRONG N8N — WORKFLOW 1 (NẠP TÀI LIỆU - INGESTION)

Luồng này sẽ được gọi tự động (hoặc qua Webhook) khi Admin duyệt tài liệu thành công (`APPROVED`).

### 1. Tạo Webhook Trigger
- Trong n8n, nhấn **Add first step** -> Chọn **Webhook**.
- Set HTTP Method: `POST`, Path: `ingest-doc`.
- Copy URL Webhook (ví dụ: `http://localhost:5678/webhook/ingest-doc`). Backend Next.js sẽ gọi URL này kèm body `{ "documentId": "...", "fileUrl": "https://..." }`.

### 2. Tải nội dung tài liệu (HTTP Request Node)
- Nối tiếp Webhook, thêm node **HTTP Request**.
- URL: Đặt thành `{{ $json.body.fileUrl }}` để tải file PDF/DOCX về dưới dạng binary data.

### 3. Đọc và Cắt nhỏ tài liệu (Default Data Loader & Text Splitter)
- Thêm node **Default Data Loader** để đọc text từ binary.
- Kết nối với node **Recursive Character Text Splitter**: Set `Chunk Size` = `1000`, `Chunk Overlap` = `150`.

### 4. Tạo Embedding & Lưu vào Supabase Vector Store
- Thêm node **Supabase Vector Store** (Cài đặt trong mục AI / Vector Stores).
- Operation: **Insert Documents**.
- **Credentials:** Nhập Host Supabase, Database User, Password và Port `5432` (lấy trong cấu hình DB).
- **Table Name:** Điền `document_chunks`.
- Ở đầu vào `Embedding`, gắn node **OpenAI Embeddings** (Điền API Key OpenAI, model `text-embedding-3-small`).

---

## 🤖 PHẦN 4: SETUP TRONG N8N — WORKFLOW 2 (CHAT RAG - RETRIEVAL)

Luồng này phục vụ API Chat của sinh viên (`POST /api/ai/chat`).

### 1. Tạo Webhook Chat
- Thêm node **Webhook** mới -> HTTP Method: `POST`, Path: `rag-chat`.
- Nhận vào body: `{ "query": "Giải thích khái niệm...", "userId": "..." }`.

### 2. Node AI Agent
- Thêm node **AI Agent** (hoặc Conversational Agent).
- **Language Model:** Gắn node **OpenAI Chat Model** (Chọn `gpt-4o` hoặc `gpt-4o-mini`).
- **Memory:** Gắn node **Window Buffer Memory** để AI nhớ ngữ cảnh 5-10 câu chat gần nhất.

### 3. Kết nối RAG Tool (Vector Store Tool)
- Ở cổng **Tools** của AI Agent, gắn node **Vector Store Tool**.
- Tool Name: `search_fpt_documents`.
- Description: `Dùng công cụ này để tìm kiếm kiến thức học thuật, tài liệu môn học của Đại học FPT trả lời cho sinh viên`.
- Kết nối Vector Store Tool này với node **Supabase Vector Store** (Operation: **Get Many / Retrieve**, chỉ trỏ vào bảng `document_chunks` và node OpenAI Embeddings).

---

## 🔗 PHẦN 5: KẾT NỐI VỚI NEXT.JS BACKEND (`BE/`)

Sau khi setup xong 2 workflow trên n8n và ấn **Active**, bạn chỉ cần thêm 2 dòng biến môi trường vào file `BE/.env`:

```env
# N8N Webhook URLs
N8N_INGEST_WEBHOOK_URL="http://localhost:5678/webhook/ingest-doc"
N8N_CHAT_WEBHOOK_URL="http://localhost:5678/webhook/rag-chat"
```

Khi sinh viên nhắn tin ở Frontend, Backend Next.js (`/api/ai/chat`) chỉ cần `fetch(process.env.N8N_CHAT_WEBHOOK_URL)` và trả kết quả của n8n về cho giao diện là xong luồng RAG hoàn chỉnh!
