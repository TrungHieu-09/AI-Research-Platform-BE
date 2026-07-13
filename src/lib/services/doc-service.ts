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
      owner: { select: { id: true, name: true, email: true } },
      subject: true,
    },
  })

  if (!doc) throw new Error("Document not found.")

  // Private docs are only visible to the owner and admins
  if (doc.visibility === "PRIVATE" && doc.ownerId !== requestingUserId) {
    if (requestingRole !== "ADMIN") {
      throw new Error("Forbidden: This document is private.")
    }
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
  if (doc.status !== "PENDING") throw new Error("Only PENDING documents can be moderated.")

  const updated = await db.document.update({
    where: { id },
    data: {
      status: input.decision,
      rejectionReason: input.rejectionReason ?? null,
      moderatedById: adminId,
      moderatedAt: new Date(),
    },
  })

  await db.auditLog.create({
    data: {
      userId: adminId,
      action: `DOCUMENT_${input.decision}`,
      targetEntity: "documents",
      targetId: id,
      documentId: id,
      ipAddress: ipAddress ?? null,
    },
  })

  // Tự động tạo thông báo (Notification) cho chủ sở hữu tài liệu kèm lý do từ chối nếu có
  await db.notification.create({
    data: {
      userId: doc.ownerId,
      title: input.decision === "APPROVED" ? "Tài liệu đã được phê duyệt" : "Tài liệu bị từ chối",
      content:
        input.decision === "APPROVED"
          ? `Tài liệu "${doc.title}" của bạn đã được Admin kiểm duyệt và phê duyệt công khai.`
          : `Tài liệu "${doc.title}" của bạn đã bị từ chối với lý do: ${input.rejectionReason}`,
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
