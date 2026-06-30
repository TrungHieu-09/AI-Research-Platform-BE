import { db } from "@/lib/db"
import type { UploadMetadataInput, ModerationDecisionInput } from "@/lib/validation/doc"

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
        subject: { select: { id: true, name: true, code: true } },
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.document.count({ where: { ownerId: userId, deletedAt: null } }),
  ])
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

export async function getDocumentById(id: string, requestingUserId: string, requestingRole: string) {
  const doc = await db.document.findUnique({
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
  const duplicate = await db.document.findFirst({
    where: { fileHash: input.fileHash, deletedAt: null, status: "APPROVED" },
  })

  // If duplicate exists, reuse its storage fileUrl so we don't store duplicate files
  const fileUrl = duplicate ? duplicate.fileUrl : input.fileUrl

  return db.document.create({
    data: {
      ...input,
      fileUrl,
      ownerId,
      status: input.visibility === "PUBLIC" ? "PENDING" : "APPROVED",
    },
  })
}

// ──────────────────────────────────────────────────────────────────────────────
// Soft delete
// ──────────────────────────────────────────────────────────────────────────────

export async function softDeleteDocument(id: string, requestingUserId: string, requestingRole: string) {
  const doc = await db.document.findUnique({ where: { id, deletedAt: null } })
  if (!doc) throw new Error("Document not found.")

  // Only the owner or admin can delete
  if (doc.ownerId !== requestingUserId && requestingRole !== "ADMIN") {
    throw new Error("Permission denied.")
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
  const doc = await db.document.findUnique({ where: { id, deletedAt: null } })
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
