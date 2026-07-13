import { NextRequest, NextResponse } from "next/server"
import { processChatQuery } from "@/lib/services/ai-service"
import { jwtVerify } from "jose"

// POST /api/ai/chat — RAG chat query
/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     summary: Send a chat query to Lumis AI (RAG & Attached File supported)
 *     description: >
 *       Main AI chat endpoint used by the AI Workspace / Chat Box.
 *       Allows users to send questions with an optional `attachedFile` (PDF/DOCX/Image uploaded via `/api/upload`).
 *       When `attachedFile` is provided, the backend extracts document text and bypasses vector RAG to answer based directly on the attached file.
 *     tags:
 *       - AI Assistant
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 example: "Hãy tóm tắt CV của Chu Thanh Tinh và đánh giá kỹ năng Backend"
 *               sessionId:
 *                 type: string
 *                 example: "session-12345"
 *               documentId:
 *                 type: string
 *                 nullable: true
 *               subjectId:
 *                 type: string
 *                 nullable: true
 *               scope:
 *                 type: string
 *                 example: "ALL"
 *               attachedFile:
 *                 type: object
 *                 nullable: true
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: "CHU-THANH-TINH-SE181528.pdf"
 *                   url:
 *                     type: string
 *                     example: "http://localhost:4000/uploads/chat/1783948798469-CHU-THANH-TINH-SE181528.pdf"
 *                   type:
 *                     type: string
 *                     example: "application/pdf"
 *     responses:
 *       200:
 *         description: Successful AI response
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: AI credits limit exceeded
 */
export async function POST(req: NextRequest) {
  try {
    let userId = req.headers.get("x-user-id")
    if (!userId) {
      const token = req.headers.get("Authorization")?.split(" ")[1]
      if (token) {
        try {
          const secret = new TextEncoder().encode(process.env.JWT_SECRET)
          const { payload } = await jwtVerify(token, secret)
          if (payload.sub) userId = payload.sub as string
        } catch {}
      }
    }
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized. Please login first." }, { status: 401 })
    }

    const body = await req.json()
    const { message, sessionId, documentId, subjectId, scope, attachedFile } = body

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message is required." }, { status: 422 })
    }
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "sessionId is required." }, { status: 422 })
    }

    const result = await processChatQuery(userId, message, sessionId, documentId, subjectId, scope, attachedFile)
    return NextResponse.json(result)
  } catch (err: any) {
    const status = err.message?.includes("limit exceeded") ? 429 : 500
    return NextResponse.json({ error: err.message }, { status })
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || process.env.FRONTEND_URL || "http://localhost:3000"
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id, x-user-role, x-user-tier",
      "Access-Control-Allow-Credentials": "true",
    },
  })
}
