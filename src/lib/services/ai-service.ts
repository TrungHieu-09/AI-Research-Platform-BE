import { getGeminiClient, rotateGeminiKey, getKeyCount } from "@/lib/gemini-pool"
import { db } from "@/lib/db"
import { getEmbeddings, searchSimilarChunks } from "@/lib/vector"
import { parseBufferToText } from "@/lib/services/ingest-service"
import crypto from "crypto"
import fs from "fs"
import path from "path"

const DAILY_LIMITS: Record<string, number> = { FREE: 200, BASIC: 500, PREMIUM: 1000, PRO: 5000, ENTERPRISE: 10000 }

// ──────────────────────────────────────────────────────────────────────────────
// Helper: Call Gemini with auto retry, multi-key rotation, and fast model fallback
// ──────────────────────────────────────────────────────────────────────────────

async function callGeminiWithFallback(
  systemPrompt: string,
  userPrompt: string,
  history?: { role: "user" | "model"; parts: [{ text: string }] }[]
): Promise<string> {
  const modelsToTry = [
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite",
    "gemini-3-flash-preview",
    "gemini-2.0-flash",
    "gemini-flash-latest",
    "gemini-1.5-flash"
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
        const contents: any[] = history && history.length > 0
          ? [...history, { role: "user", parts: [{ text: userPrompt }] }]
          : [{ role: "user", parts: [{ text: userPrompt }] }]

        const completion = await model.generateContent({
          contents,
          generationConfig: { temperature: 0.25, topP: 0.85 }
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

  if (user.role === "ADMIN" || (user.role as string) === "MODERATOR") {
    return { queriesToday: 0, limit: 99999, remaining: 99999, tier: user.tier }
  }

  const queriesToday = await db.auditLog.count({
    where: { userId, action: "AI_QUERY", createdAt: { gte: startOfDay } },
  })

  const limit = DAILY_LIMITS[user.tier] ?? DAILY_LIMITS.FREE ?? 200
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
  scope: any = "GLOBAL",
  attachedFile?: { url: string; name: string; type?: string; hash?: string },
) {
  // Normalize parameters to prevent crash when Swagger or API caller passes dummy placeholders like "string", "ALL", or "session-12345"
  const validScopes = ["SINGLE_DOCUMENT", "SUBJECT", "GLOBAL"]
  const normalizedScope: "SINGLE_DOCUMENT" | "SUBJECT" | "GLOBAL" = validScopes.includes(scope) ? scope : "GLOBAL"
  const isUuid = (str?: string) =>
    typeof str === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)

  const normalizedSessionId = isUuid(sessionId)
    ? sessionId
    : crypto.createHash("md5").update(sessionId || "default-session").digest("hex").replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5")

  const normalizedDocId = isUuid(documentId) ? documentId : undefined
  const normalizedSubjectId = isUuid(subjectId) ? subjectId : undefined

  // 1. Rate limit guard
  const { queriesToday, limit } = await checkAiRateLimit(userId)
  if (queriesToday >= limit) {
    throw new Error("Daily AI query limit exceeded. Upgrade your tier to continue.")
  }

  // Load existing session messages to maintain multi-turn memory & file persistence across turns
  const previousMessages = await db.chatMessage.findMany({
    where: { sessionId: normalizedSessionId },
    orderBy: { createdAt: "asc" },
  })

  // Restore attached file from earlier turn if not passed explicitly on follow-up turn
  let effectiveAttachedFile = attachedFile
  if (!effectiveAttachedFile?.url && previousMessages.length > 0) {
    for (let i = previousMessages.length - 1; i >= 0; i--) {
      const match = previousMessages[i].message.match(/^\[ATTACHED_FILE:(.*?)\]\n/)
      if (match) {
        try {
          effectiveAttachedFile = JSON.parse(match[1])
          console.log(`[Session Memory] Restored attached file from previous turn: "${effectiveAttachedFile?.name}"`)
          break
        } catch (e) {}
      }
    }
  }

  // Extract attached file text if present
  let attachedFileText = ""
  if (effectiveAttachedFile?.url) {
    try {
      // 1. Try local disk path inside /public
      let relativePath = decodeURIComponent(effectiveAttachedFile.url.replace(/^https?:\/\/[^/]+/, ""))
      if (relativePath.startsWith("/")) relativePath = relativePath.slice(1)
      const localFilePath = path.join(process.cwd(), "public", relativePath)
      if (fs.existsSync(localFilePath)) {
        const fileBuffer = fs.readFileSync(localFilePath)
        attachedFileText = await parseBufferToText(fileBuffer, effectiveAttachedFile.name)
        attachedFileText = attachedFileText.replace(/\x00/g, "").trim()
      } else {
        // 2. Fallback: fetch over HTTP if local disk check fails
        const res = await fetch(effectiveAttachedFile.url)
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer()
          attachedFileText = await parseBufferToText(Buffer.from(arrayBuffer), effectiveAttachedFile.name)
          attachedFileText = attachedFileText.replace(/\x00/g, "").trim()
        }
      }
    } catch (e: any) {
      console.error("Error extracting text from attached file:", e?.message)
    }
    if (attachedFileText) {
      console.log(`[Attached File] Successfully extracted ${attachedFileText.length} characters from "${effectiveAttachedFile.name}"`)
    } else {
      console.warn(`[Attached File] Could not extract text from "${effectiveAttachedFile.name}" (Length: 0). Might be a scanned/image PDF.`)
    }
  }

  // 1.5. Check DB AI Cache ONLY for brand new session (Turn 1) without attached files
  if (previousMessages.length === 0 && normalizedDocId && !attachedFileText) {
    try {
      const queryHash = crypto.createHash("sha256").update(`${normalizedDocId}_${message.toLowerCase().trim()}`).digest("hex")
      const cached = await db.aiCache.findUnique({ where: { queryHash } })
      if (cached && cached.expiresAt > new Date()) {
        await db.aiCache.update({ where: { queryHash }, data: { hitCount: { increment: 1 } } })
        await db.chatSession.upsert({
          where: { id: normalizedSessionId },
          create: { id: normalizedSessionId, userId, title: message.slice(0, 60), documentId: normalizedDocId, subjectId: normalizedSubjectId ?? null, scope: normalizedScope },
          update: { updatedAt: new Date() },
        })
        await db.chatMessage.create({ data: { sessionId: normalizedSessionId, sender: "USER", message } })
        const parsed = JSON.parse(cached.answer)
        await db.chatMessage.create({ data: { sessionId: normalizedSessionId, sender: "AI", message: parsed.answer } })
        await db.auditLog.create({ data: { userId, action: "AI_QUERY", targetEntity: "chat_sessions", targetId: normalizedSessionId } })
        return parsed
      }
    } catch (e) {
      // Ignore cache lookup errors
    }
  }

  // 2. Vector similarity search (RAG context retrieval)
  // ONLY search library chunks if there is NO directly attached file (`!effectiveAttachedFile`)!
  let matchedChunks: any[] = []
  if (!effectiveAttachedFile) {
    const queryEmbedding = await getEmbeddings(message)
    matchedChunks = await searchSimilarChunks(queryEmbedding, 5, normalizedDocId, normalizedSubjectId)
  }

  // 3. Build contextual prompt with citations and attached file content
  const libraryContexts = matchedChunks
    .map(
      (chunk, idx) =>
        `Source [${idx + 1}]: File: "${chunk.title}", Page: ${chunk.pageNumber}\nContent: ${chunk.content}`,
    )
    .join("\n\n")

  const attachedContext = effectiveAttachedFile
    ? (attachedFileText
      ? `=== DIRECTLY ATTACHED FILE CONTENT ("${effectiveAttachedFile.name}") ===\n${attachedFileText.slice(0, 18000)}\n=================================================================\n\n`
      : `=== DIRECTLY ATTACHED FILE ("${effectiveAttachedFile.name}") ===\n(Notice: No selectable text layer could be automatically extracted from this file. It might be a scanned PDF or image without OCR text.)\n=================================================================\n\n`)
    : ""

  const systemPrompt = effectiveAttachedFile
    ? `You are Lumis AI, an elite academic research, technical evaluation, and document analysis assistant tailored for FPT University students and developers.
You have been provided with the user's directly attached document ("${effectiveAttachedFile.name}").

### MANDATORY RESPONSE FORMATTING & UI/UX AESTHETICS RULES:
1. **Clean & Professional Hierarchy**: Start main sections with clear level-3 headings (e.g. \`### 📌 Thông Tin Chung\`, \`### 🛠️ Đánh Giá Kỹ Năng\`, \`### 💡 Đề Xuất & Cải Thiện\`). Each heading MUST be on its own separate line followed by a blank line.
2. **Short & Readable Paragraphs**: Keep every paragraph short and concise (2-3 sentences per paragraph) for optimal readability. NEVER output long monolithic walls of text. Always separate paragraphs by a blank line.
3. **Strict Bullet Lists (\`- \`)**: When listing items or proposals, ALWAYS use hyphens \`- \` (\`- **Họ và tên:** Chu Thanh Tinh\`) or numbered lists (\`1.\`, \`2.\`). NEVER use single asterisks (\`*\`) for bullet points to avoid visual clutter. For bold labels, ALWAYS use double asterisks (\`**bold**\`).
4. **Clean Markdown Tables**: If analyzing a CV, resume, or technical specification, you MUST present skills, metrics, or technologies in a neat markdown table with leading and trailing pipe characters (\`| Col 1 | Col 2 |\`) and separator rows (\`| --- | --- |\`). Do NOT output tab-separated text without pipe delimiters.
5. **Clean Inline Citations**: When referencing document excerpts or facts, ALWAYS write citations inline using square brackets like \`[1]\`, \`[2]\` right next to the sentence. NEVER write \`#1\` or \`#2\` on new lines or isolated paragraphs.
6. **Technical Highlight & Keywords**: Highlight important technical keywords (\`Node.js\`, \`MongoDB\`) inside backticks or "DOUBLE QUOTES".
7. **Callouts for Key Advice**: Wrap critical tips or summary highlights inside blockquotes:
   > [!TIP]
   > **Lời khuyên**: ...
   or
   > [!IMPORTANT]
   > **Điểm nổi bật**: ...
8. **Mandatory Ending Sections**: When providing a comprehensive review or evaluation, ALWAYS end your response with two distinct sections:
   - \`### 📑 Tóm Tắt\` (Summary of main findings and conclusions)
   - \`### 🚀 Khuyến Nghị Tiếp Theo\` (Actionable recommendations and next steps)

### CONTENT EVALUATION GUIDELINES:
- **Strict Accuracy**: Base your analysis and answers STRICTLY and ONLY on the extracted text inside \`DIRECTLY ATTACHED FILE CONTENT\` and our conversation history. Never hallucinate or invent qualifications.
- **Out of Context Rule**: If the user asks a question that cannot be answered using the attached file, you MUST politely refuse to answer and state that you can only answer questions related to the document. Do NOT use your general knowledge.
- **If analyzing a CV / Resume**: Provide a comprehensive breakdown including personal profile, education, technical proficiency table, project experience, and actionable suggestions to make their CV stand out to top IT recruiters.
- **If analyzing an SRS / Project Document**: Summarize system objectives, functional/non-functional requirements table, and architectural highlights.
- **If no selectable text layer could be extracted**: Politely inform the user that the file '${effectiveAttachedFile.name}' appears to be a scanned image or file without selectable text layer, requesting them to provide an OCR-processed PDF or Word document.`
    : `You are Lumis AI, an elite academic research assistant and technical mentor for FPT University students.

### MANDATORY RESPONSE FORMATTING & UI/UX AESTHETICS RULES:
1. **Clean & Professional Hierarchy**: Use engaging headings (\`### 📌\`, \`#### 💡\`), concise bullet points (\`- \`), and clean line breaks. Never output monolithic walls of text. Keep every paragraph short (2-3 sentences) separated by blank lines.
2. **Strict Bullet Lists**: ALWAYS use hyphens \`- \` (\`- **Khái niệm:** ...\`) for bullet items. NEVER use single asterisks (\`*\`) for bullet points or lists.
3. **Markdown Tables**: When comparing concepts, listing technologies, or organizing structured data, always use neat markdown tables with pipe characters (\`| Col 1 | Col 2 |\`) and separator line (\`| --- | --- |\`).
4. **Code & Technical Keywords**: Highlight all technical terms (\`Node.js\`, \`Next.js\`, \`SQL\`) inside backticks or double quotes.
5. **Citations**: When you reference information from the library sources, append clear citations inline using square brackets like \`[1]\` or \`[2]\`. NEVER write \`#1\` or \`#2\` on new lines.
6. **Callouts**: Highlight critical tips or academic notes inside blockquotes (\`> [!TIP]\` or \`> [!NOTE]\`).
7. **Ending Summary**: For detailed answers, end with two sections: \`### 📑 Tóm Tắt\` and \`### 🚀 Khuyến Nghị Tiếp Theo\`.

### ACCURACY RULES:
- Answer questions STRICTLY and ONLY based on the provided document excerpts from the library and previous conversation context.
- **Out of Context Rule**: If the library context does not contain enough information to answer the question definitively, you MUST politely refuse to answer and state clearly: "Xin lỗi, thông tin bạn hỏi không có trong tài liệu hiện tại." (Sorry, the information you asked for is not in the current document). Do NOT use your general knowledge or offer outside academic guidance.`;

  // Build multi-turn history for Gemini
  const geminiHistory: { role: "user" | "model"; parts: [{ text: string }] }[] = []
  for (const m of previousMessages) {
    let cleanText = m.message
    const match = cleanText.match(/^\[ATTACHED_FILE:.*?\]\n([\s\S]*)$/)
    if (match) cleanText = match[1]

    if (m.sender === "USER") {
      geminiHistory.push({ role: "user", parts: [{ text: cleanText }] })
    } else if (m.sender === "AI") {
      geminiHistory.push({ role: "model", parts: [{ text: cleanText }] })
    }
  }

  let userPrompt = ""
  if (geminiHistory.length === 0) {
    userPrompt = attachedContext || libraryContexts
      ? `${attachedContext}${libraryContexts ? `Library Context Sources:\n${libraryContexts}\n\n` : ""}Student Question:\n${message}`
      : `Student Question:\n${message}\n\n(No relevant document excerpts or attached files found. Provide a general academic answer.)`
  } else {
    // If follow-up turn and file is attached/remembered, ensure file context is prepended to Turn 1 history
    if (effectiveAttachedFile && attachedFileText && geminiHistory[0]?.role === "user") {
      if (!geminiHistory[0].parts[0].text.includes("=== DIRECTLY ATTACHED FILE CONTENT")) {
        geminiHistory[0].parts[0].text = `=== DIRECTLY ATTACHED FILE CONTENT ("${effectiveAttachedFile.name}") ===\n${attachedFileText.slice(0, 18000)}\n=================================================================\n\n${geminiHistory[0].parts[0].text}`
      }
    }
    userPrompt = `${libraryContexts ? `Library Context Sources:\n${libraryContexts}\n\n` : ""}Student Follow-up Question:\n${message}`
  }

  // 5. Ensure chat session exists
  await db.chatSession.upsert({
    where: { id: normalizedSessionId },
    create: {
      id: normalizedSessionId,
      userId,
      title: message.slice(0, 60),
      documentId: normalizedDocId ?? null,
      subjectId: normalizedSubjectId ?? null,
      scope: normalizedScope,
    },
    update: { updatedAt: new Date() },
  })

  // 6. Persist user message with file metadata if attached on this turn
  const userMsgToSave = attachedFile?.url
    ? `[ATTACHED_FILE:${JSON.stringify({ name: attachedFile.name, url: attachedFile.url, type: attachedFile.type })}]\n${message}`
    : message

  await db.chatMessage.create({
    data: { sessionId: normalizedSessionId, sender: "USER", message: userMsgToSave },
  })

  // 7. Call Google Gemini with Auto Retry, Multi-Turn History & Fallback
  const aiAnswer = await callGeminiWithFallback(systemPrompt, userPrompt, geminiHistory)

  // 8. Persist AI message
  const aiMessage = await db.chatMessage.create({
    data: { sessionId: normalizedSessionId, sender: "AI", message: aiAnswer },
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
    data: { userId, action: "AI_QUERY", targetEntity: "chat_sessions", targetId: normalizedSessionId },
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
  if (normalizedDocId) {
    try {
      const queryHash = crypto.createHash("sha256").update(`${normalizedDocId}_${message.toLowerCase().trim()}`).digest("hex")
      const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000)
      await db.aiCache.upsert({
        where: { queryHash },
        create: {
          queryHash,
          documentId: normalizedDocId,
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

  const rawMessages = await db.chatMessage.findMany({
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

  return rawMessages.map((msg) => {
    let cleanMessage = msg.message
    let attachedFileMeta: any = undefined
    const match = cleanMessage.match(/^\[ATTACHED_FILE:(.*?)\]\n([\s\S]*)$/)
    if (match) {
      try {
        attachedFileMeta = JSON.parse(match[1])
        cleanMessage = match[2]
      } catch (e) {}
    }
    return {
      ...msg,
      message: cleanMessage,
      attachedFile: attachedFileMeta,
    }
  })
}

export async function renameChatSession(sessionId: string, userId: string, newTitle: string) {
  const session = await db.chatSession.findUnique({ where: { id: sessionId } })
  if (!session) throw new Error("Session not found.")
  if (session.userId !== userId) throw new Error("Forbidden: Access denied to this chat session.")

  return db.chatSession.update({
    where: { id: sessionId },
    data: { title: newTitle },
  })
}

export async function deleteChatSession(sessionId: string, userId: string) {
  const session = await db.chatSession.findUnique({ where: { id: sessionId } })
  if (!session) throw new Error("Session not found.")
  if (session.userId !== userId) throw new Error("Forbidden: Access denied to this chat session.")

  return db.chatSession.delete({
    where: { id: sessionId },
  })
}

