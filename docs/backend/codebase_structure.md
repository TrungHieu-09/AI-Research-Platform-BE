# Next.js Backend Codebase Structure
## Project: Lumis (Academic Document Management & AI Synthesis Platform)

This document provides Backend developers with the template, structure, and design patterns for implementing the Next.js API ecosystem. It maps directly to [database_design.md](file:///D:/SDN302-AI-Research-Platform-FE/docs/backend/database_design.md) schemas.

---

## 1. Backend Folder Architecture

Inside Next.js (App Router), BE endpoints are managed using **Route Handlers** located under `src/app/api`. Business logic is abstracted into a **Service Layer** and validated using **Zod Schemas** to maintain clean controllers.

```
src/
├── app/
│   └── api/                         # REST Endpoint Handlers
│       ├── auth/
│       │   ├── login/route.ts       # POST: Validate email, domain, login & issue JWT
│       │   ├── register/route.ts    # POST: Save temporary account, trigger OTP
│       │   └── verify-otp/route.ts  # POST: Check register OTP token, activate user
│       │
│       ├── documents/
│       │   ├── route.ts             # GET: Fetch user docs | POST: Initial upload metadata & storage URLs
│       │   ├── [id]/
│       │   │   ├── route.ts         # GET: File details | DELETE: Soft delete (student)
│       │   │   ├── audit/route.ts   # GET: Document action logs
│       │   │   └── moderate/route.ts # POST: Approve / Reject (Admin) with notes
│       │   └── upload-url/route.ts  # POST: Get presigned upload URL (S3/GCS bucket)
│       │
│       ├── subjects/
│       │   ├── route.ts             # GET: Fetch subjects list | POST: Create subject (Admin)
│       │   ├── [id]/route.ts        # GET: Detail | PUT: Edit metadata | DELETE: Disable/Remove
│       │   └── suggest/route.ts     # POST: Student proposes tag | GET: Pending suggestions
│       │
│       ├── ai/
│       │   ├── chat/route.ts        # POST: Chat stream (LLM query + pgvector RAG chunks + citation)
│       │   └── limit/route.ts       # GET: Remaining daily token quota check
│       │
│       └── payments/
│           ├── checkout/route.ts    # POST: Initiate order transaction receipt
│           └── webhook/route.ts     # POST: Callback verification webhook (Bank API / Auto-check)
│
├── middleware.ts                    # Global Route Protection, JWT Verification & RBAC Guards
│
├── lib/
│   ├── db.ts                        # Singleton Prisma Client export
│   ├── vector.ts                    # Helpers for pgvector embedding searches
│   ├── storage.ts                   # S3 / GCS cloud bucket wrappers
│   │
│   ├── validation/                  # Zod Request Body DTO Validation
│   │   ├── auth.ts                  # Login, Signup, OTP schemas
│   │   ├── doc.ts                   # Upload details, moderation decisions schemas
│   │   └── subject.ts               # Subject details and proposals schemas
│   │
│   └── services/                    # Domain Layer: Reusable Business Logic
│       ├── auth-service.ts
│       ├── doc-service.ts
│       ├── ai-service.ts            # LangChain/AI streaming + pgvector semantic searches
│       └── payment-service.ts
```

---

## 2. Global Middleware & Security (RBAC)

The `src/middleware.ts` runs on edge networks to parse authentication tokens and inspect user roles before hitting the API routes.

```typescript
// src/middleware.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { jwtVerify } from "jose" // Lightweight JWT library compatible with Edge environments

const ROLE_HIERARCHY = {
  GUEST: 0,
  STUDENT: 1,
  ADMIN: 2,
}

// Defines routes and the minimum role required to access them
const ROUTE_RULES: { path: string; minRole: "STUDENT" | "ADMIN" }[] = [
  { path: "/api/documents/moderate", minRole: "ADMIN" },
  { path: "/api/subjects/suggest", minRole: "STUDENT" },
  { path: "/api/subjects", minRole: "ADMIN" }, // Custom creation
  { path: "/api/users", minRole: "ADMIN" },
]

export async function middleware(request: NextRequest) {
  const token = request.headers.get("Authorization")?.split(" ")[1]

  // Check matching API Route Rules
  const matchedRule = ROUTE_RULES.find(rule => 
    request.nextUrl.pathname.startsWith(rule.path)
  )

  if (!matchedRule) return NextResponse.next()

  if (!token) {
    return NextResponse.json({ error: "Authentication token required" }, { status: 401 })
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    
    const userRole = (payload.role as "STUDENT" | "ADMIN") || "STUDENT"
    
    if (ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[matchedRule.minRole]) {
      return NextResponse.json({ error: "Access denied. Insufficient privileges" }, { status: 403 })
    }

    // Attach User ID to request headers for handlers
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-user-id", payload.sub as string)
    requestHeaders.set("x-user-role", userRole)

    return NextResponse.next({
      request: { headers: requestHeaders }
    })
  } catch (err) {
    return NextResponse.json({ error: "Invalid or expired session token" }, { status: 401 })
  }
}

export const config = {
  matcher: ["/api/((?!auth|public).*)"], // Skip login, registration and public landing calls
}
```

---

## 3. Data Transfer Object (DTO) Validation via Zod

We use **Zod** to validate request payloads strictly at the entrance of route handlers.

```typescript
// src/lib/validation/auth.ts
import { z } from "zod"

export const LoginSchema = z.object({
  email: z.string().email().refine(val => val.endsWith("@fpt.edu.vn"), {
    message: "FPT University Institutional Email is required."
  }),
  password: z.string().min(8, "Password must be at least 8 characters long.")
})

export const SignupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email().refine(val => val.endsWith("@fpt.edu.vn"), {
    message: "Signup requires an official @fpt.edu.vn email."
  }),
  password: z.string().min(8, "Password must be at least 8 characters.")
})

export const VerifyOtpSchema = z.object({
  email: z.string().email(),
  otpCode: z.string().length(6, "OTP code must be exactly 6 digits.")
})
```

---

## 4. Sample API Route Handler Configuration

Here is a template implementation for the AI Chatbot handler supporting streaming responses, semantic similarity retrieval (RAG), and citation mapping:

```typescript
// src/app/api/ai/chat/route.ts
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getEmbeddings } from "@/lib/vector"

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-user-id")
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { message, sessionId, documentId, scope } = await req.json()

    // 1. Check Rate Limit / Usage Tier limits
    const user = await db.user.findUnique({ where: { id: userId } })
    const today = new Date()
    today.setHours(0,0,0,0)
    
    const queriesToday = await db.auditLog.count({
      where: {
        userId,
        action: "AI_QUERY",
        createdAt: { gte: today }
      }
    })

    const limit = user?.tier === "PREMIUM" ? 50 : 10
    if (queriesToday >= limit) {
       return NextResponse.json({ error: "Daily AI query limit exceeded. Upgrade your tier package." }, { status: 429 })
    }

    // 2. Perform Cosine Vector Similarity Search (RAG)
    const queryEmbedding = await getEmbeddings(message)
    
    // Prisma pgvector manual query (assuming prisma-extension-pgvector is loaded, or raw query fallback)
    const matchedChunks: any[] = await db.$queryRaw`
      SELECT c.id, c."documentId", c."pageNumber", c.content, d.title,
             (c.embedding <=> ${queryEmbedding}::vector) as distance
      FROM document_chunks c
      JOIN documents d ON c."documentId" = d.id
      WHERE d.status = 'APPROVED' 
        AND d."deletedAt" IS NULL
        ${documentId ? db.$queryRaw`AND d.id = ${documentId}::uuid` : ""}
      ORDER BY distance ASC
      LIMIT 3;
    `

    // 3. Construct contextual prompt with citations
    const contexts = matchedChunks.map((chunk, idx) => 
      `Source [${idx + 1}]: File: "${chunk.title}", Page: ${chunk.pageNumber}\nContent: ${chunk.content}`
    ).join("\n\n")

    const finalPrompt = `
      You are Lumis AI Academic Assistant. Use only the following context metadata sources to synthesize a response.
      If you quote or deduce from a source, append [Source Code Number] notation (e.g. [1]).
      
      Context Sources:
      ${contexts}
      
      User Question:
      ${message}
    `

    // 4. Trigger AI LLM integration (e.g., LangChain or OpenAI Streams)
    // Streaming response could be piped into a TransformStream returned to client

    // 5. Save Query to Audit Logs
    await db.auditLog.create({
      data: {
        userId,
        action: "AI_QUERY",
        targetEntity: "chat_sessions",
        targetId: sessionId
      }
    })

    return NextResponse.json({
      answer: "Processed LLM response stream simulation...",
      citations: matchedChunks.map((c, i) => ({
        index: i + 1,
        documentTitle: c.title,
        pageNumber: c.pageNumber,
        excerpt: c.content
      }))
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to process chat query" }, { status: 500 })
  }
}
```
