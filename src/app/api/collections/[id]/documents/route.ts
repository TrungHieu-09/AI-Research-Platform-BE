import { NextRequest, NextResponse } from "next/server"
import { addDocumentToCollection } from "@/lib/services/collection-service"
import { AddDocumentToCollectionSchema } from "@/lib/validation/collection"

/**
 * @swagger
 * /api/collections/{id}/documents:
 *   post:
 *     summary: Add Document to Collection
 *     description: Add a document to a specific collection owned by the currently authenticated user.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documentId
 *             properties:
 *               documentId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Document added to collection successfully.
 *       403:
 *         description: Forbidden (Access denied to this collection).
 *       404:
 *         description: Collection or document not found.
 *       422:
 *         description: Validation error.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = req.headers.get("x-user-id")
    if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

    const body = await req.json()
    const parsed = AddDocumentToCollectionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const relation = await addDocumentToCollection((await params).id, userId, parsed.data)
    return NextResponse.json(relation, { status: 200 })
  } catch (err: any) {
    const status = err.message === "Collection not found." ? 404 : err.message === "Document not found." ? 404 : 400
    return NextResponse.json({ error: err.message }, { status })
  }
}
