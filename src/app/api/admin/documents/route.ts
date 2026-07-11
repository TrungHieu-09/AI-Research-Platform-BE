import { NextRequest, NextResponse } from "next/server"
import { getAdminDocuments } from "@/lib/services/admin-service"

/**
 * @swagger
 * /api/admin/documents:
 *   get:
 *     summary: List All Documents across System (Admin only)
 *     description: >
 *       Retrieve a paginated and filtered list of all documents across all users.
 *       Allows Admin to filter by moderation status (PENDING, APPROVED, REJECTED), visibility, subject, or student owner.
 *     tags:
 *       - Documents
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number (min 1).
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20 }
 *         description: Number of records per page (max 50).
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         description: Filter by document moderation status.
 *       - in: query
 *         name: visibility
 *         schema:
 *           type: string
 *           enum: [PRIVATE, PUBLIC]
 *         description: Filter by document visibility.
 *       - in: query
 *         name: subjectId
 *         schema: { type: string, format: uuid }
 *         description: Filter by academic subject ID.
 *       - in: query
 *         name: ownerId
 *         schema: { type: string, format: uuid }
 *         description: Filter by specific student user ID.
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search keyword matching title, owner email, or owner name.
 *     responses:
 *       200:
 *         description: Paginated list of documents retrieved successfully.
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
 *                       title: { type: string }
 *                       description: { type: string, nullable: true }
 *                       status: { type: string, enum: [PENDING, APPROVED, REJECTED] }
 *                       visibility: { type: string, enum: [PRIVATE, PUBLIC] }
 *                       rejectionReason: { type: string, nullable: true }
 *                       mimeType: { type: string }
 *                       fileSize: { type: integer }
 *                       pageCount: { type: integer }
 *                       fileUrl: { type: string }
 *                       owner:
 *                         type: object
 *                         properties:
 *                           id: { type: string, format: uuid }
 *                           name: { type: string }
 *                           email: { type: string }
 *                           avatarUrl: { type: string, nullable: true }
 *                       subject:
 *                         type: object
 *                         properties:
 *                           id: { type: string, format: uuid }
 *                           name: { type: string }
 *                           code: { type: string }
 *                       createdAt: { type: string, format: date-time }
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 pageSize: { type: integer }
 *                 totalPages: { type: integer }
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
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? 20)))

    const status = searchParams.get("status") ?? undefined
    const visibility = searchParams.get("visibility") ?? undefined
    const subjectId = searchParams.get("subjectId") ?? undefined
    const ownerId = searchParams.get("ownerId") ?? undefined
    const search = searchParams.get("search") ?? undefined

    const result = await getAdminDocuments(page, pageSize, {
      status,
      visibility,
      subjectId,
      ownerId,
      search,
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed to fetch admin documents." }, { status: 500 })
  }
}
