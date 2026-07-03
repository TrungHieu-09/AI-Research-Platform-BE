import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * @swagger
 * /api/admin/documents/{id}/hard:
 *   delete:
 *     summary: Permanently Delete Document (Admin only)
 *     description: >
 *       Hard deletes a document permanently from the PostgreSQL database along with associated embeddings and ratings.
 *       Cannot be undone or restored.
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
 *         description: Document permanently deleted.
 *         content:
 *           application/json:
 *             example:
 *               message: "Document permanently deleted."
 *       403:
 *         description: Access denied (Admin role required).
 *       404:
 *         description: Document not found.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const role = req.headers.get("x-user-role")
    const adminId = req.headers.get("x-user-id")

    if (role !== "ADMIN" || !adminId) {
      return NextResponse.json({ error: "Access denied. Admin role required." }, { status: 403 })
    }

    const doc = await db.document.findUnique({
      where: { id: params.id }
    })

    if (!doc) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 })
    }

    // Permanently delete the document from DB
    await db.document.delete({
      where: { id: params.id }
    })

    await db.auditLog.create({
      data: {
        userId: adminId,
        action: "HARD_DELETE_DOCUMENT",
        targetEntity: "documents",
        targetId: params.id,
        ipAddress: req.headers.get("x-forwarded-for") ?? req.ip
      }
    })

    return NextResponse.json({ message: "Document permanently deleted." }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed to permanently delete document." }, { status: 500 })
  }
}
