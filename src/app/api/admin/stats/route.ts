import { NextRequest, NextResponse } from "next/server"
import { getAdminOverviewStats } from "@/lib/services/stats-service"

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Get Admin Dashboard Overview Statistics
 *     description: Retrieve system-wide metrics including total users, documents, pending moderations, AI queries today, and top viewed documents.
 *     tags:
 *       - Analytics Dashboard
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalUsers: { type: integer, example: 120 }
 *                 totalDocuments: { type: integer, example: 450 }
 *                 pendingModeration: { type: integer, example: 12 }
 *                 totalViews: { type: integer, example: 3400 }
 *                 aiUsageToday: { type: integer, example: 85 }
 *                 newUsersThisWeek: { type: integer, example: 14 }
 *                 topDocuments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       title: { type: string }
 *                       subject: { type: string }
 *                       viewsCount: { type: integer }
 *                       bookmarksCount: { type: integer }
 *       403:
 *         description: Access denied (Admin role required).
 */
export async function GET(req: NextRequest) {
  try {
    const role = req.headers.get("x-user-role")
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied. Admin role required." }, { status: 403 })
    }

    const stats = await getAdminOverviewStats()
    return NextResponse.json(stats, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed to fetch dashboard statistics." }, { status: 500 })
  }
}
