import { db } from "@/lib/db"
import { parseBufferToText } from "@/lib/services/ingest-service"
import { getEmbeddings } from "@/lib/vector"

export type DocumentDuplicateResult = {
  documentId: string
  title: string
  similarity: number
} | null

function buildRepresentativeChunks(text: string) {
  const normalized = text.replace(/\x00/g, " ").replace(/\s+/g, " ").trim()
  if (!normalized) return []

  const chunkSize = 1200
  const step = 1000
  const chunks: string[] = []

  for (let start = 0; start < normalized.length && chunks.length < 6; start += step) {
    const chunk = normalized.slice(start, start + chunkSize).trim()
    if (chunk.length >= 80) chunks.push(chunk)
  }

  if (chunks.length === 0 && normalized.length >= 30) chunks.push(normalized)
  return chunks
}

export async function checkPublicDocumentContentDuplicate(
  buffer: Buffer,
  filenameOrMime: string,
  threshold = 0.8,
  excludeDocumentId?: string,
): Promise<DocumentDuplicateResult> {
  let text = ""
  try {
    text = await parseBufferToText(buffer, filenameOrMime)
  } catch (error: any) {
    throw new Error(`Failed to extract document text for duplicate check: ${error.message}`)
  }

  text = text.replace(/\x00/g, "").trim()
  if (!text) {
    throw new Error("Cannot check duplicate content: No text content found in document.")
  }

  const chunks = buildRepresentativeChunks(text)
  if (chunks.length === 0) {
    throw new Error("Cannot check duplicate content: No usable text chunks found in document.")
  }

  let bestDuplicate: DocumentDuplicateResult = null

  for (const chunk of chunks) {
    let embedding: number[]
    try {
      embedding = await getEmbeddings(chunk)
    } catch (error: any) {
      throw new Error(`Duplicate check failed while generating embeddings: ${error.message}`)
    }

    const vectorStr = `[${embedding.join(",")}]`
    const excludeClause = excludeDocumentId ? `AND d.id <> $2::uuid` : ""
    const queryParams = excludeDocumentId ? [vectorStr, excludeDocumentId] : [vectorStr]
    const matches = await db.$queryRawUnsafe<
      { documentId: string; title: string; distance: number; similarity: number }[]
    >(
      `
        SELECT d.id AS "documentId",
               d.title,
               (c.embedding <=> $1::vector) AS distance,
               (1 - (c.embedding <=> $1::vector)) AS similarity
        FROM document_chunks c
        JOIN documents d ON c."documentId" = d.id
        WHERE d."deletedAt" IS NULL
          AND d.visibility = 'PUBLIC'
          AND d.status = 'APPROVED'
          AND c.embedding IS NOT NULL
          ${excludeClause}
        ORDER BY distance ASC
        LIMIT 1
      `,
      ...queryParams,
    )

    const match = matches[0]
    if (!match) continue

    const similarity = Number(match.similarity)
    if (similarity >= threshold && (!bestDuplicate || similarity > bestDuplicate.similarity)) {
      bestDuplicate = {
        documentId: match.documentId,
        title: match.title,
        similarity: Math.round(similarity * 100) / 100,
      }
    }
  }

  return bestDuplicate
}