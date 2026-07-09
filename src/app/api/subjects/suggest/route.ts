import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { SubjectSuggestionSchema, ReviewSuggestionSchema } from "@/lib/validation/subject"

/**
 * @swagger
 * /api/subjects/suggest:
 *   get:
 *     summary: Get Subject Suggestions (Admin only)
 *     description: Retrieve pending, approved, or rejected subject suggestions proposed by students.
 *     tags:
 *       - Subjects
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *           default: PENDING
 *     responses:
 *       200:
 *         description: List of subject suggestions retrieved successfully.
 *       403:
 *         description: Access denied (Admin role required).
 *   post:
 *     summary: Suggest a New Subject
 *     description: Allows a student or faculty member to propose a new academic subject.
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
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Quantum Computing & Cryptography"
 *     responses:
 *       201:
 *         description: Subject suggestion created successfully.
 *       422:
 *         description: Validation error.
 */
// POST /api/subjects/suggest — Student proposes a new subject tag
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")!
    const body = await req.json()
    const parsed = SubjectSuggestionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const suggestion = await db.subjectSuggestion.create({
      data: { name: parsed.data.name, proposedById: userId },
    })

    return NextResponse.json(suggestion, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

// GET /api/subjects/suggest — Admin views pending suggestions
export async function GET(req: NextRequest) {
  try {
    const role = req.headers.get("x-user-role")
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied. Admin role required." }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const status = (searchParams.get("status") as "PENDING" | "APPROVED" | "REJECTED") ?? "PENDING"

    const suggestions = await db.subjectSuggestion.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
      include: { proposedBy: { select: { id: true, name: true, email: true } } },
    })

    return NextResponse.json(suggestions)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
