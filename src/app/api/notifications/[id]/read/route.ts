import { NextRequest, NextResponse } from "next/server"
import { markNotificationAsRead } from "@/lib/services/notification-service"

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   put:
 *     summary: Mark Specific Notification as Read
 *     description: Mark a specific notification owned by the caller as read.
 *     tags:
 *       - Notifications
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Notification ID (UUID).
 *     responses:
 *       200:
 *         description: Notification marked as read successfully.
 *       403:
 *         description: Forbidden (Access denied to this notification).
 *       404:
 *         description: Notification not found.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = req.headers.get("x-user-id")
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    const notif = await markNotificationAsRead((await params).id, userId)
    return NextResponse.json(notif, { status: 200 })
  } catch (error: any) {
    let status = 500
    if (error.message?.includes("Forbidden")) status = 403
    if (error.message?.includes("not found")) status = 404
    return NextResponse.json({ error: error.message ?? "Failed to mark notification as read." }, { status })
  }
}
