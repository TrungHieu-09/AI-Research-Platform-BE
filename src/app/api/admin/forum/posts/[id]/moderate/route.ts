import { NextRequest, NextResponse } from "next/server"
import { requireAdminUser } from "@/lib/auth"
import { moderateForumPost } from "@/lib/services/forum-service"
import { ForumModerationSchema } from "@/lib/validation/forum"

/**
 * @swagger
 * /api/admin/forum/posts/{id}/moderate:
 *   post:
 *     summary: Moderate Forum Post
 *     description: >
 *       APPROVED sets status APPROVED and clears rejectionReason.
 *       REJECTED requires rejectionReason and creates a notification for the post owner.
 *     tags:
 *       - Forum Admin
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
 *             required: [decision]
 *             properties:
 *               decision: { type: string, enum: [APPROVED, REJECTED] }
 *               rejectionReason: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Forum post moderation updated.
 *       401:
 *         description: Authentication required.
 *       403:
 *         description: Admin role required.
 *       404:
 *         description: Forum post not found.
 *       422:
 *         description: Validation error.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdminUser(req)

    const body = await req.json()
    const parsed = ForumModerationSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const post = await moderateForumPost(params.id, parsed.data)
    return NextResponse.json(post)
  } catch (err: any) {
    const status =
      err.message === "Authentication required."
        ? 401
        : err.message.includes("Admin role")
          ? 403
          : err.message === "Forum post not found."
            ? 404
            : 500
    return NextResponse.json({ error: err.message }, { status })
  }
}
