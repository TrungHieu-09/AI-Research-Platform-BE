import { NextRequest, NextResponse } from "next/server"
import { processChatQuery } from "@/lib/services/ai-service"

/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     summary: AI Chat Query with RAG Citations
 *     description: >
 *       Submits a student prompt to the Lumis AI assistant.
 *       Performs vector similarity search against uploaded document chunks (`pgvector`), builds context, and queries OpenAI (`gpt-4o-mini`).
 *       Returns grounded answers with direct document citations and page numbers. Enforces daily query quotas based on user tier.
 *     tags:
 *       - AI
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
 *               - sessionId
 *             properties:
 *               message:
 *                 type: string
 *                 example: "What are the core properties of a binary search tree?"
 *               sessionId:
 *                 type: string
 *                 format: uuid
 *                 example: "550e8400-e29b-41d4-a716-446655440010"
 *               documentId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional restrict RAG search to a specific document.
 *               subjectId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional restrict RAG search to a specific subject tag.
 *               scope:
 *                 type: string
 *                 enum: [SINGLE_DOCUMENT, SUBJECT, GLOBAL]
 *                 default: GLOBAL
 *     responses:
 *       200:
 *         description: AI response generated with citations.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 answer:
 *                   type: string
 *                   example: "A binary search tree has the following properties..."
 *                 citations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       index: { type: integer, example: 1 }
 *                       documentTitle: { type: string, example: "Data Structures Textbook.pdf" }
 *                       pageNumber: { type: integer, example: 45 }
 *                       excerpt: { type: string, example: "In a binary search tree, the left subtree..." }
 *       422:
 *         description: Validation error (missing message or sessionId).
 *       429:
 *         description: Daily AI query limit exceeded.
 *         content:
 *           application/json:
 *             example:
 *               error: "Daily AI query limit exceeded. Upgrade your tier to continue."
 */
// POST /api/ai/chat — RAG chat query
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")!
    const body = await req.json()
    const { message, sessionId, documentId, subjectId, scope } = body

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message is required." }, { status: 422 })
    }
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "sessionId is required." }, { status: 422 })
    }

    const result = await processChatQuery(userId, message, sessionId, documentId, subjectId, scope)
    return NextResponse.json(result)
  } catch (err: any) {
    const status = err.message?.includes("limit exceeded") ? 429 : 500
    return NextResponse.json({ error: err.message }, { status })
  }
}
