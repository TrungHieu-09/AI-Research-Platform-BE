import { NextRequest, NextResponse } from "next/server"
import { getDocumentAnalytics } from "@/lib/services/stats-service"

/**
 * @swagger
 * /api/admin/stats/documents:
 *   get:
 *     summary: Get Document Views Analytics
 *     description: Retrieve daily timeline aggregated document views, filterable by date range and academic subject.
 *     tags:
 *       - Analytics Dashboard
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         example: "2026-06-01"
 *         description: Start date (YYYY-MM-DD).
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         example: "2026-07-03"
 *         description: End date (YYYY-MM-DD).
 *       - in: query
 *         name: subjectId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Optional subject UUID filter.
 *     responses:
 *       200:
 *         description: Document analytics retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalViewsFiltered: { type: integer, example: 520 }
 *                 timeline:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date: { type: string, example: "2026-07-01" }
 *                       count: { type: integer, example: 45 }
 *       403:
 *         description: Access denied (Admin role required).
 */
export async function GET(req: NextRequest) {
  try {
    const role = req.headers.get("x-user-role")
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied. Admin role required." }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const subjectId = searchParams.get("subjectId")

    const analytics = await getDocumentAnalytics(from, to, subjectId)
    return NextResponse.json(analytics, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed to fetch document analytics." }, { status: 500 })
  }
}
