import { db } from "@/lib/db"

export async function getAdminConfigs() {
  // TODO: replace with real SystemConfig persistence when the model is available in the deployed schema.
  return {
    configs: [],
    message: "System config management is not wired to the database yet.",
  }
}

export async function updateAdminConfig(key: string, value: string) {
  // TODO: replace with real SystemConfig persistence when the model is available in the deployed schema.
  return {
    key,
    value,
    message: "System config update is not wired to the database yet.",
  }
}

export async function getAdminStats() {
  const [totalUsers, totalDocuments, pendingModeration, totalViews, aiUsageToday, newUsersThisWeek] = await Promise.all([
    db.user.count(),
    db.document.count({ where: { deletedAt: null } }),
    db.document.count({ where: { status: "PENDING", deletedAt: null } }),
    db.documentView.count(),
    db.aiUsageLog.count({ where: { usedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    db.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
  ])

  return {
    totalUsers,
    totalDocuments,
    pendingModeration,
    totalViews,
    aiUsageToday,
    topDocuments: [],
    newUsersThisWeek,
  }
}

export async function getAdminDocumentStats(from?: string, to?: string, subjectId?: string) {
  // TODO: replace with real document_views analytics when the model is available and populated.
  const where: any = {}

  if (subjectId) {
    where.subjectId = subjectId
  }

  const documents = await db.document.findMany({
    where: {
      ...where,
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      subjectId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  })

  return {
    documents,
    from: from ?? null,
    to: to ?? null,
    subjectId: subjectId ?? null,
    message: "Document analytics are currently based on document metadata until document_views is populated.",
  }
}
