import { NextRequest, NextResponse } from "next/server"
import { PresignedUrlSchema } from "@/lib/validation/doc"
import { getPresignedUploadUrl } from "@/lib/storage"
import { db } from "@/lib/db"

/**
 * @swagger
 * /api/documents/upload-url:
 *   post:
 *     summary: Get Presigned Upload URL or Check Deduplication
 *     description: >
 *       Requests a presigned storage URL to upload a file directly from the client.
 *       If `fileHash` (SHA-256) is provided, the backend checks for existing approved documents with the same hash.
 *       If found, it performs instant deduplication (`deduplicated: true`) and returns the existing file URL, saving cloud storage and upload bandwidth.
 *     tags:
 *       - Documents
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - filename
 *               - mimeType
 *               - fileSize
 *             properties:
 *               filename:
 *                 type: string
 *                 example: "chapter1.pdf"
 *               mimeType:
 *                 type: string
 *                 example: "application/pdf"
 *               fileSize:
 *                 type: integer
 *                 description: File size in bytes (max 50MB).
 *                 example: 5242880
 *               fileHash:
 *                 type: string
 *                 description: SHA-256 hash (64 hex characters) of file contents for deduplication.
 *                 example: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 *     responses:
 *       200:
 *         description: Presigned URL generated OR duplicate detected.
 *         content:
 *           application/json:
 *             examples:
 *               new_file:
 *                 summary: New file (no duplicate found)
 *                 value:
 *                   deduplicated: false
 *                   uploadUrl: "https://storage.googleapis.com/bucket/doc.pdf?X-Goog-Algorithm=..."
 *                   fileUrl: "https://storage.googleapis.com/bucket/doc.pdf"
 *                   key: "users/123/doc.pdf"
 *               deduplicated:
 *                 summary: Duplicate file found
 *                 value:
 *                   deduplicated: true
 *                   fileUrl: "https://storage.googleapis.com/bucket/existing-doc.pdf"
 *                   message: "Duplicate file detected in platform. Reusing storage."
 *       422:
 *         description: Validation error (e.g. invalid file size or mime type).
 */
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")!
    const body = await req.json()
    const parsed = PresignedUrlSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const { filename, mimeType, fileHash } = parsed.data

    // Check Deduplication if fileHash is provided
    if (fileHash) {
      const duplicate = await db.document.findFirst({
        where: { fileHash, deletedAt: null, status: "APPROVED" }
      })
      if (duplicate) {
        return NextResponse.json({
          deduplicated: true,
          fileUrl: duplicate.fileUrl,
          message: "Duplicate file detected in platform. Reusing storage."
        })
      }
    }

    const result = await getPresignedUploadUrl(userId, filename, mimeType)
    return NextResponse.json({ deduplicated: false, ...result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
