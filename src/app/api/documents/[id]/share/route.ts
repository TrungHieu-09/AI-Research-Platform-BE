import { NextRequest, NextResponse } from "next/server"
import { shareDocument } from "@/lib/services/interaction-service"
import { ShareDocumentSchema } from "@/lib/validation/interaction"

/**
 * @swagger
 * /api/documents/{id}/share:
 *   post:
 *     summary: Share Document with Another User
 *     description: Allows the document owner to grant specific permissions (view, comment, edit) to another user.
 *     tags:
 *       - Document Interactions
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sharedWith
 *               - permission
 *             properties:
 *               sharedWith:
 *                 type: string
 *                 format: uuid
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *               permission:
 *                 type: string
 *                 enum: [view, comment, edit]
 *                 default: view
 *                 example: "view"
 *     responses:
 *       200:
 *         description: Document shared successfully.
 *       403:
 *         description: Forbidden (Only document owner can share).
 *       404:
 *         description: Document or target user not found.
 *       422:
 *         description: Validation error.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ownerId = req.headers.get("x-user-id")
    if (!ownerId) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

    const body = await req.json()
    const parsed = ShareDocumentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const share = await shareDocument(params.id, ownerId, parsed.data)
    return NextResponse.json(share, { status: 200 })
  } catch (err: any) {
    let status = 400
    if (err.message?.includes("Forbidden")) status = 403
    if (err.message?.includes("not found")) status = 404
    return NextResponse.json({ error: err.message }, { status })
  }
}
