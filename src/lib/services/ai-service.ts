import { getGeminiClient, rotateGeminiKey, getKeyCount } from "@/lib/gemini-pool"
import { db } from "@/lib/db"
import { getEmbeddings, searchSimilarChunks } from "@/lib/vector"
import crypto from "crypto"

const DAILY_LIMITS = { FREE: 10, PREMIUM: 50 } as const

// ──────────────────────────────────────────────────────────────────────────────
// Helper: Call Gemini with auto retry, multi-key rotation, and fast model fallback
// ──────────────────────────────────────────────────────────────────────────────

async function callGeminiWithFallback(systemPrompt: string, userPrompt: string): Promise<string> {
  const modelsToTry = [
    "gemini-flash-latest",
    "gemini-3.5-flash"
  ]

  let lastError: any = null

  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const genAI = getGeminiClient()
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemPrompt,
        })
        const completion = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.3 }
        })
        return completion.response.text() ?? ""
      } catch (err: any) {
        lastError = err
        const errMsg = err.message || ""
        if (errMsg.includes("429") || errMsg.includes("Quota") || errMsg.includes("exceeded")) {
          const rotated = rotateGeminiKey()
          if (rotated) {
            console.warn(`[Gemini Warn] Model ${modelName} hit 429 quota limit. Instantly rotated API key...`)
            continue
          }
          console.warn(`[Gemini Warn] Model ${modelName} rate limited and no extra API keys in pool...`)
          break
        } else if (errMsg.includes("503") || errMsg.includes("high demand")) {
          console.warn(`[Gemini Warn] Model ${modelName} attempt ${attempt} busy (${errMsg.slice(0, 60)}...). Waiting 1.5s...`)
          await new Promise((resolve) => setTimeout(resolve, 1500))
          continue
        } else {
          console.warn(`[Gemini Warn] Model ${modelName} error: ${errMsg.slice(0, 60)}... Skipping to next model...`)
          break
        }
      }
    }
  }

  const errText = lastError?.message || ""
  if (errText.includes("429") || errText.includes("Quota") || errText.includes("exceeded")) {
    const match = errText.match(/Please retry in ([0-9.]+)s/i)
    const secs = match ? Math.ceil(parseFloat(match[1])) : 45
    const keyTip = getKeyCount() <= 1 ? " Mẹo: Bạn có thể điền thêm 2-3 API Key miễn phí vào biến GEMINI_API_KEYS trong file .env (cách nhau bởi dấu phẩy) để hệ thống tự động luân chuyển và không bao giờ bị giới hạn nữa!" : ""
    throw new Error(`Hệ thống AI đang tạm thời chạm giới hạn tốc độ xử lý (Quota 15 request/phút của Google Cloud Free Tier). Bạn vui lòng đợi khoảng ${secs} giây rồi bấm Send lại nhé!${keyTip}`)
  }

  throw lastError ?? new Error("All Gemini AI models are currently busy or unavailable. Please try again later.")
}

// ──────────────────────────────────────────────────────────────────────────────
// Rate limit check
// ──────────────────────────────────────────────────────────────────────────────

export async function checkAiRateLimit(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error("User not found.")

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const queriesToday = await db.auditLog.count({
    where: { userId, action: "AI_QUERY", createdAt: { gte: startOfDay } },
  })

  const limit = DAILY_LIMITS[user.tier as keyof typeof DAILY_LIMITS] ?? DAILY_LIMITS.FREE
  return { queriesToday, limit, remaining: Math.max(0, limit - queriesToday), tier: user.tier }
}

// ──────────────────────────────────────────────────────────────────────────────
// Chat (RAG + OpenAI streaming)
// ──────────────────────────────────────────────────────────────────────────────

