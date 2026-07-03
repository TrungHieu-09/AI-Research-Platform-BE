# Backend Service Sequence Diagrams
## Project: Lumis (Academic Document Management & AI Synthesis Platform)

This document contains UML sequence diagrams detailing transaction patterns, client interactions, service layers, and database states.

---

## 1. User Registration & Email OTP Verification

This flow describes authentication verification when a Guest creates a student account.

```mermaid
sequenceDiagram
    autonumber
    actor Guest as Guest User
    participant App as Next.js Client
    participant AuthAPI as Auth API Route Handlers
    participant DB as Postgres Database
    participant Email as SMTP Email Service

    Guest->>App: Input Name, Email, & Password
    activate App
    App->>AuthAPI: POST /api/auth/register (payload)
    activate AuthAPI
    Note over AuthAPI: Validate email matches @fpt.edu.vn via Zod
    AuthAPI->>AuthAPI: Generate Cryptographic 6-digit OTP
    AuthAPI->>DB: Write OTP (email, otpCode, expiresAt, attempts: 0)
    activate DB
    DB-->>AuthAPI: OK
    deactivate DB
    AuthAPI->>Email: Send Verification Email with OTP code
    activate Email
    Email-->>AuthAPI: Email Sent Confirmation
    deactivate Email
    AuthAPI-->>App: Return token (Pending Activation Status)
    deactivate AuthAPI
    App-->>Guest: Render OTP verification screen
    deactivate App

    Guest->>App: Submits 6-digit OTP
    activate App
    App->>AuthAPI: POST /api/auth/verify-otp {email, otpCode}
    activate AuthAPI
    AuthAPI->>DB: Fetch latest active OTP record by Email
    activate DB
    DB-->>AuthAPI: OTP Record
    deactivate DB
    
    rect rgb(240, 248, 255)
        Note over AuthAPI: Check attempts < 3 & expiresAt > now
        alt OTP Matches
            AuthAPI->>DB: Create User (Role: STUDENT, Status: ACTIVE, Tier: FREE)
            activate DB
            DB-->>AuthAPI: New User Record
            deactivate DB
            AuthAPI->>DB: Delete OTP Verification Record
            AuthAPI-->>App: Return Authenticated Session JWT (Role: STUDENT)
            App-->>Guest: Redirect to Dashboard Portal
        else OTP Fails
            AuthAPI->>DB: Increment OTP attempts count by 1
            AuthAPI-->>App: Return 400 Bad Request (Invalid OTP)
            App-->>Guest: Show verification error message & resend option
        end
    end
    deactivate AuthAPI
    deactivate App
```

---

## 2. Document Upload, Deduplication, & Moderation Lifecycle

Manages metadata calculation, client-side direct S3/Cloud Storage upload, content deduplication matching, and approval queue processing.

```mermaid
sequenceDiagram
    autonumber
    actor Student
    actor Mod as Admin
    participant App as Next.js Client
    participant DocAPI as Documents API Handler
    participant Storage as Cloud Bucket (S3/GCS)
    participant DB as Postgres Database
    
    Student->>App: Drags academic PDF to dropzone
    activate App
    Note over App: Calculate SHA-256 hash of file locally
    App->>DocAPI: POST /api/documents/upload-url {fileHash, fileSize, mimeType}
    activate DocAPI
    DocAPI->>DB: Check if fileHash already exists in database
    activate DB
    DB-->>DocAPI: Match Status (Found/Not Found)
    deactivate DB

    rect rgb(255, 245, 245)
        alt Duplicate Hash Found (Deduplication)
            DocAPI->>DB: Map User to existing Document (Shared Link mapping)
            activate DB
            DB-->>DocAPI: Mapping Saved
            deactivate DB
            DocAPI-->>App: Return 200 OK (Instant Upload Successful)
            App-->>Student: Render "Upload complete (Deduplicated)" notification
        else Unique File Hash (New File)
            DocAPI->>Storage: Generate Pre-signed PUT Upload URL
            activate Storage
            Storage-->>DocAPI: Upload URL
            deactivate Storage
            DocAPI-->>App: Return Upload URL & newly created Document ID (PENDING status)
            deactivate DocAPI
            App->>Storage: Directly upload binary PDF stream via Presigned URL
            Storage-->>App: 200 File Saved
            App-->>Student: Update UI to "Awaiting Admin Approval" status
        end
    end
    deactivate App

    %% Moderation Flow
    Note over Mod: Reviews pending submissions queue
    Mod->>App: Reviews PDF preview, selects Approve
    activate App
    App->>DocAPI: POST /api/documents/{id}/moderate {action: 'APPROVED'}
    activate DocAPI
    DocAPI->>DB: Update Document (status: 'APPROVED', moderatedBy: userId)
    activate DB
    DB-->>DocAPI: Updated DB Record
    deactivate DB
    
    Background job->>DocAPI: Trigger Document Parsing Workers
    activate Background job
    DocAPI->>Storage: Fetch PDF file
    DocAPI->>DocAPI: Vectorize PDF into chunks (page, content)
    DocAPI->>DocAPI: Generate AI vector embeddings for chunks
    DocAPI->>DB: Insert DocumentChunks (embeddings mapping)
    deactivate Background job

    DocAPI-->>App: Return Action Success
    deactivate DocAPI
    App-->>Mod: Refresh Moderation UI Queue
    deactivate App
```

