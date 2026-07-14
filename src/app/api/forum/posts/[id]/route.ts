import { NextRequest, NextResponse } from "next/server"
import { getOptionalRequestUser, requireRequestUser } from "@/lib/auth"
import { deleteForumPost, getForumPostById } from "@/lib/services/forum-service"

/**
 * @swagger
 * /api/forum/posts/{id}:
 *   get:
 *     summary: Get Forum Post Details
 *     description: >
 *       APPROVED PUBLIC posts can be viewed by everyone. Owners can view their own
 *       PRIVATE/PENDING/REJECTED posts. Admins can view all posts. View count is incremented.
 *     tags:
 *       - Forum
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Forum post details with author, subject, tags, replies, and solved reply.
 *       403:
 *         description: Access denied.
 *       404:
 *         description: Forum post not found.
 *   delete:
 *     summary: Soft Delete Forum Post
 *     description: Owner can delete their own post; Admin can delete any post.
 *     tags:
 *       - Forum
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Forum post deleted.
 *       401:
 *         description: Authentication required.
 *       403:
 *         description: Permission denied.
 *       404:
 *         description: Forum post not found.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getOptionalRequestUser(req)
    const post = await getForumPostById(params.id, user)
    return NextResponse.json(post)
  } catch (err: any) {
    const status =
      err.message === "Forum post not found."
        ? 404
        : err.message.startsWith("Forbidden")
          ? 403
          : 500
    return NextResponse.json({ error: err.message }, { status })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRequestUser(req)
    await deleteForumPost(params.id, user)
    return NextResponse.json({ message: "Forum post deleted successfully." })
  } catch (err: any) {
    const status =
      err.message === "Authentication required."
        ? 401
        : err.message === "Forum post not found."
          ? 404
          : err.message === "Permission denied."
            ? 403
            : 500
    return NextResponse.json({ error: err.message }, { status })
  }
}
