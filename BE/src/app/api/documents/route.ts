import { NextRequest, NextResponse } from "next/server"
import { UploadMetadataSchema } from "@/lib/validation/doc"
import { getUserDocuments, createDocument } from "@/lib/services/doc-service"

/**
 * @swagger
 * /api/documents:
 *   get:
 *     summary: List User Documents
 *     tags: [Documents]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: A paginated list of documents
 *   post:
 *     summary: Register Document Metadata
 *     tags: [Documents]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               fileHash: { type: string }
 *               fileSize: { type: integer }
 *               mimeType: { type: string }
 *               fileUrl: { type: string }
 *               subjectId: { type: string }
 *     responses:
 *       201:
 *         description: Document metadata registered
 */
// GET /api/documents — list caller's documents (paginated)
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")!
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, Number(searchParams.get("page") ?? 1))
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? 20)))

    const result = await getUserDocuments(userId, page, pageSize)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/documents — register document metadata after client-side upload
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")!
    const body = await req.json()
    const parsed = UploadMetadataSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const doc = await createDocument(userId, parsed.data)
    return NextResponse.json(doc, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
