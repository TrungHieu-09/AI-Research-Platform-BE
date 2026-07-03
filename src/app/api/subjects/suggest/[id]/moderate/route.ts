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
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
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
      where: { id: params.id }
    })

    if (!suggestion) {
      return NextResponse.json({ error: "Suggestion not found" }, { status: 404 })
    }

    if (suggestion.status !== "PENDING") {
      return NextResponse.json({ error: "Suggestion is already processed" }, { status: 400 })
    }

    // Update suggestion status
    const updatedSuggestion = await db.subjectSuggestion.update({
      where: { id: params.id },
      data: { status: action }
    })

    // If approved, create the subject
    if (action === "APPROVED") {
      const code = suggestion.name.toUpperCase().replace(/\s+/g, '_').substring(0, 10)
      
      await db.subject.create({
        data: {
          name: suggestion.name,
          code: code,
          status: "ACTIVE"
        }
      })
    }

    // Audit log
    await db.auditLog.create({
      data: {
        userId: adminId,
        action: `SUGGESTION_${action}`,
        targetEntity: "subject_suggestions",
        targetId: params.id,
        ipAddress: req.headers.get("x-forwarded-for") ?? req.ip
      }
    })

    return NextResponse.json(updatedSuggestion, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed to process suggestion." }, { status: 500 })
  }
}
