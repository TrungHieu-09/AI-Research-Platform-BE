import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { UpdateSubjectSchema } from "@/lib/validation/subject"

/**
 * @swagger
 * /api/subjects/{id}:
 *   get:
 *     summary: Get Subject Details
 *     description: Retrieve details of a specific subject by ID.
 *     tags:
 *       - Subjects
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Subject ID (UUID).
 *     responses:
 *       200:
 *         description: Subject details retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subject'
 *       404:
 *         description: Subject not found.
 *   put:
 *     summary: Edit Subject Metadata (Admin only)
 *     description: Update subject code, name, or status.
 *     tags:
 *       - Subjects
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code: { type: string, example: "CS101" }
 *               name: { type: string, example: "Computer Science 101" }
 *               status: { type: string, enum: [ACTIVE, SUSPENDED] }
 *     responses:
 *       200:
 *         description: Subject updated successfully.
 *       403:
 *         description: Access denied (Admin role required).
 *       404:
 *         description: Subject not found.
 *       422:
 *         description: Validation error.
 *   delete:
 *     summary: Suspend Subject (Admin only)
 *     description: Deactivates a subject by setting its status to SUSPENDED.
 *     tags:
 *       - Subjects
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Subject deactivated successfully.
 *         content:
 *           application/json:
 *             example:
 *               message: "Subject deactivated."
 *       403:
 *         description: Access denied (Admin role required).
 */
// GET /api/subjects/[id]
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await Promise.resolve(context.params);
  const subject = await db.subject.findUnique({ where: { id } })
  if (!subject) return NextResponse.json({ error: "Subject not found." }, { status: 404 })
  return NextResponse.json(subject)
}

// PUT /api/subjects/[id] — Admin only
export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await Promise.resolve(context.params);
    const role = req.headers.get("x-user-role")
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied. Admin role required." }, { status: 403 })
    }

    const adminId = req.headers.get("x-user-id")
    const body = await req.json()
    const parsed = UpdateSubjectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const subject = await db.subject.update({ where: { id }, data: parsed.data })

    if (adminId) {
      await db.auditLog.create({
        data: {
          userId: adminId,
          action: "UPDATE_SUBJECT",
          targetEntity: "subjects",
          targetId: subject.id,
          ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1"
        }
      })
    }

    return NextResponse.json(subject)
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to update subject." }, { status: 400 })
  }
}

// DELETE /api/subjects/[id] — Admin only (sets status to SUSPENDED)
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await Promise.resolve(context.params);
    const role = req.headers.get("x-user-role")
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied. Admin role required." }, { status: 403 })
    }

    const adminId = req.headers.get("x-user-id")
    const subject = await db.subject.update({
      where: { id },
      data: { status: "SUSPENDED" },
    })

    if (adminId) {
      await db.auditLog.create({
        data: {
          userId: adminId,
          action: "SUSPEND_SUBJECT",
          targetEntity: "subjects",
          targetId: subject.id,
          ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1"
        }
      })
    }

    return NextResponse.json({ message: "Subject deactivated.", subject })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to suspend subject." }, { status: 400 })
  }
}
