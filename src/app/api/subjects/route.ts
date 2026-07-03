import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { CreateSubjectSchema } from "@/lib/validation/subject"

/**
 * @swagger
 * /api/subjects:
 *   get:
 *     summary: List Subjects
 *     tags: [Subjects]
 *     responses:
 *       200:
 *         description: List of subjects
 *   post:
 *     summary: Create Subject
 *     tags: [Subjects]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               code: { type: string }
 *     responses:
 *       201:
 *         description: Subject created
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
