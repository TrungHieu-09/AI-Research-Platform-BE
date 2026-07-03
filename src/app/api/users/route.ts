import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users (Admin only)
 *     description: Retrieve a paginated and filtered list of users along with counts of their documents and chat sessions.
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number (min 1).
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *         description: Number of records per page (max 50).
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [STUDENT, ADMIN]
 *         description: Filter by user role.
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, SUSPENDED]
 *         description: Filter by account status.
 *     responses:
 *       200:
 *         description: Paginated list of users retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       name: { type: string, example: "Nguyen Van A" }
 *                       email: { type: string, example: "student@fpt.edu.vn" }
 *                       avatarUrl: { type: string, nullable: true }
 *                       role: { type: string, enum: [STUDENT, ADMIN] }
 *                       status: { type: string, enum: [ACTIVE, SUSPENDED] }
 *                       tier: { type: string, enum: [FREE, PREMIUM] }
 *                       _count:
 *                         type: object
 *                         properties:
 *                           documents: { type: integer, example: 5 }
 *                           chatSessions: { type: integer, example: 12 }
 *                 total: { type: integer, example: 100 }
 *                 page: { type: integer, example: 1 }
 *                 limit: { type: integer, example: 20 }
 *                 totalPages: { type: integer, example: 5 }
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
    const page = Math.max(1, Number(searchParams.get("page") ?? 1))
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 20)))
    const skip = (page - 1) * limit

    const filterRole = searchParams.get("role")
    const filterStatus = searchParams.get("status")

    const whereClause: any = {}
    if (filterRole && (filterRole === "STUDENT" || filterRole === "ADMIN")) {
      whereClause.role = filterRole
    }
    if (filterStatus && (filterStatus === "ACTIVE" || filterStatus === "SUSPENDED")) {
      whereClause.status = filterStatus
    }

    const [total, users] = await Promise.all([
      db.user.count({ where: whereClause }),
      db.user.findMany({
        where: whereClause,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          role: true,
          status: true,
          tier: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              documents: true,
              chatSessions: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      })
    ])

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({ items: users, total, page, limit, totalPages }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed to fetch users." }, { status: 500 })
  }
}
