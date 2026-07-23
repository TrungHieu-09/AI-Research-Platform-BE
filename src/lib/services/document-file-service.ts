import { db } from "@/lib/db"
import { downloadDocumentFileFromStorage } from "@/lib/storage"
import type { RequestUser } from "@/lib/request-auth"

export function canAccessDocumentFile(
  doc: { ownerId: string; visibility: string; status: string; deletedAt: Date | null },
  user: RequestUser | null,
) {
  if (doc.deletedAt) return false
  if (doc.visibility === "PUBLIC" && doc.status === "APPROVED") return true
  if (!user) return false
  if (user.role === "ADMIN") return true
  return doc.ownerId === user.id
}

export async function getDocumentFileForStreaming(documentId: string, user: RequestUser | null) {
  const doc = await db.document.findFirst({
    where: { id: documentId, deletedAt: null },
    select: {
      id: true,
      title: true,
      ownerId: true,
      visibility: true,
      status: true,
      deletedAt: true,
      fileUrl: true,
      mimeType: true,
    },
  })

  if (!doc) throw new Error("Document not found.")
  if (!canAccessDocumentFile(doc, user)) throw new Error("Forbidden: Access denied to this document file.")

  const buffer = await downloadDocumentFileFromStorage(doc.fileUrl)
  return { doc, buffer }
}

export function buildDownloadFilename(title: string, mimeType: string) {
  const safeTitle = title.replace(/[^a-zA-Z0-9._-]/g, "_") || "document"
  if (mimeType.includes("pdf")) return `${safeTitle}.pdf`
  if (mimeType.includes("word")) return `${safeTitle}.docx`
  if (mimeType.includes("text")) return `${safeTitle}.txt`
  return safeTitle
}