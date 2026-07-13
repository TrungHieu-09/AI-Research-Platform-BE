import { NextRequest, NextResponse } from "next/server"
import { getPublicDocuments } from "@/lib/services/doc-service"

/**
 * @swagger
 * /api/documents/public:
 *   get:
 *     summary: Get Public Community Documents (Forum Feed)
 *     description: >
 *       Returns a paginated list of public approved documents for the community forum.
 *       Supports optional filtering by subject, search keyword, and sorting by newest,
 *       popular (view count), or top_rated.
 *     tags:
 *       - Documents
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number.
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20 }
 *         description: Number of items per page (max 50).
 *       - in: query
 *         name: subjectId
 *         schema: { type: string, format: uuid }
 *         description: Filter documents by a specific subject ID.
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search keyword matching title or description.
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [newest, popular, top_rated], default: newest }
 *         description: Sort order for documents.
 *     responses:
 *       200:
 *         description: Paginated list of public community documents.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, Number(searchParams.get("page") ?? 1))
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? 20)))
    const subjectId = searchParams.get("subjectId") ?? undefined
    const search = searchParams.get("search") ?? undefined
    const sort = (searchParams.get("sort") as "newest" | "popular" | "top_rated") ?? "newest"

    const result = await getPublicDocuments(page, pageSize, { subjectId, search, sort })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to fetch public documents." }, { status: 500 })
  }
}
