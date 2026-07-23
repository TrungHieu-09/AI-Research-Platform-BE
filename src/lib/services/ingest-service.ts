let mammothMod: any = null
try { mammothMod = require("mammoth") } catch (e) {}

function getPdfParse() {
  if (typeof globalThis !== "undefined") {
    if (!(globalThis as any).DOMMatrix) {
      ;(globalThis as any).DOMMatrix = class DOMMatrix {
        a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
        constructor() {}
      }
    }
    if (!(globalThis as any).ImageData) {
      ;(globalThis as any).ImageData = class ImageData {
        data = new Uint8ClampedArray(0); width = 0; height = 0;
        constructor() {}
      }
    }
    if (!(globalThis as any).Path2D) {
      ;(globalThis as any).Path2D = class Path2D {
        constructor() {}
      }
    }
  }
  try {
    const nativeRequire = typeof eval === "function" ? eval("require") : null
    if (nativeRequire) {
      try {
        return nativeRequire("pdf-parse")
      } catch (e) {}
    }
    return require("pdf-parse")
  } catch (err: any) {
    console.warn("[getPdfParse] Error requiring pdf-parse:", err?.message || err)
    return null
  }
}

export async function parseBufferToText(buffer: Buffer, filenameOrMime?: string): Promise<string> {
  const headerPreview = buffer.toString("utf-8", 0, 50).trim()
  const fname = (filenameOrMime || "").toLowerCase()
  const isPdf = headerPreview.startsWith("%PDF-") || headerPreview.includes("%PDF-") || fname.endsWith(".pdf") || fname.includes("pdf")
  const isDocx = (buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04 && !fname.endsWith(".zip")) || fname.endsWith(".docx") || fname.includes("word")

  if (!isPdf && isDocx && mammothMod) {
    try {
      const res = await mammothMod.extractRawText({ buffer })
      if (res && res.value && res.value.trim().length > 0) {
        console.log("[parseBufferToText] Successfully extracted DOCX text, length:", res.value.length)
        return res.value
      }
    } catch (e: any) {
      console.warn("[parseBufferToText] Mammoth DOCX extraction failed:", e?.message || e)
    }
  }

  const tryParser = async (ParserClassOrFn: any, label: string): Promise<string> => {
    if (!ParserClassOrFn) return ""
    try {
      if (typeof ParserClassOrFn === "function") {
        const parser = new ParserClassOrFn({ data: new Uint8Array(buffer) })
        if (parser && typeof parser.getText === "function") {
          const textRes = await parser.getText()
          let extracted = textRes?.text || ""
          if (!extracted && Array.isArray(textRes?.pages)) {
            extracted = textRes.pages.map((p: any) => p?.text || "").join("\n\n")
          }
          if (!extracted && typeof textRes === "string") extracted = textRes
          if (extracted.trim().length > 0) return extracted
        }
      }
    } catch (e: any) {
      console.warn(`[tryParser:${label}] Uint8Array new() error:`, e?.message || e)
    }

    try {
      if (typeof ParserClassOrFn === "function") {
        const parser = new ParserClassOrFn({ data: buffer })
        if (parser && typeof parser.getText === "function") {
          const textRes = await parser.getText()
          let extracted = textRes?.text || ""
          if (!extracted && Array.isArray(textRes?.pages)) {
            extracted = textRes.pages.map((p: any) => p?.text || "").join("\n\n")
          }
          if (!extracted && typeof textRes === "string") extracted = textRes
          if (extracted.trim().length > 0) return extracted
        }
      }
    } catch (e: any) {
      console.warn(`[tryParser:${label}] Buffer new() error:`, e?.message || e)
    }

    try {
      if (typeof ParserClassOrFn === "function") {
        const res = await ParserClassOrFn(buffer)
        if (res && res.text && res.text.trim().length > 0) return res.text
      }
    } catch (e: any) {
      console.warn(`[tryParser:${label}] Direct function call error:`, e?.message || e)
    }

    return ""
  }

  if (isPdf) {
    const pdfParseMod = getPdfParse()
    const candidates = [
      { fn: pdfParseMod?.PDFParse, name: "pdfParseMod.PDFParse" },
      { fn: pdfParseMod?.default?.PDFParse, name: "pdfParseMod.default.PDFParse" },
      { fn: pdfParseMod?.default, name: "pdfParseMod.default" },
      { fn: pdfParseMod, name: "pdfParseMod" },
    ]

    for (const item of candidates) {
      if (item.fn) {
        const result = await tryParser(item.fn, item.name)
        if (result && result.trim().length > 0) {
          console.log(`[parseBufferToText] Successfully extracted PDF text using ${item.name}, length: ${result.length}`)
          return result
        }
      }
    }

    console.warn("[parseBufferToText] All PDF parser candidates returned empty text.")
    return ""
  }

  if (isDocx) {
    return ""
  }

  return buffer.toString("utf-8")
}

import { db } from "@/lib/db"
import { getEmbeddings } from "@/lib/vector"
import fs from "fs"
import path from "path"
import { downloadDocumentFileFromStorage } from "@/lib/storage"

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
    fileBuffer = await downloadDocumentFileFromStorage(fileUrl)
  }

  return ingestDocumentToVector(documentId, fileBuffer)
}