---

## 3. RAG Semantic Search & Citation-Referenced AI Chat

Demonstrates how user chats are processed, contextualized with document vector embeddings, and streamed back with citations.

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant App as Next.js Client
    participant AI as AI API Route Handler
    participant VectorDB as pgvector Database
    participant OpenAI as LLM Model Service (GPT/Claude)

    Student->>App: Types question: "Explain Process Scheduling?"
    activate App
    App->>AI: POST /api/ai/chat {message, sessionId, documentId, scope: 'SINGLE_DOCUMENT'}
    activate AI
    
    Note over AI: Check user daily query limits

    AI->>AI: Convert message string into 1536 OpenAI Embedding vector
    
    AI->>VectorDB: Query cosine distance similarity match on chunks
    activate VectorDB
    VectorDB-->>AI: Top 3 parsed database text segments with Page & Document tags
    deactivate VectorDB

    AI->>AI: Inject matching segments into LLM Context prompt
    
    AI->>OpenAI: Request Chat Completion (Prompt + Context chunks docs)
    activate OpenAI
    OpenAI-->>AI: Stream response chunks (Text tokens)
    deactivate OpenAI

    AI-->>App: Stream JSON message packages containing {answer, citations: [page, text excerpt]}
    deactivate AI
    App-->>Student: Dynamic typewriter response. Click citations to scroll PDF view.
    deactivate App
```

---

## 4. Payment Receipt & Subscription Upgrades

Models secure transactions through manual bank transfer QR patterns and administrative automated confirmations.

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant App as Next.js Client
    participant PayAPI as Payments API Handler
    participant DB as Postgres Database
    participant BankAPI as Bank Web Ref Webhook (Momo/VietQR)

    Student->>App: Clicks "Upgrade to AI Pro" ($10/mo)
    activate App
    Note over App: Generate unique reference string: "PAY LUMIS AI"
    App->>PayAPI: POST /api/payments/checkout {planId: 'ai', referenceCode: 'PAY LUMIS AI'}
    activate PayAPI
    PayAPI->>DB: Save Payment Receipt (status: PENDING, transferContent: 'PAY LUMIS AI', amount: 10.00)
    activate DB
    DB-->>PayAPI: Saved Transaction receipt
    deactivate DB
    PayAPI-->>App: Return VietQR bank template information
    deactivate PayAPI
    App-->>Student: Display Transfer Information or QR code
    deactivate App

    Note over Student: Student details transfer from banking App using exact reference code

    BankAPI->>PayAPI: Send POST /api/payments/webhook status updates (payment callback payload)
    activate PayAPI
    
    PayAPI->>DB: Query pending receipt matching transferContent reference
    activate DB
    DB-->>PayAPI: Receipt Record
    deactivate DB

    rect rgb(240, 255, 240)
        alt Match Found and Amount Correct
            PayAPI->>DB: Update Receipt (status: COMPLETED)
            activate DB
            PayAPI->>DB: Update User (tier: PREMIUM, storage limit upgrade)
            DB-->>PayAPI: DB state updated
            deactivate DB
            PayAPI-->>BankAPI: HTTP 200 Success Confirmation
        else Fail Validation / Code Mismatch
            PayAPI->>DB: Update Receipt (status: FAILED / Flag for manual admin audit review)
            PayAPI-->>BankAPI: HTTP 400 Validation Error
        end
    end
    deactivate PayAPI
```
