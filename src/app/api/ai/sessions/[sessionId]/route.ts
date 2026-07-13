import { NextRequest, NextResponse } from "next/server"
import { renameChatSession, deleteChatSession } from "@/lib/services/ai-service"

/**
 * @swagger
 * /api/ai/sessions/{sessionId}:
 *   put:
 *     summary: Rename an AI Chat Session
 *     description: Update the title of a specific AI chat session owned by the authenticated user.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title: { type: string, example: "New Session Title" }
 *     responses:
 *       200:
 *         description: Session renamed successfully.
 *       401:
 *         description: Authentication required.
 *       403:
 *         description: Access denied to this chat session.
 *       404:
 *         description: Session not found.
 *   delete:
 *     summary: Delete an AI Chat Session
 *     description: Permanently delete an AI chat session and all its messages/citations.
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
 *     responses:
 *       200:
 *         description: Session deleted successfully.
 *       401:
 *         description: Authentication required.
 *       403:
 *         description: Access denied to this chat session.
 *       404:
 *         description: Session not found.
 */
export async function PUT(req: NextRequest, context: any) {
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

    const body = await req.json()
    const { title } = body
    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Valid title is required." }, { status: 422 })
    }

    const updatedSession = await renameChatSession(sessionId, userId, title.trim())
    return NextResponse.json(updatedSession, { status: 200 })
  } catch (error: any) {
    let status = 500
    if (error.message?.includes("Forbidden")) status = 403
    if (error.message?.includes("not found")) status = 404
    return NextResponse.json({ error: error.message ?? "Failed to rename session." }, { status })
  }
}

export async function DELETE(req: NextRequest, context: any) {
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

    await deleteChatSession(sessionId, userId)
    return NextResponse.json({ success: true, message: "Session deleted successfully." }, { status: 200 })
  } catch (error: any) {
    let status = 500
    if (error.message?.includes("Forbidden")) status = 403
    if (error.message?.includes("not found")) status = 404
    return NextResponse.json({ error: error.message ?? "Failed to delete session." }, { status })
  }
}
