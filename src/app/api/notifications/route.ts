import { NextRequest, NextResponse } from "next/server"
import { getUserNotifications } from "@/lib/services/notification-service"

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get User Notifications
 *     description: Retrieve unread notification count and the list of recent notifications for the authenticated user.
 *     tags:
 *       - Notifications
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 unreadCount: { type: integer, example: 3 }
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       title: { type: string, example: "Document Approved" }
 *                       content: { type: string }
 *                       read: { type: boolean, example: false }
 *                       createdAt: { type: string, format: date-time }
 *       401:
 *         description: Authentication required.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    const notifs = await getUserNotifications(userId)
    return NextResponse.json(notifs, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed to retrieve notifications." }, { status: 500 })
  }
}
