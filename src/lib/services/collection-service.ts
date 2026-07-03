import { db } from "@/lib/db"
import type { CreateCollectionInput } from "@/lib/validation/collection"

export async function getUserCollections(userId: string) {
  return db.collection.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { documents: true } },
      documents: {
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          document: {
            select: {
              id: true,
              title: true,
              mimeType: true,
              fileSize: true,
            },
          },
        },
      },
    },
  })
}

export async function createCollection(userId: string, input: CreateCollectionInput) {
  return db.collection.create({
    data: {
      name: input.name,
      userId,
    },
    include: {
      _count: { select: { documents: true } },
    },
  })
}

export async function addDocumentToCollection(collectionId: string, userId: string, documentId: string) {
  const collection = await db.collection.findUnique({ where: { id: collectionId } })
  if (!collection) throw new Error("Collection not found.")
  if (collection.userId !== userId) throw new Error("Forbidden: Access denied to this collection.")

  const doc = await db.document.findUnique({ where: { id: documentId, deletedAt: null } })
  if (!doc) throw new Error("Document not found.")

  return db.collectionDocument.upsert({
    where: { collectionId_documentId: { collectionId, documentId } },
    create: { collectionId, documentId },
    update: {},
    include: {
      document: { select: { id: true, title: true, mimeType: true } },
    },
  })
}

export async function removeDocumentFromCollection(collectionId: string, userId: string, documentId: string) {
  const collection = await db.collection.findUnique({ where: { id: collectionId } })
  if (!collection) throw new Error("Collection not found.")
  if (collection.userId !== userId) throw new Error("Forbidden: Access denied to this collection.")

  const item = await db.collectionDocument.findUnique({
    where: { collectionId_documentId: { collectionId, documentId } },
  })

  if (!item) throw new Error("Document not found in this collection.")

  return db.collectionDocument.delete({
    where: { id: item.id },
  })
}
