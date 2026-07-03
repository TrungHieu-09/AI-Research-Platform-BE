import { NextRequest, NextResponse } from "next/server"
import { UploadMetadataSchema } from "@/lib/validation/doc"
import { getUserDocuments, createDocument } from "@/lib/services/doc-service"

/**
 * @swagger
 * /api/documents:
 *   get:
 *     summary: List User Documents
 *     description: >
 *       Returns a paginated list of documents owned by the authenticated user.
 *       Includes nested subject metadata for each document.
 *     tags:
 *       - Documents
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number (min 1).
 *         example: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items per page (max 50).
 *         example: 20
 *     responses:
 *       200:
 *         description: Paginated list of documents.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Document'
 *                 total:
 *                   type: integer
 *                   example: 45
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 pageSize:
 *                   type: integer
 *                   example: 20
 *       401:
 *         description: Unauthorized missing/invalid token.
 *       500:
 *         description: Internal server error.
 *   post:
 *     summary: Register Document Metadata
 *     description: >
 *       Registers document metadata after successful file upload to cloud storage.
 *       Automatic workflow logic: if visibility is `PRIVATE`, status defaults to `APPROVED`
 *       immediately for instant AI RAG usage. If `PUBLIC`, status is set to `PENDING`
 *       awaiting Admin review.
 *     tags:
 *       - Documents
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - subjectId
 *               - visibility
 *               - fileUrl
 *               - fileHash
 *               - fileSize
 *               - mimeType
 *               - pageCount
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 3
 *                 example: "Giáo trình Lập trình Web"
 *               description:
 *                 type: string
 *                 example: "Tài liệu môn Web cơ bản cho sinh viên IT"
 *               subjectId:
 *                 type: string
 *                 format: uuid
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *               visibility:
 *                 type: string
 *                 enum: [PRIVATE, PUBLIC]
 *                 default: PRIVATE
 *               fileUrl:
 *                 type: string
 *                 example: "https://storage.googleapis.com/bucket/doc.pdf"
 *               fileHash:
 *                 type: string
 *                 description: SHA-256 hash (64 hex characters) of file contents.
 *                 example: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 *               fileSize:
 *                 type: integer
 *                 example: 5242880
 *               mimeType:
 *                 type: string
 *                 example: "application/pdf"
 *               pageCount:
 *                 type: integer
 *                 example: 120
 *     responses:
 *       201:
 *         description: Document registered successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Document'
 *             example:
 *               id: "550e8400-e29b-41d4-a716-446655440002"
 *               title: "Giáo trình Lập trình Web"
 *               status: "APPROVED"
 *               visibility: "PRIVATE"
 *       400:
 *         description: Bad request or duplicate file hash.
 *       422:
 *         description: Validation error.
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
