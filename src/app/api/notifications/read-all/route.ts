import { NextRequest, NextResponse } from "next/server"
import { markAllNotificationsAsRead } from "@/lib/services/notification-service"

/**
 * @swagger
 * /api/notifications/read-all:
 *   put:
 *     summary: Mark All Notifications as Read
 *     description: Mark all unread notifications of the currently authenticated user as read.
 *     tags:
 *       - Notifications
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 updatedCount: { type: integer, example: 5 }
 *       401:
 *         description: Authentication required.
 */
export async function PUT(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    const result = await markAllNotificationsAsRead(userId)
    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed to mark notifications as read." }, { status: 500 })
  }
}
