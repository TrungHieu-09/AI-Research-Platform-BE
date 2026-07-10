import { db } from "@/lib/db"

export async function getAdminOverviewStats() {
  const now = new Date()
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [
    totalUsers,
    newUsersThisWeek,
    totalDocuments,
    pendingModeration,
    totalViews,
    aiUsageToday,
    topDocsRaw,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: oneWeekAgo } } }),
    db.document.count({ where: { deletedAt: null } }),
    db.document.count({ where: { status: "PENDING", deletedAt: null } }),
    db.documentView.count(),
    db.auditLog.count({ where: { action: "AI_QUERY", createdAt: { gte: startOfToday } } }),
    db.document.findMany({
      where: { deletedAt: null, status: "APPROVED" },
      orderBy: {
        views: {
          _count: "desc",
        },
      },
      take: 5,
      select: {
        id: true,
        title: true,
        mimeType: true,
        _count: {
          select: { views: true, bookmarks: true },
        },
        subject: {
          select: { name: true, code: true },
        },
      },
    }),
  ])

  const topDocuments = topDocsRaw.map((doc) => ({
    id: doc.id,
    title: doc.title,
    mimeType: doc.mimeType,
    subject: doc.subject.name,
    viewsCount: doc._count.views,
    bookmarksCount: doc._count.bookmarks,
  }))

  return {
    totalUsers,
    totalDocuments,
    pendingModeration,
    totalViews,
    aiUsageToday,
    topDocuments,
    newUsersThisWeek,
  }
}

export async function getDocumentAnalytics(fromStr?: string | null, toStr?: string | null, subjectId?: string | null) {
  const whereClause: any = {}

  if (fromStr || toStr) {
    whereClause.viewedAt = {}
    if (fromStr) whereClause.viewedAt.gte = new Date(fromStr)
    if (toStr) whereClause.viewedAt.lte = new Date(toStr)
  }

  if (subjectId) {
    whereClause.document = { subjectId }
  }

  const views = await db.documentView.findMany({
    where: whereClause,
    orderBy: { viewedAt: "asc" },
    select: {
      viewedAt: true,
      documentId: true,
      document: {
        select: { title: true, subjectId: true },
      },
    },
  })

  // Group by date string YYYY-MM-DD
  const grouped: Record<string, number> = {}
  for (const view of views) {
    const dateKey = view.viewedAt.toISOString().split("T")[0]
    grouped[dateKey] = (grouped[dateKey] ?? 0) + 1
  }

  const timeline = Object.entries(grouped).map(([date, count]) => ({
    date,
    count,
  }))

  return {
    totalViewsFiltered: views.length,
    timeline,
  }
}
