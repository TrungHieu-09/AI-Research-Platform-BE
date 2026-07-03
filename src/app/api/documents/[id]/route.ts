import { NextRequest, NextResponse } from "next/server"
import { getDocumentById, softDeleteDocument } from "@/lib/services/doc-service"

/**
 * @swagger
 * /api/documents/{id}:
 *   get:
 *     summary: Get Document Details
 *     description: Retrieve details of a specific document including its owner and subject. Automatically increments document view count if accessible.
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
 *         description: Document details retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Document'
 *       403:
 *         description: Access denied (Private document owned by another user).
 *       404:
 *         description: Document not found.
 *   delete:
 *     summary: Soft Delete Document
 *     description: Soft delete a document by setting its `deletedAt` timestamp. Document can be restored within 30 days. Restricted to document owner or Admin.
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
 *         description: Document soft deleted successfully.
 *         content:
 *           application/json:
 *             example:
 *               message: "Document deleted successfully."
 *       403:
 *         description: Permission denied (Not owner or Admin).
 *       404:
 *         description: Document not found.
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
