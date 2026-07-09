import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * @swagger
 * /api/documents/{id}/restore:
 *   post:
 *     summary: Restore Soft-Deleted Document
 *     description: >
 *       Restores a previously soft-deleted document within the allowed retention window (default 30 days).
 *       Accessible by the document owner or an Admin.
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
 *         description: Document restored successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Document'
 *       400:
 *         description: Document is not deleted or retention period (30 days) exceeded.
 *       403:
 *         description: Access denied (Not owner or Admin).
 *       404:
 *         description: Document not found.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const userId = req.headers.get("x-user-id")
    const role = req.headers.get("x-user-role")

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    const doc = await db.document.findUnique({
      where: { id }
    })

    if (!doc) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 })
    }

    if (!doc.deletedAt) {
      return NextResponse.json({ error: "Document is not currently deleted." }, { status: 400 })
    }

    if (role !== "ADMIN" && doc.ownerId !== userId) {
      return NextResponse.json({ error: "Access denied. Only the owner or an Admin can restore this document." }, { status: 403 })
    }

    // Check retention period (default 30 days)
    const retentionMs = 30 * 24 * 60 * 60 * 1000
    if (Date.now() - new Date(doc.deletedAt).getTime() > retentionMs) {
      return NextResponse.json({ error: "Cannot restore document deleted more than 30 days ago." }, { status: 400 })
    }

    const restoredDoc = await db.document.update({
      where: { id },
      data: { deletedAt: null }
    })

    if (role === "ADMIN") {
      await db.auditLog.create({
        data: {
          userId,
          action: "RESTORE_DOCUMENT",
          targetEntity: "documents",
          targetId: id,
          ipAddress: req.headers.get("x-forwarded-for") ?? (req as any).ip
        }
      })
    }

    return NextResponse.json(restoredDoc, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed to restore document." }, { status: 500 })
  }
}
