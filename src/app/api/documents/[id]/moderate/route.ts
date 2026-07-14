import { NextRequest, NextResponse } from "next/server"
import { ModerationDecisionSchema } from "@/lib/validation/doc"
import { moderateDocument } from "@/lib/services/doc-service"

/**
 * @swagger
 * /api/documents/{id}/moderate:
 *   post:
 *     summary: Moderate Document (Approve/Reject)
 *     description: >
 *       Allows an Admin to approve or reject a pending public document.
 *       Supports alias keys `decision` or `status` from Frontend. If rejected, `rejectionReason` is required.
 *       Side-effect: automatically records an audit log entry.
 *     tags:
 *       - Documents
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Document ID (UUID).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - decision
 *             properties:
 *               decision:
 *                 type: string
 *                 enum: [APPROVED, REJECTED]
 *                 description: Can also pass alias field `status`.
 *                 example: "APPROVED"
 *               rejectionReason:
 *                 type: string
 *                 description: Required if decision is REJECTED.
 *                 example: "Violates academic formatting guidelines."
 *     responses:
 *       200:
 *         description: Document moderation updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Document'
 *       400:
 *         description: Invalid status transition or missing rejection reason.
 *       403:
 *         description: Access denied (Admin role required).
 *       404:
 *         description: Document not found.
 *       422:
 *         description: Validation error.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const role = req.headers.get("x-user-role")
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied. Admin role required." }, { status: 403 })
    }

    const { id } = await params
    const adminId = req.headers.get("x-user-id")!
    const ipAddress = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip")
    const body = await req.json()
    const parsed = ModerationDecisionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const doc = await moderateDocument(id, adminId, parsed.data, ipAddress ?? undefined)
    return NextResponse.json(doc)
  } catch (err: any) {
    const status = err.message === "Document not found." ? 404 : 400
    return NextResponse.json({ error: err.message }, { status })
  }
}
