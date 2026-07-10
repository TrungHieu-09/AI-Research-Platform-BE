import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { createDocument } from "@/lib/services/doc-service"
import fs from "fs"
import path from "path"
import crypto from "crypto"

/**
 * @swagger
 * /api/documents/upload:
 *   post:
 *     summary: Direct File Upload (Drag & Drop / Multipart FormData)
 *     description: >
 *       Allows frontend or Postman users to upload an actual binary file (PDF/Docx) directly
 *       via `multipart/form-data`. The backend automatically calculates SHA-256 hash, saves the file
 *       to `/public/uploads/documents`, creates the database record, and immediately triggers AI Vector Ingestion.
 *     tags:
 *       - Documents
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - subjectId
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The PDF or document file to upload.
 *               title:
 *                 type: string
 *                 description: Document title (optional, defaults to original filename).
 *               description:
 *                 type: string
 *                 description: Optional summary or notes.
 *               subjectId:
 *                 type: string
 *                 format: uuid
 *                 description: Subject UUID (e.g. CS101 subject ID).
 *               visibility:
 *                 type: string
 *                 enum: [PRIVATE, PUBLIC]
 *                 default: PRIVATE
 *     responses:
 *       201:
 *         description: File uploaded, record created, and vector ingestion triggered.
 *       400:
 *         description: Missing file or invalid subjectId.
 *       500:
 *         description: Internal server error during file processing.
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
      return NextResponse.json({ error: "Missing required field: file (must be a PDF or document file)." }, { status: 400 })
    }

    const subjectId = formData.get("subjectId")?.toString()
    if (!subjectId) {
      return NextResponse.json({ error: "Missing required field: subjectId (UUID of the subject)." }, { status: 400 })
    }

    // Read binary buffer from uploaded file
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (buffer.length === 0) {
      return NextResponse.json({ error: "Uploaded file is empty (0 bytes)." }, { status: 400 })
    }

    if (buffer.length > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 50MB limit." }, { status: 400 })
    }

    // Calculate exact SHA-256 hash
    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex")

    // Ensure uploads folder exists in /public
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "documents")
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }

    // Save actual binary file to disk
    const timestamp = Date.now()
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const filename = `${timestamp}_${safeFilename}`
    const filePath = path.join(uploadsDir, filename)

    fs.writeFileSync(filePath, buffer)

    // Build public URL accessible via dev server
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:4000"
    const fileUrl = `${appUrl}/uploads/documents/${filename}`

    const title = formData.get("title")?.toString() || file.name.replace(/\.[^/.]+$/, "")
    const description = formData.get("description")?.toString()
    const visibility = (formData.get("visibility")?.toString()?.toUpperCase() === "PUBLIC" ? "PUBLIC" : "PRIVATE") as "PRIVATE" | "PUBLIC"

    // Create document metadata in DB (autoIngestDocument will automatically run in background!)
    const doc = await createDocument(userId, {
      title,
      description,
      subjectId,
      visibility,
      fileUrl,
      fileHash,
      fileSize: buffer.length,
      mimeType: file.type || "application/pdf",
      pageCount: 1,
    })

    return NextResponse.json({
      message: "File uploaded successfully and AI vector ingestion initiated.",
      fileUrl,
      document: doc,
    }, { status: 201 })
  } catch (err: any) {
    console.error("[Upload Error]:", err)
    return NextResponse.json({ error: err.message ?? "Failed to upload file." }, { status: 500 })
  }
}
