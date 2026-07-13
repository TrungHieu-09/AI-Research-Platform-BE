import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { autoIngestDocument } from "@/lib/services/ingest-service"
import fs from "fs"
import path from "path"

/**
 * @swagger
 * /api/documents/{id}/ingest:
 *   post:
 *     summary: Trigger AI Vector Ingestion for a Document
 *     description: >
 *       Reads the document file (PDF or text), splits it into ~800 character chunks,
 *       generates Google Gemini embeddings (`embedding-001` - 768 dimensions), and stores them into PostgreSQL pgvector (`document_chunks`).
 *     tags:
 *       - Documents
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Document ID (UUID).
 *     responses:
 *       200:
 *         description: Document chunks successfully ingested into pgvector.
 *       404:
 *         description: Document or file not found.
 *       500:
 *         description: Ingestion failed.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await Promise.resolve(context.params);
    const doc = await db.document.findUnique({
      where: { id, deletedAt: null }
    })

    if (!doc) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 })
    }

    const result = await autoIngestDocument(doc.id, doc.fileUrl)
    return NextResponse.json(result, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to ingest document." }, { status: 500 })
  }
}
