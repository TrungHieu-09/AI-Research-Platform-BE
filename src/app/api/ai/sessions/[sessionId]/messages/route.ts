import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(req: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const userId = req.headers.get("x-user-id")
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    const session = await db.chatSession.findFirst({
      where: { id: params.sessionId, userId },
      select: { id: true },
    })

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 })
    }

    const messages = await db.chatMessage.findMany({
      where: { sessionId: params.sessionId },
      orderBy: { createdAt: "asc" },
      include: {
        citations: {
          select: {
            id: true,
            documentId: true,
            pageNumber: true,
            textExcerpt: true,
          },
        },
      },
    })

    return NextResponse.json({
      sessionId: params.sessionId,
      messages,
      placeholder: true,
      message: "AI functionality is currently unavailable. Message history is returned as placeholder data.",
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
