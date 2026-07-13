import { NextRequest, NextResponse } from "next/server"
import { removeDocumentFromCollection } from "@/lib/services/collection-service"

/**
 * @swagger
 * /api/collections/{id}/documents/{documentId}:
 *   delete:
 *     summary: Remove Document from Collection
 *     description: Remove a document from a specific collection owned by the caller.
 *     tags:
 *       - Collections
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Collection ID (UUID).
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Document ID (UUID).
 *     responses:
 *       200:
 *         description: Document removed from collection successfully.
 *       403:
 *         description: Forbidden (Access denied to this collection).
 *       404:
 *         description: Collection or document not found.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    const userId = req.headers.get("x-user-id")
    if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

    await removeDocumentFromCollection((await params).id, userId, (await params).documentId)
    return NextResponse.json({ message: "Document removed from collection." }, { status: 200 })
  } catch (err: any) {
    let status = 400
    if (err.message?.includes("Forbidden")) status = 403
    if (err.message?.includes("not found")) status = 404
    return NextResponse.json({ error: err.message }, { status })
  }
}
