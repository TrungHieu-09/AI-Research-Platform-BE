import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireBearerAdmin } from "@/lib/request-auth"
import { AdminCreateUserSchema } from "@/lib/validation/auth"
import { createUserByAdmin } from "@/lib/services/user-service"

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users (Admin only)
 *     description: Retrieve a paginated and filtered list of users with document/chat counts and biometric verification status.
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *   post:
 *     summary: Create User by Admin
 *     description: Create an ACTIVE user account without registration OTP. User can login immediately and verify email later from Profile.
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 */
export async function GET(req: NextRequest) {
  try {
    await requireBearerAdmin(req)

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
    if (filterStatus && (filterStatus === "ACTIVE" || filterStatus === "UNVERIFIED" || filterStatus === "SUSPENDED")) {
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
          emailVerified: true,
          emailVerifiedAt: true,
          verificationStatus: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              documents: true,
              chatSessions: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ])

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({ items: users, total, page, limit, totalPages }, { status: 200 })
  } catch (error: any) {
    const status = error.message === "Authentication required." ? 401 : error.message.includes("Admin role") ? 403 : 500
    return NextResponse.json({ error: error.message ?? "Failed to fetch users." }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireBearerAdmin(req)

    const body = await req.json()
    const parsed = AdminCreateUserSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const user = await createUserByAdmin(parsed.data)
    return NextResponse.json(user, { status: 201 })
  } catch (error: any) {
    if (error.message === "An account with this email already exists.") {
      return NextResponse.json(
        {
          error: "An account with this email already exists.",
          message: "Email này đã tồn tại trong hệ thống.",
          fieldErrors: {
            email: ["Email này đã tồn tại trong hệ thống."],
          },
        },
        { status: 409 },
      )
    }

    const status =
      error.message === "Authentication required."
        ? 401
        : error.message.includes("Admin role")
          ? 403
          : 500
    return NextResponse.json({ error: error.message ?? "Failed to create user." }, { status })
  }
}
