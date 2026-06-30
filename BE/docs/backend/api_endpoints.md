# REST API Endpoints Specification
## Project: Lumis (Academic Document Management & AI Synthesis Platform)

This document provides a comprehensive list of all backend API endpoints required to support the Frontend (FE) UI, following the merged Admin role (the Moderator role has been removed).

---

## 1. Authentication & Users
APIs for user registration, login, session management, and admin user administration.

### `POST /api/auth/register`
- **Description:** Register a new student account.
- **Access:** Public
- **Body:** `{ name, email, password }`
- **Response:** Success message (OTP sent).

### `POST /api/auth/verify-otp`
- **Description:** Verify OTP sent to email and activate account.
- **Access:** Public
- **Body:** `{ email, otpCode }`
- **Response:** User object and JWT access token.

### `POST /api/auth/login`
- **Description:** Traditional email/password login.
- **Access:** Public
- **Body:** `{ email, password }`
- **Response:** User object and JWT access token.

### `POST /api/auth/google`
- **Description:** Login or Register via Google SSO OAuth 2.0 (`@fpt.edu.vn` only).
- **Access:** Public
- **Body:** `{ token }`
- **Response:** User object and JWT access token.

### `GET /api/users`
- **Description:** Fetch list of users.
- **Access:** Admin
- **Query Params:** `?page=1&limit=20&role=STUDENT&status=ACTIVE`
- **Response:** Paginated list of users.

### `PUT /api/users/[id]`
- **Description:** Update user status or role.
- **Access:** Admin
- **Body:** `{ role, status }`
- **Response:** Updated user metadata.

---

## 2. Documents
APIs for managing the lifecycle of documents from upload, moderation, retrieval, to deletion.

### `POST /api/documents/upload-url`
- **Description:** Request a presigned URL to upload a file directly to Cloud Storage, or perform instant deduplication if `fileHash` exists.
- **Access:** Student, Admin
- **Body:** `{ fileHash, fileSize, mimeType }`
- **Response:** Presigned URL & Document ID (if new) OR 200 OK (if deduplicated).

### `POST /api/documents`
- **Description:** Create document metadata after successful file upload.
- **Access:** Student, Admin
- **Body:** `{ title, description, subjectId, visibility, fileUrl, fileHash, fileSize, mimeType, pageCount }`
- **Response:** Created document record (Status: `PENDING` if public).

### `GET /api/documents`
- **Description:** Fetch documents based on visibility, status, or owner.
- **Access:** Guest (Public/Approved only), Student, Admin
- **Query Params:** `?subjectId=...&status=APPROVED&search=...&page=1`
- **Response:** Paginated documents.

### `GET /api/documents/[id]`
- **Description:** Fetch details of a specific document (including its subject, owner, status).
- **Access:** Student, Admin (or Guest if PUBLIC & APPROVED).
- **Response:** Document details.

### `POST /api/documents/[id]/moderate`
- **Description:** Approve or reject a pending public document.
- **Access:** Admin
- **Body:** `{ action: "APPROVED" | "REJECTED", rejectionReason? }`
- **Response:** Success confirmation.

### `DELETE /api/documents/[id]`
- **Description:** Soft-delete a document.
- **Access:** Owner, Admin
- **Response:** Success confirmation.

### `POST /api/documents/[id]/restore`
- **Description:** Restore a soft-deleted document (within 30 days).
- **Access:** Owner, Admin
- **Response:** Restored document metadata.

### `DELETE /api/admin/documents/[id]/hard`
- **Description:** Permanently delete a document.
- **Access:** Admin
- **Response:** Success confirmation.

### `GET /api/documents/[id]/audit`
- **Description:** Fetch audit logs related to this document (views, downloads, edits).
- **Access:** Admin
- **Response:** List of audit records.

---

## 3. Subjects (Tags)
APIs to manage the static list of subjects categorizing the documents.

### `GET /api/subjects`
- **Description:** Fetch list of active subjects.
- **Access:** Public
- **Response:** List of subjects.

### `POST /api/subjects`
- **Description:** Create a new subject category.
- **Access:** Admin
- **Body:** `{ name, code }`
- **Response:** Created subject record.

### `PUT /api/subjects/[id]`
- **Description:** Update subject metadata (e.g., name, code, status).
- **Access:** Admin
- **Body:** `{ name, code, status }`
- **Response:** Updated subject record.

### `DELETE /api/subjects/[id]`
- **Description:** Disable/remove a subject.
- **Access:** Admin
- **Response:** Success confirmation.

### `POST /api/subjects/suggest`
- **Description:** Student proposes a new subject/tag.
- **Access:** Student
- **Body:** `{ name }`
- **Response:** Success confirmation (status: PENDING).

### `GET /api/subjects/suggest`
- **Description:** View pending subject suggestions.
- **Access:** Admin
- **Response:** List of suggestions.

### `POST /api/subjects/suggest/[id]/moderate`
- **Description:** Approve or reject a subject suggestion.
- **Access:** Admin
- **Body:** `{ action: "APPROVED" | "REJECTED" }`
- **Response:** Success confirmation.

---

## 4. AI Chatbot & RAG
APIs for interacting with the generative AI using semantic vector search on documents.

### `POST /api/ai/chat`
- **Description:** Start or continue a chat session with the AI. Includes streaming context from documents.
- **Access:** Student, Admin
- **Body:** `{ message, sessionId, documentId?, scope }`
- **Response:** JSON response stream (SSE or similar) containing `{ answer, citations }`.

### `GET /api/ai/limit`
- **Description:** Check the user's remaining daily query tokens.
- **Access:** Student, Admin
- **Response:** `{ queriesToday, limit, tier }`.

### `GET /api/ai/sessions`
- **Description:** Fetch user's previous chat sessions history.
- **Access:** Student, Admin (Owner only)
- **Response:** List of sessions.

### `GET /api/ai/sessions/[sessionId]/messages`
- **Description:** Fetch message history for a specific chat session.
- **Access:** Student, Admin (Owner only)
- **Response:** List of chat messages with citations.

---

## 5. Payments & Subscriptions
APIs for handling premium tier upgrades.

### `POST /api/payments/checkout`
- **Description:** Initiate an order transaction receipt for upgrading to Premium tier.
- **Access:** Student
- **Body:** `{ planId, referenceCode }`
- **Response:** Transaction receipt details and VietQR/Bank template info.

### `POST /api/payments/webhook`
- **Description:** Callback verification webhook from Bank API (or automated checking service) to confirm payment.
- **Access:** Service / System
- **Body:** `{ transferContent, amount, status }`
- **Response:** `200 OK` (updates User Tier internally).

### `GET /api/payments/receipts`
- **Description:** Fetch user payment receipts.
- **Access:** Student, Admin
- **Response:** List of receipts.
