import { NextRequest, NextResponse } from "next/server"
import { getDocumentAuditLogs } from "@/lib/services/doc-service"

/**
 * @swagger
 * /api/documents/{id}/audit:
 *   get:
 *     summary: Get Document Audit Logs
 *     tags: [Documents]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of audit logs for the document
 */
// GET /api/documents/[id]/audit
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const logs = await getDocumentAuditLogs(params.id)
    return NextResponse.json(logs)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
