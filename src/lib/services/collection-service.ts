import { db } from "@/lib/db"
import type { CreateCollectionInput, AddDocumentToCollectionInput } from "@/lib/validation/collection"

export async function getUserCollections(userId: string) {
  return db.collection.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      documents: {
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
      documents: {
        include: {
          document: {
            select: {
              id: true,
              title: true,
              description: true,
            },
          },
        },
      },
    },
  })
}

export async function addDocumentToCollection(collectionId: string, userId: string, input: AddDocumentToCollectionInput) {
  const collection = await db.collection.findFirst({ where: { id: collectionId, userId } })
  if (!collection) throw new Error("Collection not found.")

  const document = await db.document.findUnique({ where: { id: input.documentId, deletedAt: null } })
  if (!document) throw new Error("Document not found.")

  return db.collectionDocument.create({
    data: {
      collectionId,
      documentId: input.documentId,
    },
    include: {
      document: {
        select: {
          id: true,
          title: true,
          description: true,
          mimeType: true,
          fileSize: true,
          pageCount: true,
        },
      },
    },
  })
}

export async function removeDocumentFromCollection(collectionId: string, documentId: string, userId: string) {
  const collection = await db.collection.findFirst({ where: { id: collectionId, userId } })
  if (!collection) throw new Error("Collection not found.")

  const relation = await db.collectionDocument.findUnique({
    where: {
      collectionId_documentId: {
        collectionId,
        documentId,
      },
    },
  })

  if (!relation) throw new Error("Document not found in collection.")

  await db.collectionDocument.delete({ where: { id: relation.id } })
  return { message: "Document removed from collection." }
}
