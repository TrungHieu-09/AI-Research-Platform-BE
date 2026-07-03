import { NextRequest, NextResponse } from "next/server"
import { addBookmark, removeBookmark } from "@/lib/services/interaction-service"

/**
 * @swagger
 * /api/bookmarks/{documentId}:
 *   post:
 *     summary: Bookmark a Document
 *     description: Save a document to the user's personal reading list/bookmarks.
 *     tags:
 *       - Document Interactions
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the document to bookmark.
 *     responses:
 *       200:
 *         description: Document bookmarked successfully.
 *       404:
 *         description: Document not found.
 *   delete:
 *     summary: Remove Bookmark
 *     description: Remove a document from the user's saved bookmarks.
 *     tags:
 *       - Document Interactions
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Bookmark removed successfully.
 *       404:
 *         description: Bookmark not found.
 */

export async function POST(req: NextRequest, { params }: { params: { documentId: string } }) {
  try {
    const userId = req.headers.get("x-user-id")
    if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

    const bookmark = await addBookmark(params.documentId, userId)
    return NextResponse.json(bookmark, { status: 200 })
  } catch (err: any) {
    const status = err.message === "Document not found." ? 404 : 400
    return NextResponse.json({ error: err.message }, { status })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { documentId: string } }) {
  try {
    const userId = req.headers.get("x-user-id")
    if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

    await removeBookmark(params.documentId, userId)
    return NextResponse.json({ message: "Bookmark removed successfully." }, { status: 200 })
  } catch (err: any) {
    const status = err.message === "Bookmark not found." ? 404 : 400
    return NextResponse.json({ error: err.message }, { status })
  }
}
