import { NextRequest, NextResponse } from "next/server"
import { requireAdminUser } from "@/lib/auth"
import { getAdminForumPosts } from "@/lib/services/forum-service"

/**
 * @swagger
 * /api/admin/forum/posts:
 *   get:
 *     summary: List Forum Posts for Moderation
 *     tags:
 *       - Forum Admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated forum posts for moderation.
 *       401:
 *         description: Authentication required.
 *       403:
 *         description: Admin role required.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdminUser(req)

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, Number(searchParams.get("page") ?? 1))
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 20)))

    const result = await getAdminForumPosts(page, pageSize, {
      status: searchParams.get("status") ?? undefined,
      search: searchParams.get("search") ?? undefined,
    })

    return NextResponse.json(result)
  } catch (err: any) {
    const status = err.message === "Authentication required." ? 401 : err.message.includes("Admin role") ? 403 : 500
    return NextResponse.json({ error: err.message }, { status })
  }
}
