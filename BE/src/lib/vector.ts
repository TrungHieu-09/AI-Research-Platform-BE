import OpenAI from "openai"
import { db } from "@/lib/db"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

/**
 * Generate a vector embedding for the given text using OpenAI's
 * text-embedding-ada-002 model (1536 dimensions).
 */
export async function getEmbeddings(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: text.trim(),
  })
  return response.data[0].embedding
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
