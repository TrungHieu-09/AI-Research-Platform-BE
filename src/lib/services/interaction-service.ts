import { db } from "@/lib/db"
import type { CreateRatingInput, UpdateRatingInput, ShareDocumentInput } from "@/lib/validation/interaction"

// ──────────────────────────────────────────────────────────────────────────────
// Document Ratings
// ──────────────────────────────────────────────────────────────────────────────

export async function getDocumentRatings(documentId: string) {
  const ratings = await db.documentRating.findMany({
    where: { documentId },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true, role: true } },
    },
  })

  const total = ratings.length
  const sum = ratings.reduce((acc, curr) => acc + curr.rating, 0)
  const average = total > 0 ? Number((sum / total).toFixed(1)) : 0

  return { average, total, items: ratings }
}

export async function createDocumentRating(documentId: string, userId: string, input: CreateRatingInput) {
  const doc = await db.document.findUnique({ where: { id: documentId, deletedAt: null } })
  if (!doc) throw new Error("Document not found.")

  const existing = await db.documentRating.findUnique({
    where: { documentId_userId: { documentId, userId } },
  })

  if (existing) {
    throw new Error("You have already rated this document. Use PUT to update your rating.")
  }

  return db.documentRating.create({
    data: {
      documentId,
      userId,
      rating: input.rating,
      comment: input.comment ?? null,
    },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
  })
}

export async function updateDocumentRating(documentId: string, userId: string, input: UpdateRatingInput) {
  const existing = await db.documentRating.findUnique({
    where: { documentId_userId: { documentId, userId } },
  })

  if (!existing) {
    throw new Error("Rating not found. Please submit a rating first using POST.")
  }

  return db.documentRating.update({
    where: { id: existing.id },
    data: {
      ...(input.rating !== undefined && { rating: input.rating }),
      ...(input.comment !== undefined && { comment: input.comment }),
    },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
  })
}

// ──────────────────────────────────────────────────────────────────────────────
// Bookmarks
// ──────────────────────────────────────────────────────────────────────────────

export async function getUserBookmarks(userId: string) {
  return db.bookmark.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      document: {
        select: {
          id: true,
          title: true,
          description: true,
          mimeType: true,
          fileSize: true,
          pageCount: true,
          subject: { select: { id: true, name: true, code: true } },
          owner: { select: { id: true, name: true } },
          createdAt: true,
        },
      },
    },
  })
}

export async function addBookmark(documentId: string, userId: string) {
  const doc = await db.document.findUnique({ where: { id: documentId, deletedAt: null } })
  if (!doc) throw new Error("Document not found.")

  return db.bookmark.upsert({
    where: { userId_documentId: { userId, documentId } },
    create: { userId, documentId },
    update: {},
  })
}

export async function removeBookmark(documentId: string, userId: string) {
  const bookmark = await db.bookmark.findUnique({
    where: { userId_documentId: { userId, documentId } },
  })

  if (!bookmark) throw new Error("Bookmark not found.")

  return db.bookmark.delete({
    where: { id: bookmark.id },
  })
}

// ──────────────────────────────────────────────────────────────────────────────
// Document Sharing
// ──────────────────────────────────────────────────────────────────────────────

export async function shareDocument(documentId: string, ownerId: string, input: ShareDocumentInput) {
  const doc = await db.document.findUnique({ where: { id: documentId, deletedAt: null } })
  if (!doc) throw new Error("Document not found.")

  if (doc.ownerId !== ownerId) {
    throw new Error("Forbidden: Only the document owner can share this document.")
  }

  const targetUser = await db.user.findUnique({ where: { id: input.sharedWith } })
  if (!targetUser) throw new Error("Target user not found.")

  return db.documentShare.upsert({
    where: { documentId_sharedWith: { documentId, sharedWith: input.sharedWith } },
    create: {
      documentId,
      sharedById: ownerId,
      sharedWith: input.sharedWith,
      permission: input.permission,
    },
    update: {
      permission: input.permission,
    },
    include: {
      sharedUser: { select: { id: true, name: true, email: true } },
    },
  })
}
