import { NextRequest, NextResponse } from "next/server"
import { checkAiRateLimit } from "@/lib/services/ai-service"

/**
 * @swagger
 * /api/ai/limit:
 *   get:
 *     summary: Check AI Rate Limits
 *     description: Retrieve the caller's daily AI query quota, queries consumed today, remaining queries, and current account tier.
 *     tags:
 *       - AI
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Quota details retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 queriesToday: { type: integer, example: 3 }
 *                 limit: { type: integer, example: 10 }
 *                 remaining: { type: integer, example: 7 }
 *                 tier: { type: string, enum: [FREE, PREMIUM], example: "FREE" }
 *       500:
 *         description: Internal server error.
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