export async function processChatQuery(
  userId: string,
  message: string,
  sessionId: string,
  documentId?: string,
  subjectId?: string,
  scope: "SINGLE_DOCUMENT" | "SUBJECT" | "GLOBAL" = "GLOBAL",
) {
  // 1. Rate limit guard
  const { queriesToday, limit } = await checkAiRateLimit(userId)
  if (queriesToday >= limit) {
    throw new Error("Daily AI query limit exceeded. Upgrade your tier to continue.")
  }

  // 1.5. Check DB AI Cache to return instant answer without consuming quota
  if (documentId) {
    try {
      const queryHash = crypto.createHash("sha256").update(`${documentId}_${message.toLowerCase().trim()}`).digest("hex")
      const cached = await db.aiCache.findUnique({ where: { queryHash } })
      if (cached && cached.expiresAt > new Date()) {
        await db.aiCache.update({ where: { queryHash }, data: { hitCount: { increment: 1 } } })
        await db.chatSession.upsert({
          where: { id: sessionId },
          create: { id: sessionId, userId, title: message.slice(0, 60), documentId, subjectId: subjectId ?? null, scope },
          update: { updatedAt: new Date() },
        })
        await db.chatMessage.create({ data: { sessionId, sender: "USER", message } })
        const parsed = JSON.parse(cached.answer)
        await db.chatMessage.create({ data: { sessionId, sender: "AI", message: parsed.answer } })
        await db.auditLog.create({ data: { userId, action: "AI_QUERY", targetEntity: "chat_sessions", targetId: sessionId } })
        return parsed
      }
    } catch (e) {
      // Ignore cache lookup errors
    }
  }

  // 2. Generate embedding for the user query
  const queryEmbedding = await getEmbeddings(message)

  // 3. Vector similarity search (RAG context retrieval)
  const matchedChunks = await searchSimilarChunks(queryEmbedding, 5, documentId, subjectId)

  // 4. Build contextual prompt with citations
  const contexts = matchedChunks
    .map(
      (chunk, idx) =>
        `Source [${idx + 1}]: File: "${chunk.title}", Page: ${chunk.pageNumber}\nContent: ${chunk.content}`,
    )
    .join("\n\n")

  const systemPrompt = `You are Lumis AI, an academic research assistant for FPT University students.
Answer questions strictly based on the provided document excerpts.
When you reference information from a source, append [Source N] notation (e.g. [1]).
If the context does not contain enough information, say so clearly — do not hallucinate.`

  const userPrompt = contexts
    ? `Context Sources:\n${contexts}\n\nStudent Question:\n${message}`
    : `Student Question:\n${message}\n\n(No relevant document excerpts found. Provide a general academic answer.)`

  // 5. Ensure chat session exists
  await db.chatSession.upsert({
    where: { id: sessionId },
    create: {
      id: sessionId,
      userId,
      title: message.slice(0, 60),
      documentId: documentId ?? null,
      subjectId: subjectId ?? null,
      scope,
    },
    update: { updatedAt: new Date() },
  })

  // 6. Persist user message
  await db.chatMessage.create({
    data: { sessionId, sender: "USER", message },
  })

  // 7. Call Google Gemini with Auto Retry & Fallback
  const aiAnswer = await callGeminiWithFallback(systemPrompt, userPrompt)

  // 8. Persist AI message
  const aiMessage = await db.chatMessage.create({
    data: { sessionId, sender: "AI", message: aiAnswer },
  })

  // 9. Persist citations
  if (matchedChunks.length > 0) {
    await db.citation.createMany({
      data: matchedChunks.map((chunk) => ({
        messageId: aiMessage.id,
        documentId: chunk.documentId,
        pageNumber: chunk.pageNumber,
        textExcerpt: chunk.content.slice(0, 300),
      })),
    })
  }

  // 10. Record audit log
  await db.auditLog.create({
    data: { userId, action: "AI_QUERY", targetEntity: "chat_sessions", targetId: sessionId },
  })

  const resultObj = {
    answer: aiAnswer,
    citations: matchedChunks.map((c, i) => ({
      index: i + 1,
      documentTitle: c.title,
      pageNumber: c.pageNumber,
      excerpt: c.content.slice(0, 200),
    })),
  }

  // 11. Store into DB AI Cache (30 days TTL)
  if (documentId) {
    try {
      const queryHash = crypto.createHash("sha256").update(`${documentId}_${message.toLowerCase().trim()}`).digest("hex")
      const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000)
      await db.aiCache.upsert({
        where: { queryHash },
        create: {
          queryHash,
          documentId,
          question: message,
          answer: JSON.stringify(resultObj),
          hitCount: 1,
          expiresAt,
        },
        update: {
          answer: JSON.stringify(resultObj),
          hitCount: { increment: 1 },
          expiresAt,
        },
      })
    } catch (e) {
      // Ignore cache storage errors
    }
  }

  return resultObj
}

// ──────────────────────────────────────────────────────────────────────────────
// Chat Sessions & History Retrieval
// ──────────────────────────────────────────────────────────────────────────────

export async function getUserChatSessions(userId: string) {
  return db.chatSession.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      document: { select: { id: true, title: true } },
      subject: { select: { id: true, name: true, code: true } },
      _count: { select: { messages: true } },
    },
  })
}

export async function getSessionMessages(sessionId: string, userId: string) {
  const session = await db.chatSession.findUnique({ where: { id: sessionId } })
  if (!session) throw new Error("Session not found.")
  if (session.userId !== userId) throw new Error("Forbidden: Access denied to this chat session.")

  return db.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    include: {
      citations: {
        select: {
          id: true,
          documentId: true,
          pageNumber: true,
          textExcerpt: true,
          document: { select: { title: true } },
        },
      },
    },
  })
}
