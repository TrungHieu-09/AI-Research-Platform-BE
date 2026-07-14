import { NextResponse } from "next/server"
import { getForumStats } from "@/lib/services/forum-service"

/**
 * @swagger
 * /api/forum/stats:
 *   get:
 *     summary: Get Forum Stats
 *     tags:
 *       - Forum
 *     responses:
 *       200:
 *         description: Forum counters for visible public posts.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalPosts: { type: integer }
 *                 solvedPosts: { type: integer }
 *                 unansweredPosts: { type: integer }
 *                 activeUsers: { type: integer }
 *                 totalReplies: { type: integer }
 */
export async function GET() {
  try {
    const stats = await getForumStats()
    return NextResponse.json(stats)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
