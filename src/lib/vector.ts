import { getGeminiClient, rotateGeminiKey } from "@/lib/gemini-pool"
import { db } from "@/lib/db"

/**
 * Generate a vector embedding for the given text using Google Gemini's
 * gemini-embedding-001 model with robust exponential backoff retry & multi-key rotation for Free Tier rate limits.
 */
export async function getEmbeddings(text: string): Promise<number[]> {
  let lastErr: any = null

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const genAI = getGeminiClient()
      const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" })
      const result = await model.embedContent(text.trim())
      const vals = result.embedding.values
      // Slice/Matryoshka representation to 768 dimensions for pgvector hnsw indexing limit (<2000)
      return vals.slice(0, 768)
    } catch (err: any) {
      lastErr = err
      const msg = err.message || ""
      if (msg.includes("503") || msg.includes("429") || msg.includes("high demand") || msg.includes("exceeded") || msg.includes("Quota")) {
        const rotated = rotateGeminiKey()
        if (rotated) {
          console.warn(`[Embeddings Warn] Rate limit on attempt ${attempt}. Rotated API key instantly...`)
          continue
        }
        const waitMs = attempt * 2000
        console.warn(`[Embeddings Warn] Rate limit/High demand on attempt ${attempt}. Waiting ${waitMs}ms before retry...`)
        await new Promise((resolve) => setTimeout(resolve, waitMs))
        continue
      } else {
        break
      }
    }
  }
  throw lastErr ?? new Error("Failed to generate vector embeddings after multiple retries.")
}

/**
 * Perform a pgvector cosine similarity search against document_chunks.
 * Returns the top-k most relevant chunks belonging to APPROVED, non-deleted documents.
 *
 * @param queryEmbedding - The embedding vector to compare against stored chunks
 * @param limit          - Maximum number of results to return (default 5)
 * @param documentId     - Optional: restrict search to a single document
 * @param subjectId      - Optional: restrict search to a specific subject
 */
export async function searchSimilarChunks(
  queryEmbedding: number[],
  limit: number = 5,
  documentId?: string,
  subjectId?: string,
) {
  const vectorStr = `[${queryEmbedding.join(",")}]`

  // Raw SQL is required because Prisma does not natively support pgvector operators
  if (documentId) {
    return db.$queryRaw<
      {
        id: string
        documentId: string
        pageNumber: number
        content: string
        title: string
        distance: number
      }[]
    >`
      SELECT c.id, c."documentId", c."pageNumber", c.content, d.title,
             (c.embedding <=> ${vectorStr}::vector) AS distance
      FROM document_chunks c
      JOIN documents d ON c."documentId" = d.id
      WHERE d.status = 'APPROVED'
        AND d."deletedAt" IS NULL
        AND d.id = ${documentId}::uuid
      ORDER BY distance ASC
      LIMIT ${limit}
    `
  }

  if (subjectId) {
    return db.$queryRaw<
      {
        id: string
        documentId: string
        pageNumber: number
        content: string
        title: string
        distance: number
      }[]
    >`
      SELECT c.id, c."documentId", c."pageNumber", c.content, d.title,
             (c.embedding <=> ${vectorStr}::vector) AS distance
      FROM document_chunks c
      JOIN documents d ON c."documentId" = d.id
      WHERE d.status = 'APPROVED'
        AND d."deletedAt" IS NULL
        AND d."subjectId" = ${subjectId}::uuid
      ORDER BY distance ASC
      LIMIT ${limit}
    `
  }

  return db.$queryRaw<
    {
      id: string
      documentId: string
      pageNumber: number
      content: string
      title: string
      distance: number
    }[]
  >`
    SELECT c.id, c."documentId", c."pageNumber", c.content, d.title,
           (c.embedding <=> ${vectorStr}::vector) AS distance
    FROM document_chunks c
    JOIN documents d ON c."documentId" = d.id
    WHERE d.status = 'APPROVED'
      AND d."deletedAt" IS NULL
    ORDER BY distance ASC
    LIMIT ${limit}
  `
}
