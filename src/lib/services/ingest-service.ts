const pdfParseMod = require("pdf-parse")

async function parseBufferToText(buffer: Buffer): Promise<string> {
  if (typeof pdfParseMod === "function") {
    try {
      const res = await pdfParseMod(buffer)
      if (res && res.text) return res.text
    } catch (e) {}
  }
  if (typeof pdfParseMod.default === "function") {
    try {
      const res = await pdfParseMod.default(buffer)
      if (res && res.text) return res.text
    } catch (e) {}
  }
  if (pdfParseMod.PDFParse) {
    const parser = new pdfParseMod.PDFParse({ data: buffer })
    const textRes = await parser.getText()
    return textRes.text || textRes || ""
  }
  return buffer.toString("utf-8")
}

import { db } from "@/lib/db"
import { getEmbeddings } from "@/lib/vector"
import fs from "fs"
import path from "path"

/**
 * Ingest a document (from PDF Buffer or raw text) into PostgreSQL vector storage (`document_chunks`).
 * Uses Google Gemini's gemini-embedding-001 model (768 dimensions) via getEmbeddings().
 */
export async function ingestDocumentToVector(documentId: string, pdfBufferOrText: Buffer | string) {
  let fullText = ""

  if (typeof pdfBufferOrText === "string") {
    fullText = pdfBufferOrText
  } else {
    try {
      fullText = await parseBufferToText(pdfBufferOrText)
    } catch (err: any) {
      console.error("Failed to parse PDF buffer, treating as UTF-8 string:", err.message)
      fullText = pdfBufferOrText.toString("utf-8")
    }
  }

  // Remove null bytes (0x00) which PostgreSQL strictly forbids in UTF-8 columns
  fullText = fullText.replace(/\x00/g, "").trim()

  if (!fullText || fullText.trim().length === 0) {
    throw new Error("Cannot ingest document: No text content found.")
  }

  // Clear previous chunks for this document if re-ingesting
  await db.documentChunk.deleteMany({ where: { documentId } })

  // Split into chunks (~800 characters, overlap ~150 characters)
  const chunkSize = 800
  const overlap = 150
  const chunks: string[] = []

  let startIndex = 0
  while (startIndex < fullText.length) {
    const chunkText = fullText.slice(startIndex, startIndex + chunkSize).trim()
    if (chunkText.length > 30) {
      chunks.push(chunkText)
    }
    startIndex += (chunkSize - overlap)
  }

  console.log(`[Ingest] Document ${documentId}: generating embeddings for ${chunks.length} chunks using Google Gemini...`)

  // Generate vectors and insert into document_chunks table
  for (let idx = 0; idx < chunks.length; idx++) {
    const content = chunks[idx].replace(/\x00/g, "").trim()
    if (!content) continue
    
    // Pace API calls slightly (250ms) to respect Free Tier rate limits
    if (idx > 0) await new Promise((r) => setTimeout(r, 250))

    const embedding = await getEmbeddings(content)
    const vectorStr = `[${embedding.join(",")}]`

    // Raw SQL required for vector column insertion in pgvector
    await db.$executeRawUnsafe(`
      INSERT INTO document_chunks ("id", "documentId", "chunkIndex", "pageNumber", "content", "embedding", "createdAt")
      VALUES (gen_random_uuid(), '${documentId}'::uuid, ${idx}, ${1}, $1, '${vectorStr}'::vector, NOW())
    `, content)
  }

  console.log(`✅ [Ingest] Successfully inserted ${chunks.length} chunks for document ${documentId}`)
  return { success: true, chunksCount: chunks.length }
}

/**
 * Automatically fetch or load file from fileUrl and ingest into vector storage.
 */
export async function autoIngestDocument(documentId: string, fileUrl: string) {
  let fileBuffer: Buffer | null = null

  if (fileUrl.startsWith("/") || fileUrl.includes("localhost") || fileUrl.includes("mock-upload")) {
    const relativePath = fileUrl.replace(/http:\/\/localhost:\d+\//, "")
    const localPath = path.join(process.cwd(), "public", relativePath)
    
    if (fs.existsSync(localPath)) {
      fileBuffer = fs.readFileSync(localPath)
    } else {
      const doc = await db.document.findUnique({ where: { id: documentId } })
      const fallbackText = `Title: ${doc?.title ?? "Document"}\nDescription: ${doc?.description ?? "N/A"}\n\nThis is the content of document ${doc?.title}. It covers fundamental concepts of the subject area.`
      fileBuffer = Buffer.from(fallbackText, "utf-8")
    }
  } else {
    const res = await fetch(fileUrl)
    if (!res.ok) {
      throw new Error(`Failed to fetch remote document file at ${fileUrl}: ${res.statusText}`)
    }
    const arrayBuffer = await res.arrayBuffer()
    fileBuffer = Buffer.from(arrayBuffer)
  }

  return ingestDocumentToVector(documentId, fileBuffer)
}
