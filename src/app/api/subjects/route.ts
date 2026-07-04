import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { CreateSubjectSchema } from "@/lib/validation/subject"

/**
 * @swagger
 * /api/subjects:
 *   get:
 *     summary: List all subjects
 *     description: >
 *       Returns a list of subjects. This is a public endpoint — no authentication
 *       required. Supports optional filtering by a search keyword (matched against
 *       name) and by status. Results are ordered by name ascending.
 *     tags:
 *       - Subjects
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         required: false
 *         description: Partial match filter applied to subject name (case-insensitive).
 *         example: "math"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, SUSPENDED]
 *         required: false
 *         description: Filter subjects by their current status.
 *         example: "ACTIVE"
 *     responses:
 *       200:
 *         description: Array of subjects matching the given filters.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Subject'
 *             example:
 *               - id: "550e8400-e29b-41d4-a716-446655440000"
 *                 name: "Mathematics"
 *                 code: "MATH101"
 *                 status: "ACTIVE"
 *                 createdAt: "2026-07-03T08:00:00.000Z"
 *                 updatedAt: "2026-07-03T08:00:00.000Z"
 *       500:
 *         description: Unexpected server error.
 *   post:
 *     summary: Create a new subject
 *     description: >
 *       Creates a new subject. Restricted to administrators only (enforced by middleware).
 *       The `code` field must be globally unique; if a subject with the same code
 *       already exists a 409 Conflict is returned. On successful creation an entry
 *       is appended to the `auditLog` table.
 *     tags:
 *       - Subjects
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - code
 *             properties:
 *               name:
 *                 type: string
 *                 description: Human-readable display name of the subject.
 *                 example: "Artificial Intelligence"
 *               code:
 *                 type: string
 *                 description: Short unique identifier for the subject (e.g. course code).
 *                 example: "AI301"
 *     responses:
 *       201:
 *         description: Subject created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subject'
 *             example:
 *               id: "550e8400-e29b-41d4-a716-446655440001"
 *               name: "Artificial Intelligence"
 *               code: "AI301"
 *               status: "ACTIVE"
 *               createdAt: "2026-07-03T08:00:00.000Z"
 *               updatedAt: "2026-07-03T08:00:00.000Z"
 *       409:
 *         description: A subject with this code already exists.
 *       422:
 *         description: Validation error in request body.
 *       500:
 *         description: Unexpected server error.
 */
// GET /api/subjects — public subject list
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") ?? ""
    const status = searchParams.get("status") as "ACTIVE" | "SUSPENDED" | null

    const subjects = await db.subject.findMany({
      where: {
        ...(status && { status }),
        ...(search && { name: { contains: search, mode: "insensitive" } }),
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json(subjects)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/subjects — Admin only (enforced by middleware)
export async function POST(req: NextRequest) {
  try {
    const adminId = req.headers.get("x-user-id")
    const body = await req.json()
    const parsed = CreateSubjectSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const existing = await db.subject.findUnique({ where: { code: parsed.data.code } })
    if (existing) {
      return NextResponse.json({ error: "A subject with this code already exists." }, { status: 409 })
    }

    const subject = await db.subject.create({ data: parsed.data })

    if (adminId) {
      await db.auditLog.create({
        data: {
          userId: adminId,
          action: "CREATE_SUBJECT",
          targetEntity: "subjects",
          targetId: subject.id,
          ipAddress: req.headers.get("x-forwarded-for") ?? req.ip
        }
      })
    }

    return NextResponse.json(subject, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
