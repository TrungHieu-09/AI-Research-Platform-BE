import { NextRequest, NextResponse } from "next/server"
import { requireRequestUser } from "@/lib/auth"
import { SolveForumPostSchema } from "@/lib/validation/forum"
import { solveForumPost } from "@/lib/services/forum-service"

/**
 * @swagger
 * /api/forum/posts/{id}/solve:
 *   post:
 *     summary: Mark Forum Post Solved
 *     description: Only the post owner or Admin can mark a reply as the solved answer.
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
 *             required: [replyId]
 *             properties:
 *               replyId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Forum post marked as solved.
 *       401:
 *         description: Authentication required.
 *       403:
 *         description: Permission denied.
 *       404:
 *         description: Forum post or reply not found.
 *       422:
 *         description: Validation error.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRequestUser(req)
    const body = await req.json()
    const parsed = SolveForumPostSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const post = await solveForumPost(params.id, user, parsed.data)
    return NextResponse.json(post)
  } catch (err: any) {
    const status =
      err.message === "Authentication required."
        ? 401
        : err.message === "Forum post not found." || err.message === "Reply not found for this post."
          ? 404
          : err.message === "Permission denied."
            ? 403
            : 500
    return NextResponse.json({ error: err.message }, { status })
  }
}
