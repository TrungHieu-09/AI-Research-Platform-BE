import OpenAI from "openai"
import { db } from "@/lib/db"
import { getEmbeddings, searchSimilarChunks } from "@/lib/vector"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const DAILY_LIMITS = { FREE: 10, PREMIUM: 50 } as const

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

  // 5. Persist user message
  await db.chatMessage.create({
    data: { sessionId, sender: "USER", message },
  })

  // 6. Call OpenAI (non-streaming for simplicity; swap for streaming in production)
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
  })

  const aiAnswer = completion.choices[0].message.content ?? ""

  // 7. Persist AI message
  const aiMessage = await db.chatMessage.create({
    data: { sessionId, sender: "AI", message: aiAnswer },
  })

  // 8. Persist citations
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

  // 9. Record audit log
  await db.auditLog.create({
    data: { userId, action: "AI_QUERY", targetEntity: "chat_sessions", targetId: sessionId },
  })

  return {
    answer: aiAnswer,
    citations: matchedChunks.map((c, i) => ({
      index: i + 1,
      documentTitle: c.title,
      pageNumber: c.pageNumber,
      excerpt: c.content.slice(0, 200),
    })),
  }
}
