import { NextRequest, NextResponse } from "next/server"
import { getDocumentById, softDeleteDocument } from "@/lib/services/doc-service"

/**
 * @swagger
 * /api/documents/{id}:
 *   get:
 *     summary: Get Document Details
 *     tags: [Documents]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Document details
 *   delete:
 *     summary: Soft Delete Document
 *     tags: [Documents]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Document soft deleted
 */
// GET /api/documents/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = req.headers.get("x-user-id")!
    const role = req.headers.get("x-user-role")!
    const doc = await getDocumentById(params.id, userId, role)
    return NextResponse.json(doc)
  } catch (err: any) {
    const status = err.message === "Document not found." ? 404 : err.message === "Access denied." ? 403 : 500
    return NextResponse.json({ error: err.message }, { status })
  }
}

// DELETE /api/documents/[id] — soft delete
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = req.headers.get("x-user-id")!
    const role = req.headers.get("x-user-role")!
    await softDeleteDocument(params.id, userId, role)
    return NextResponse.json({ message: "Document deleted successfully." })
  } catch (err: any) {
    const status = err.message === "Document not found." ? 404 : err.message === "Permission denied." ? 403 : 500
    return NextResponse.json({ error: err.message }, { status })
  }
}
