import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { createDocument } from "@/lib/services/doc-service"
import { uploadDocumentFileToStorage } from "@/lib/storage"
import { checkPublicDocumentContentDuplicate } from "@/lib/services/document-duplicate-service"
import crypto from "crypto"

/**
 * @swagger
 * /api/documents/upload:
 *   post:
 *     summary: Direct File Upload to Shared Storage
 *     description: >
 *       Uploads a PDF/TXT/DOCX file using multipart/form-data. PUBLIC uploads are
 *       rejected immediately only when matching an already APPROVED PUBLIC document.
 *       Duplicates against still-PENDING requests are resolved by Admin approval order.
 *       Files are saved to Supabase Storage and fileUrl points to shared storage.
 *     tags:
 *       - Documents
 *     security:
 *       - BearerAuth: []
 */
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized. Missing user ID header." }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "Missing required field: file (must be a PDF, TXT, or DOCX file)." }, { status: 400 })
    }

    const subjectId = formData.get("subjectId")?.toString()
    if (!subjectId) {
      return NextResponse.json({ error: "Missing required field: subjectId (UUID of the subject)." }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (buffer.length === 0) {
      return NextResponse.json({ error: "Uploaded file is empty (0 bytes)." }, { status: 400 })
    }

    if (buffer.length > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 50MB limit." }, { status: 400 })
    }

    const title = formData.get("title")?.toString() || file.name.replace(/\.[^/.]+$/, "")
    const description = formData.get("description")?.toString()
    const visibility = (formData.get("visibility")?.toString()?.toUpperCase() === "PUBLIC" ? "PUBLIC" : "PRIVATE") as "PRIVATE" | "PUBLIC"
    const mimeType = file.type || (file.name.toLowerCase().endsWith(".txt") ? "text/plain" : "application/pdf")
    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex")

    if (visibility === "PUBLIC") {
      const approvedExactDuplicate = await db.document.findFirst({
        where: {
          fileHash,
          visibility: "PUBLIC",
          status: "APPROVED",
          deletedAt: null,
        },
        select: { id: true, title: true },
      })

      if (approvedExactDuplicate) {
        return NextResponse.json(
          {
            error: `Tài liệu bị trùng với "${approvedExactDuplicate.title}".`,
            duplicate: {
              documentId: approvedExactDuplicate.id,
              title: approvedExactDuplicate.title,
              similarity: 1,
            },
          },
          { status: 409 },
        )
      }

      const duplicate = await checkPublicDocumentContentDuplicate(buffer, file.name || mimeType, 0.8)
      if (duplicate) {
        return NextResponse.json(
          {
            error: `Tài liệu bị trùng với "${duplicate.title}".`,
            duplicate,
          },
          { status: 409 },
        )
      }
    }

    const storedFile = await uploadDocumentFileToStorage(userId, file.name, mimeType, buffer)
    const doc = await createDocument(userId, {
      title,
      description,
      subjectId,
      visibility,
      fileUrl: storedFile.fileUrl,
      fileHash,
      fileSize: buffer.length,
      mimeType,
      pageCount: 1,
    })

    return NextResponse.json(
      {
        message: "File uploaded successfully.",
        fileUrl: storedFile.fileUrl,
        previewUrl: `/api/documents/${doc.id}/preview`,
        downloadUrl: `/api/documents/${doc.id}/download`,
        document: doc,
      },
      { status: 201 },
    )
  } catch (err: any) {
    console.error("[Upload Error]:", err)
    const message = err.message ?? "Failed to upload file."
    const status = message.includes("duplicate") || message.includes("similar") ? 409 : message.includes("Storage") || message.includes("storage") ? 502 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
