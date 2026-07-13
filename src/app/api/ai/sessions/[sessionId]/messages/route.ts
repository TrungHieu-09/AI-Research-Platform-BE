import { NextRequest, NextResponse } from "next/server"
import { getSessionMessages } from "@/lib/services/ai-service"

/**
 * @swagger
 * /api/ai/sessions/{sessionId}/messages:
 *   get:
 *     summary: Get Chat Session Messages & Citations
 *     description: Retrieve all chronological messages and associated document citations for a specific chat session.
 *     tags:
 *       - AI
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Chat Session ID (UUID).
 *     responses:
 *       200:
 *         description: Messages and citations retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string, format: uuid }
 *                   sender: { type: string, enum: [USER, AI] }
 *                   message: { type: string }
 *                   createdAt: { type: string, format: date-time }
 *                   citations:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         pageNumber: { type: integer }
 *                         textExcerpt: { type: string }
 *       403:
 *         description: Access denied to this session.
 *       404:
 *         description: Session not found.
 */
export async function GET(req: NextRequest, context: any) {
  try {
    const params = await Promise.resolve(context?.params)
    const sessionId = params?.sessionId

    let userId = req.headers.get("x-user-id")
    if (!userId) {
      const token = req.headers.get("Authorization")?.split(" ")[1]
      if (token) {
        try {
          const { jwtVerify } = await import("jose")
          const secret = new TextEncoder().encode(process.env.JWT_SECRET)
          const { payload } = await jwtVerify(token, secret)
          if (payload.sub) userId = payload.sub as string
        } catch {}
      }
    }
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    const messages = await getSessionMessages(sessionId, userId)
    return NextResponse.json(messages, { status: 200 })
  } catch (error: any) {
    let status = 500
    if (error.message?.includes("Forbidden")) status = 403
    if (error.message?.includes("not found")) status = 404
    return NextResponse.json({ error: error.message ?? "Failed to fetch session messages." }, { status })
  }
}
