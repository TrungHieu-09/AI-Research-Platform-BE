import { db } from "@/lib/db"
import type { UploadMetadataInput, ModerationDecisionInput } from "@/lib/validation/doc"
import { autoIngestDocument } from "@/lib/services/ingest-service"

// ──────────────────────────────────────────────────────────────────────────────
// Document listing
// ──────────────────────────────────────────────────────────────────────────────

export async function getUserDocuments(userId: string, page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize
  const [items, total] = await Promise.all([
    db.document.findMany({
      where: { ownerId: userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        visibility: true,
        mimeType: true,
        fileSize: true,
        fileUrl: true,
        subject: { select: { id: true, name: true, code: true } },
        collections: {
          select: {
            collection: { select: { id: true, name: true } },
          },
        },
        bookmarks: {
          where: { userId },
          select: { id: true },
        },
        tags: {
          select: { id: true, name: true },
        },
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.document.count({ where: { ownerId: userId, deletedAt: null } }),
  ])
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

export async function getPublicDocuments(
  page = 1,
  pageSize = 20,
  options?: {
    subjectId?: string
    search?: string
    sort?: "newest" | "popular" | "top_rated"
  }
) {
  const skip = (page - 1) * pageSize
  const where: any = {
    status: "APPROVED",
    visibility: "PUBLIC",
    deletedAt: null,
  }

  if (options?.subjectId) {
    where.subjectId = options.subjectId
  }

  if (options?.search) {
    where.OR = [
      { title: { contains: options.search, mode: "insensitive" } },
      { description: { contains: options.search, mode: "insensitive" } },
    ]
  }

  let orderBy: any = { createdAt: "desc" }
  if (options?.sort === "popular") {
    orderBy = { views: { _count: "desc" } }
  } else if (options?.sort === "top_rated") {
    orderBy = [{ ratings: { _count: "desc" } }, { createdAt: "desc" }]
  }

  const [items, total] = await Promise.all([
    db.document.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      select: {
        id: true,
        title: true,
        description: true,
        thumbnailUrl: true,
        fileUrl: true,
        fileSize: true,
        mimeType: true,
        pageCount: true,
        status: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
        subject: { select: { id: true, name: true, code: true } },
        owner: { select: { id: true, name: true, avatarUrl: true } },
        _count: {
          select: {
            views: true,
            ratings: true,
            bookmarks: true,
          },
        },
      },
    }),
    db.document.count({ where }),
  ])

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

export async function getDocumentById(id: string, requestingUserId: string, requestingRole: string) {
  const doc = await db.document.findFirst({
    where: { id, deletedAt: null },
    include: {
      owner: { select: { id: true, name: true, email: true, avatarUrl: true, emailVerified: true, emailVerifiedAt: true, verificationStatus: true } },
      subject: true,
      tags: { select: { id: true, name: true } },
      _count: {
        select: {
          views: true,
          ratings: true,
          bookmarks: true,
        },
      },
    },
  })

  if (!doc) throw new Error("Document not found.")

  // Private docs are only visible to the owner and admins
  if (doc.visibility === "PRIVATE" && doc.ownerId !== requestingUserId) {
    if (requestingRole !== "ADMIN") {
      throw new Error("Forbidden: This document is private.")
    }
  }

  // Record a view in background without blocking, throttled to once per 15 minutes per user to prevent duplicate views (+2 from React StrictMode or quick reloads)
  if (requestingUserId) {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)
    db.documentView.findFirst({
      where: {
        documentId: doc.id,
        userId: requestingUserId,
        viewedAt: { gte: fifteenMinutesAgo },
      },
    }).then((recentView) => {
      if (!recentView) {
        return db.documentView.create({
          data: { documentId: doc.id, userId: requestingUserId },
        })
      }
    }).catch((e) => console.error("[Record View Error]:", e.message))
  }

  return doc
}

// ──────────────────────────────────────────────────────────────────────────────
// Document creation
// ──────────────────────────────────────────────────────────────────────────────

export async function createDocument(ownerId: string, input: UploadMetadataInput) {
  // Deduplication check: check if an approved document with the exact same hash exists
  const duplicate = input.fileHash ? await db.document.findFirst({
    where: { fileHash: input.fileHash, deletedAt: null, status: "APPROVED" },
  }) : null

  // If duplicate exists, reuse its storage fileUrl so we don't store duplicate files
  const fileUrl = duplicate ? duplicate.fileUrl : input.fileUrl

  const doc = await db.document.create({
    data: {
      ...input,
      fileUrl,
      ownerId,
      status: input.visibility === "PUBLIC" ? "PENDING" : "APPROVED",
    },
  })

  // Auto-trigger vector ingestion in the background if document is immediately approved (PRIVATE docs)
  if (doc.status === "APPROVED") {
    autoIngestDocument(doc.id, doc.fileUrl).catch((err) => {
      console.error(`[AutoIngest Error] Failed background ingestion for private doc ${doc.id}:`, err.message)
    })
  }

  return doc
}

// ──────────────────────────────────────────────────────────────────────────────
// Soft delete
// ──────────────────────────────────────────────────────────────────────────────

export async function softDeleteDocument(id: string, requestingUserId: string, requestingRole: string) {
  const doc = await db.document.findFirst({ where: { id, deletedAt: null } })
  if (!doc) throw new Error("Document not found.")

  // Only the owner or admin can delete
  if (doc.ownerId !== requestingUserId && requestingRole !== "ADMIN") {
    throw new Error(`Permission denied.`)
  }

  return db.document.update({
    where: { id },
    data: { deletedAt: new Date() },
  })
}

// ──────────────────────────────────────────────────────────────────────────────
// Moderation
// ──────────────────────────────────────────────────────────────────────────────

export async function moderateDocument(
  id: string,
  adminId: string,
  input: ModerationDecisionInput,
  ipAddress?: string,
) {
  const doc = await db.document.findFirst({ where: { id, deletedAt: null } })
  if (!doc) throw new Error("Document not found.")
  if (doc.visibility !== "PUBLIC") throw new Error("Only PUBLIC documents can be moderated.")

  const isPendingDecision = doc.status === "PENDING"
  const isUnpublish = doc.status === "APPROVED" && input.decision === "REJECTED"
  const isRepublish = doc.status === "REJECTED" && input.decision === "APPROVED"

  if (!isPendingDecision && !isUnpublish && !isRepublish) {
    throw new Error("Invalid document moderation transition.")
  }

  const updated = await db.document.update({
    where: { id },
    data: {
      status: input.decision,
      rejectionReason: input.decision === "REJECTED" ? input.rejectionReason ?? null : null,
      moderatedById: adminId,
      moderatedAt: new Date(),
    },
  })

  const auditAction = isUnpublish
    ? "DOCUMENT_UNPUBLISHED"
    : isRepublish
      ? "DOCUMENT_REPUBLISHED"
      : `DOCUMENT_${input.decision}`

  await db.auditLog.create({
    data: {
      userId: adminId,
      action: auditAction,
      targetEntity: "documents",
      targetId: id,
      documentId: id,
      ipAddress: ipAddress ?? null,
    },
  })

  const notification =
    input.decision === "APPROVED"
      ? {
          title: isRepublish ? "Tài liệu đã được công khai lại" : "Tài liệu đã được phê duyệt",
          content: isRepublish
            ? `Tài liệu "${doc.title}" của bạn đã được Admin công khai lại.`
            : `Tài liệu "${doc.title}" của bạn đã được Admin kiểm duyệt và phê duyệt công khai.`,
        }
      : {
          title: isUnpublish ? "Tài liệu đã bị gỡ công khai" : "Tài liệu bị từ chối",
          content: isUnpublish
            ? `Tài liệu "${doc.title}" của bạn đã bị Admin gỡ công khai với lý do: ${input.rejectionReason}`
            : `Tài liệu "${doc.title}" của bạn đã bị từ chối với lý do: ${input.rejectionReason}`,
        }

  await db.notification.create({
    data: {
      userId: doc.ownerId,
      title: notification.title,
      content: notification.content,
    },
  })

  // Auto-trigger vector ingestion in the background when Admin approves a public document
  if (updated.status === "APPROVED") {
    autoIngestDocument(updated.id, updated.fileUrl).catch((err) => {
      console.error(`[AutoIngest Error] Failed background ingestion for approved public doc ${updated.id}:`, err.message)
    })
  }

  return updated
}

// ──────────────────────────────────────────────────────────────────────────────
// Audit log
// ──────────────────────────────────────────────────────────────────────────────

export async function getDocumentAuditLogs(documentId: string) {
  return db.auditLog.findMany({
    where: { documentId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true, role: true } } },
  })
}
