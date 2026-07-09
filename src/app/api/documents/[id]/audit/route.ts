import { NextRequest, NextResponse } from "next/server"
import { getDocumentAuditLogs } from "@/lib/services/doc-service"

/**
 * @swagger
 * /api/documents/{id}/audit:
 *   get:
 *     summary: Get Document Audit Logs (Admin only)
 *     description: Retrieve all moderation and modification audit logs for a specific document.
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
 *     responses:
 *       200:
 *         description: List of audit logs retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string, format: uuid }
 *                   action: { type: string, example: "DOCUMENT_APPROVED" }
 *                   userId: { type: string, format: uuid }
 *                   user:
 *                     type: object
 *                     properties:
 *                       name: { type: string }
 *                       role: { type: string }
 *                   createdAt: { type: string, format: date-time }
 *       403:
 *         description: Access denied (Admin role required).
 *       500:
 *         description: Internal server error.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const role = req.headers.get("x-user-role")
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied. Admin role required." }, { status: 403 })
    }

    const logs = await getDocumentAuditLogs(id)
    return NextResponse.json(logs, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to fetch audit logs." }, { status: 500 })
  }
}
