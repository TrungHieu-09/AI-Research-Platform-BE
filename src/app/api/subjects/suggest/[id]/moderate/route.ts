import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * @swagger
 * /api/subjects/suggest/{id}/moderate:
 *   post:
 *     summary: Moderate Subject Suggestion (Admin only)
 *     description: >
 *       Allows an Admin to approve or reject a student proposed subject suggestion.
 *       If approved (`action: "APPROVED"`), a new Subject is automatically created and activated.
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
 *         description: Suggestion ID (UUID).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [APPROVED, REJECTED]
 *                 example: "APPROVED"
 *     responses:
 *       200:
 *         description: Suggestion processed successfully.
 *       400:
 *         description: Invalid action or suggestion already processed.
 *       403:
 *         description: Access denied (Admin role required).
 *       404:
 *         description: Suggestion not found.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const role = req.headers.get("x-user-role")
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied. Admin role required." }, { status: 403 })
    }

    const adminId = req.headers.get("x-user-id")
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { action } = body

    if (action !== "APPROVED" && action !== "REJECTED") {
      return NextResponse.json({ error: "Invalid action. Must be APPROVED or REJECTED." }, { status: 400 })
    }

    const suggestion = await db.subjectSuggestion.findUnique({
      where: { id }
    })

    if (!suggestion) {
      return NextResponse.json({ error: "Suggestion not found" }, { status: 404 })
    }

    if (suggestion.status !== "PENDING" && !(suggestion.status === "APPROVED" && action === "APPROVED" && !suggestion.subjectId)) {
      return NextResponse.json({ error: "Suggestion is already processed" }, { status: 400 })
    }

    let newSubject = null
    if (action === "APPROVED") {
      let code = body.code ? String(body.code).trim().toUpperCase() : ""
      if (!code) {
        const cleanName = suggestion.name
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, "_")
          .replace(/^_|_$/g, "")
        const prefix = cleanName.substring(0, 10) || "SUB"
        code = prefix
        let counter = 1
        while (await db.subject.findUnique({ where: { code } })) {
          const suffix = `_${Math.floor(100 + Math.random() * 900)}`
          code = `${prefix.substring(0, 12 - suffix.length)}${suffix}`
          counter++
          if (counter > 10) {
            code = `SUB_${Date.now().toString().substring(6)}`
            break
          }
        }
      } else {
        const existingCode = await db.subject.findUnique({ where: { code } })
        if (existingCode && existingCode.id !== suggestion.subjectId) {
          return NextResponse.json({ error: `Subject code '${code}' already exists.` }, { status: 409 })
        }
      }

      if (suggestion.subjectId) {
        newSubject = await db.subject.findUnique({ where: { id: suggestion.subjectId } })
      }
      if (!newSubject) {
        newSubject = await db.subject.create({
          data: {
            name: suggestion.name,
            code: code,
            status: "ACTIVE"
          }
        })
      }
    }

    // Update suggestion status and link subjectId
    const updatedSuggestion = await db.subjectSuggestion.update({
      where: { id },
      data: {
        status: action,
        ...(newSubject && { subjectId: newSubject.id })
      },
      include: { subject: true }
    })

    // Audit log
    await db.auditLog.create({
      data: {
        userId: adminId,
        action: `SUGGESTION_${action}`,
        targetEntity: "subject_suggestions",
        targetId: id,
        ipAddress: req.headers.get("x-forwarded-for") ?? (req as any).ip
      }
    })

    return NextResponse.json(updatedSuggestion, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed to process suggestion." }, { status: 500 })
  }
}
