import { NextRequest, NextResponse } from "next/server"
import { requireRequestUser } from "@/lib/auth"
import { CreateForumReplySchema } from "@/lib/validation/forum"
import { createForumReply } from "@/lib/services/forum-service"

/**
 * @swagger
 * /api/forum/posts/{id}/replies:
 *   post:
 *     summary: Create Forum Reply
 *     description: Allows replies on APPROVED posts or on posts accessible to the owner/Admin.
 *     tags:
 *       - Forum
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string, example: "Try comparing the methods by dataset and limitations." }
 *     responses:
 *       201:
 *         description: Forum reply created.
 *       401:
 *         description: Authentication required.
 *       403:
 *         description: Access denied.
 *       404:
 *         description: Forum post not found.
 *       422:
 *         description: Validation error.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRequestUser(req)
    const body = await req.json()
    const parsed = CreateForumReplySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const reply = await createForumReply(params.id, user.id, user, parsed.data)
    return NextResponse.json(reply, { status: 201 })
  } catch (err: any) {
    const status =
      err.message === "Authentication required."
        ? 401
        : err.message === "Forum post not found."
          ? 404
          : err.message.startsWith("Forbidden") || err.message === "Replies are only allowed on approved posts."
            ? 403
            : 500
    return NextResponse.json({ error: err.message }, { status })
  }
}
