import { NextRequest, NextResponse } from "next/server"
import { getOptionalRequestUser, requireRequestUser } from "@/lib/auth"
import { CreateForumPostSchema } from "@/lib/validation/forum"
import { createForumPost, getForumPosts } from "@/lib/services/forum-service"

function parseBoolean(value: string | null) {
  if (value === "true") return true
  if (value === "false") return false
  return undefined
}

/**
 * @swagger
 * /api/forum/posts:
 *   get:
 *     summary: List Forum Posts
 *     description: >
 *       Public users can see only APPROVED + PUBLIC posts.
 *       Authenticated users can also see their own PRIVATE/PENDING/REJECTED posts.
 *       Admin users can see all non-deleted posts.
 *     tags:
 *       - Forum
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [APPROVED, PENDING, REJECTED] }
 *       - in: query
 *         name: visibility
 *         schema: { type: string, enum: [PUBLIC, PRIVATE] }
 *       - in: query
 *         name: subjectId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: tag
 *         schema: { type: string }
 *       - in: query
 *         name: mine
 *         schema: { type: boolean }
 *       - in: query
 *         name: solved
 *         schema: { type: boolean }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [newest, most_discussed, most_viewed, trending] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated forum posts.
 *   post:
 *     summary: Create Forum Post
 *     description: PRIVATE posts are created as APPROVED; PUBLIC posts are created as PENDING for Admin review.
 *     tags:
 *       - Forum
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content, visibility]
 *             properties:
 *               title: { type: string, example: "How should I structure a literature review?" }
 *               content: { type: string, example: "I need guidance for comparing related papers." }
 *               subjectId: { type: string, format: uuid, nullable: true }
 *               tags:
 *                 type: array
 *                 items: { type: string }
 *                 example: ["research-methods", "literature-review"]
 *               visibility: { type: string, enum: [PRIVATE, PUBLIC] }
 *     responses:
 *       201:
 *         description: Forum post created.
 *       401:
 *         description: Authentication required.
 *       422:
 *         description: Validation error.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getOptionalRequestUser(req)
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, Number(searchParams.get("page") ?? 1))
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 20)))

    const result = await getForumPosts(user, page, pageSize, {
      search: searchParams.get("search") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      visibility: searchParams.get("visibility") ?? undefined,
      subjectId: searchParams.get("subjectId") ?? undefined,
      tag: searchParams.get("tag") ?? undefined,
      mine: parseBoolean(searchParams.get("mine")),
      solved: parseBoolean(searchParams.get("solved")),
      sort: searchParams.get("sort") ?? "newest",
    })

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRequestUser(req)
    const body = await req.json()
    const parsed = CreateForumPostSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const post = await createForumPost(user.id, parsed.data)
    return NextResponse.json(post, { status: 201 })
  } catch (err: any) {
    const status = err.message === "Authentication required." ? 401 : err.message === "Subject not found." ? 404 : 400
    return NextResponse.json({ error: err.message }, { status })
  }
}
