import { NextResponse } from "next/server"
import { getForumTags } from "@/lib/services/forum-service"

/**
 * @swagger
 * /api/forum/tags:
 *   get:
 *     summary: List Popular Forum Tags
 *     tags:
 *       - Forum
 *     responses:
 *       200:
 *         description: Popular tags from visible public forum posts.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name: { type: string }
 *                       count: { type: integer }
 */
export async function GET() {
  try {
    const tags = await getForumTags()
    return NextResponse.json(tags)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
