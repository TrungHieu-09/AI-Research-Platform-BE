import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users (Admin only)
 *     description: Retrieve a paginated or filtered list of users
 *     tags:
 *       - Users
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [STUDENT, ADMIN]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, SUSPENDED]
 *     responses:
 *       200:
 *         description: List of users retrieved successfully
 *       403:
 *         description: Access denied (Admin required)
 */
export async function GET(req: NextRequest) {
  try {
    const role = req.headers.get("x-user-role")
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied. Admin role required." }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const filterRole = searchParams.get("role")
    const filterStatus = searchParams.get("status")

    const whereClause: any = {}
    if (filterRole && (filterRole === "STUDENT" || filterRole === "ADMIN")) {
      whereClause.role = filterRole
    }
    if (filterStatus && (filterStatus === "ACTIVE" || filterStatus === "SUSPENDED")) {
      whereClause.status = filterStatus
    }

    const users = await db.user.findMany({
      where: whereClause,
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

    return NextResponse.json({ users }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed to fetch users." }, { status: 500 })
  }
}
