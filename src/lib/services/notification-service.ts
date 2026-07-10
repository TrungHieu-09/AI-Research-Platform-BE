import { db } from "@/lib/db"

export async function getUserNotifications(userId: string) {
  const [items, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.notification.count({
      where: { userId, read: false },
    }),
  ])

  return {
    unreadCount,
    items,
  }
}

export async function markNotificationAsRead(id: string, userId: string) {
  const notif = await db.notification.findUnique({ where: { id } })
  if (!notif) throw new Error("Notification not found.")
  if (notif.userId !== userId) throw new Error("Forbidden: Access denied to this notification.")

  return db.notification.update({
    where: { id },
    data: { read: true },
  })
}

export async function markAllNotificationsAsRead(userId: string) {
  const result = await db.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  })

  return {
    updatedCount: result.count,
  }
}
