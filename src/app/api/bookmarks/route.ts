import { NextRequest, NextResponse } from "next/server"
import { getUserBookmarks } from "@/lib/services/interaction-service"

/**
 * @swagger
 * /api/bookmarks:
 *   get:
 *     summary: Get User Bookmarks
 *     description: Retrieve all documents bookmarked by the currently authenticated user.
 *     tags:
 *       - Document Interactions
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of bookmarked documents retrieved successfully.
 *       401:
 *         description: Authentication required.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    const bookmarks = await getUserBookmarks(userId)
    return NextResponse.json(bookmarks, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to retrieve bookmarks." }, { status: 500 })
  }
}
