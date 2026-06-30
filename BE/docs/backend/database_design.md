# Database Schema & Entity Relationship Design
## Project: Lumis (Academic Document Management & AI Synthesis Platform)

This document defines the database architecture for the Lumis application. The design uses a relational model suited for **PostgreSQL** (due to **pgvector** support for embedding RAG chunks). It specifies entities, relationships, validation constraints, and includes a production-grade **Prisma Schema**.

---

## 1. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    User ||--o{ Document : "owns"
    User ||--o{ SubjectSuggestion : "proposes"
    User ||--o{ ChatSession : "conducts"
    User ||--o{ PaymentReceipt : "makes"
    User ||--o{ AuditLog : "triggers"
    
    Subject ||--o{ Document : "groups"
    Subject ||--o{ ChatSession : "contextualizes"

    Document ||--o{ DocumentChunk : "contains"
    Document ||--o{ ChatSession : "supports"
    Document ||--o{ Citation : "referenced_in"
    Document ||--o{ AuditLog : "audited"

    ChatSession ||--o{ ChatMessage : "has"
    ChatMessage ||--o{ Citation : "cites"

    class User {
        uuid id PK
        string name
        string email UK
        string passwordHash
        string role "STUDENT | ADMIN"
        string status "ACTIVE | SUSPENDED"
        string tier "FREE | PREMIUM"
        datetime createdAt
        datetime updatedAt
    }

    class OneTimePassword {
        uuid id PK
        string email
        string otpCode
        datetime expiresAt
        int attempts
        datetime createdAt
    }

    class Subject {
        uuid id PK
        string name
        string code UK "e.g., CS301"
        string status "ACTIVE | INACTIVE"
        datetime createdAt
        datetime updatedAt
    }

    class SubjectSuggestion {
        uuid id PK
        string name
        string status "PENDING | APPROVED | REJECTED"
        uuid proposedById FK
        datetime createdAt
        datetime updatedAt
    }

    class Document {
        uuid id PK
        string title
        string description
        string fileUrl
        string fileHash
        int fileSize
        string mimeType
        string visibility "PRIVATE | PUBLIC"
        string status "PENDING | APPROVED | REJECTED"
        string rejectionReason
        int pageCount
        uuid ownerId FK
        uuid subjectId FK
        uuid moderatedById FK
        datetime moderatedAt
        datetime createdAt
        datetime updatedAt
        datetime deletedAt "Soft Delete"
    }

    class DocumentChunk {
        uuid id PK
        uuid documentId FK
        int chunkIndex
        int pageNumber
        string content
        vector embedding "pgvector size"
        datetime createdAt
    }

    class ChatSession {
        uuid id PK
        string title
        uuid userId FK
        uuid documentId FK "Optional"
        uuid subjectId FK "Optional"
        string scope "SINGLE | SUBJECT | GLOBAL"
        datetime createdAt
        datetime updatedAt
    }

    class ChatMessage {
        uuid id PK
        uuid sessionId FK
        string sender "USER | AI"
        string message
        datetime createdAt
    }

    class Citation {
        uuid id PK
        uuid messageId FK
        uuid documentId FK
        int pageNumber
        int paragraphIndex
        string textExcerpt
        datetime createdAt
    }

    class PaymentReceipt {
        uuid id PK
        uuid userId FK
        string planId
        decimal amount
        string transferContent UK
        string status "PENDING | COMPLETED | FAILED"
        datetime createdAt
        datetime verifiedAt
    }

    class AuditLog {
        uuid id PK
        uuid userId FK
        string action
        string targetEntity
        string targetId
        string ipAddress
        datetime createdAt
    }
```

---

## 2. Table Schemas & Validation Constraints

### User Table (`users`)
Tracks registered users and active billing packages.
* **Fields**:
  * `id`: `UUID` (Primary Key, unique generation)
  * `email`: `VARCHAR(255)` (Unique index, must validate format pattern `@fpt.edu.vn` at application level)
  * `role`: `ENUM('STUDENT', 'ADMIN')` (Default: `'STUDENT'`)
  * `status`: `ENUM('ACTIVE', 'SUSPENDED')` (Default: `'ACTIVE'`)
  * `tier`: `ENUM('FREE', 'PREMIUM')` (Default: `'FREE'`)
* **Indexes**: Unique index on `email` to prevent duplication audits.

### OneTimePassword Table (`one_time_passwords`)
Used to manage multi-factor email verification screens to block registration spam.
* **Fields**:
  * `email`: `VARCHAR(255)` (Non-unique, multiple attempts logged)
  * `otpCode`: `VARCHAR(6)`
  * `expiresAt`: `TIMESTAMP` (Should expire after 10 minutes)
  * `attempts`: `INT` (Max limit of 3 tries for safety validation)

### Document Table (`documents`)
Stores document metadata, ownership, soft-delete details, and file hashes to support the automatic deduplication engine.
* **Fields**:
  * `fileHash`: `VARCHAR(64)` (SHA-256 value of file contents for comparison)
  * `deletedAt`: `TIMESTAMP NULL` (Null represents active document, timestamp populated represents soft-deleted state)
  * `status`: `ENUM('PENDING', 'APPROVED', 'REJECTED')` (Default: `'PENDING'` for Public uploads)
  * `visibility`: `ENUM('PRIVATE', 'PUBLIC')` (Private files bypass moderation approval workflow)
* **Indexes**: Composite Index `(id, status, deletedAt)` for faster filtering of approved files.

### Document Chunks Table (`document_chunks`)
Stores text slices with their associated AI dense vector embeddings to fuel semantic searches.
* **Fields**:
  * `embedding`: `VECTOR(1536)` (Optimized for OpenAI embedding models, pgvector enabled)
* **Indexes**: HNSW Index on `embedding` for cosine distance queries.

---

## 3. Prisma Schema Template

Developers can drop this schema config directly into `prisma/schema.prisma` inside the Next.js service repository:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  STUDENT
  ADMIN
}

enum AccountStatus {
  ACTIVE
  SUSPENDED
}

enum AccountTier {
  FREE
  PREMIUM
}

enum DocumentVisibility {
  PRIVATE
  PUBLIC
}

enum ModerationStatus {
  PENDING
  APPROVED
  REJECTED
}

enum ChatScope {
  SINGLE_DOCUMENT
  SUBJECT
  GLOBAL
}

enum SenderType {
  USER
  AI
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
}

model User {
  id                 String              @id @default(uuid()) @db.Uuid
  name               String
  email              String              @unique
  passwordHash       String
  role               Role                @default(STUDENT)
  status             AccountStatus       @default(ACTIVE)
  tier               AccountTier         @default(FREE)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
  documents          Document[]          @relation("UserDocuments")
  moderatedDocs      Document[]          @relation("ModeratedDocuments")
  subjectSuggestions SubjectSuggestion[]
  chatSessions       ChatSession[]
  paymentReceipts    PaymentReceipt[]
  auditLogs          AuditLog[]

  @@map("users")
}

model OneTimePassword {
  id        String   @id @default(uuid()) @db.Uuid
  email     String
  otpCode   String
  expiresAt DateTime
  attempts  Int      @default(0)
  createdAt DateTime @default(now())

  @@map("one_time_passwords")
}

model Subject {
  id           String        @id @default(uuid()) @db.Uuid
  name         String
  code         String        @unique
  status       AccountStatus @default(ACTIVE)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  documents    Document[]
  chatSessions ChatSession[]

  @@map("subjects")
}

model SubjectSuggestion {
  id           String           @id @default(uuid()) @db.Uuid
  name         String
  status       ModerationStatus @default(PENDING)
  proposedById String           @db.Uuid
  proposedBy   User             @relation(fields: [proposedById], references: [id])
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  @@map("subject_suggestions")
}

model Document {
  id               String             @id @default(uuid()) @db.Uuid
  title            String
  description      String?            @db.Text
  fileUrl          String
  fileHash         String
  fileSize         Int
  mimeType         String
  visibility       DocumentVisibility @default(PRIVATE)
  status           ModerationStatus   @default(PENDING)
  rejectionReason  String?            @db.Text
  pageCount        Int
  ownerId          String             @db.Uuid
  owner            User               @relation("UserDocuments", fields: [ownerId], references: [id])
  subjectId        String             @db.Uuid
  subject          Subject            @relation(fields: [subjectId], references: [id])
  moderatedById    String?            @db.Uuid
  moderatedBy      User?              @relation("ModeratedDocuments", fields: [moderatedById], references: [id])
  moderatedAt      DateTime?
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt
  deletedAt        DateTime?          // Soft delete column
  chunks           DocumentChunk[]
  chatSessions     ChatSession[]
  citations        Citation[]

  @@index([status, deletedAt])
  @@map("documents")
}

model DocumentChunk {
  id          String   @id @default(uuid()) @db.Uuid
  documentId  String   @db.Uuid
  document    Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  chunkIndex  Int
  pageNumber  Int
  content     String   @db.Text
  createdAt   DateTime @default(now())

  @@map("document_chunks")
}

model ChatSession {
  id         String        @id @default(uuid()) @db.Uuid
  title      String?
  userId     String        @db.Uuid
  user       User          @relation(fields: [userId], references: [id])
  documentId String?       @db.Uuid
  document   Document?     @relation(fields: [documentId], references: [id])
  subjectId  String?       @db.Uuid
  subject    Subject?      @relation(fields: [subjectId], references: [id])
  scope      ChatScope     @default(SINGLE_DOCUMENT)
  createdAt  DateTime      @default(now())
  updatedAt  DateTime      @updatedAt
  messages   ChatMessage[]

  @@map("chat_sessions")
}

model ChatMessage {
  id        String     @id @default(uuid()) @db.Uuid
  sessionId String     @db.Uuid
  session   ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  sender    SenderType
  message   String     @db.Text
  createdAt DateTime   @default(now())
  citations Citation[]

  @@map("chat_messages")
}

model Citation {
  id              String      @id @default(uuid()) @db.Uuid
  messageId       String      @db.Uuid
  message         ChatMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)
  documentId      String      @db.Uuid
  document        Document    @relation(fields: [documentId], references: [id])
  pageNumber      Int
  paragraphIndex  Int?
  textExcerpt     String      @db.Text
  createdAt       DateTime    @default(now())

  @@map("citations")
}

model PaymentReceipt {
  id              String        @id @default(uuid()) @db.Uuid
  userId          String        @db.Uuid
  user            User          @relation(fields: [userId], references: [id])
  planId          String
  amount          Decimal       @db.Decimal(10, 2)
  transferContent String        @unique
  status          PaymentStatus @default(PENDING)
  createdAt       DateTime      @default(now())
  verifiedAt      DateTime?

  @@map("payment_receipts")
}

model AuditLog {
  id           String    @id @default(uuid()) @db.Uuid
  userId       String?   @db.Uuid
  user         User?     @relation(fields: [userId], references: [id])
  action       String
  targetEntity String
  targetId     String?
  ipAddress    String?
  createdAt    DateTime  @default(now())

  @@map("audit_logs")
}
```
