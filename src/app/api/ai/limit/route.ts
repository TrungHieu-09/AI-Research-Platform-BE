import { NextRequest, NextResponse } from "next/server"
import { checkAiRateLimit } from "@/lib/services/ai-service"

/**
 * @swagger
 * /api/ai/limit:
 *   get:
 *     summary: Check AI Rate Limits
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Token quota and remaining limits
 */
// GET /api/ai/limit — returns remaining daily query quota for the caller
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")!
    const result = await checkAiRateLimit(userId)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
