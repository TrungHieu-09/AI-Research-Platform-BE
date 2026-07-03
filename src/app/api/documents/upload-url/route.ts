import { NextRequest, NextResponse } from "next/server"
import { PresignedUrlSchema } from "@/lib/validation/doc"
import { getPresignedUploadUrl } from "@/lib/storage"
import { db } from "@/lib/db"

/**
 * @swagger
 * /api/documents/upload-url:
 *   post:
 *     summary: Get Presigned Upload URL or Check Deduplication
 *     tags: [Documents]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               filename: { type: string }
 *               mimeType: { type: string }
 *               fileSize: { type: integer }
 *               fileHash: { type: string }
 *     responses:
 *       200:
 *         description: Presigned URL generated or duplicate found
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
