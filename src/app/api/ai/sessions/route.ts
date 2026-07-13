import { NextRequest, NextResponse } from "next/server"
import { getUserChatSessions } from "@/lib/services/ai-service"

/**
 * @swagger
 * /api/ai/sessions:
 *   get:
 *     summary: Get User AI Chat Sessions
 *     description: Retrieve all RAG chatbot conversations initiated by the authenticated user, sorted by most recent activity.
 *     tags:
 *       - AI
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of chat sessions retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string, format: uuid }
 *                   title: { type: string, example: "Discussion on Binary Trees" }
 *                   scope: { type: string, enum: [SINGLE_DOCUMENT, SUBJECT, GLOBAL] }
 *                   document:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       title: { type: string }
 *                   _count:
 *                     type: object
 *                     properties:
 *                       messages: { type: integer, example: 8 }
 *                   updatedAt: { type: string, format: date-time }
 *       401:
 *         description: Authentication required.
 */
export async function GET(req: NextRequest) {
  try {
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

    const sessions = await getUserChatSessions(userId)
    return NextResponse.json(sessions, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed to fetch chat sessions." }, { status: 500 })
  }
}
