import { NextRequest, NextResponse } from "next/server"
import { getOptionalBearerUser } from "@/lib/request-auth"
import { buildDownloadFilename, getDocumentFileForStreaming } from "@/lib/services/document-file-service"

/**
 * @swagger
 * /api/documents/{id}/download:
 *   get:
 *     summary: Download Document File
 *     description: Download a document file from shared storage. APPROVED PUBLIC documents are public; private/non-approved documents require owner or Admin token.
 *     tags:
 *       - Documents
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const user = await getOptionalBearerUser(req)
    const resolvedParams = await params
    const { doc, buffer } = await getDocumentFileForStreaming(resolvedParams.id, user)
    const filename = buildDownloadFilename(doc.title, doc.mimeType || "application/octet-stream")

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": doc.mimeType || "application/octet-stream",
        "Content-Length": String(buffer.length),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": doc.visibility === "PUBLIC" && doc.status === "APPROVED" ? "public, max-age=300" : "private, no-store",
      },
    })
  } catch (error: any) {
    const status =
      error.message === "Document not found."
        ? 404
        : error.message === "File not found in storage"
          ? 404
          : error.message.startsWith("Forbidden")
            ? 403
            : 500
    return NextResponse.json({ error: error.message ?? "Failed to download document." }, { status })
  }
}