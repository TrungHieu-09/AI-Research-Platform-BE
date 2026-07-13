import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import crypto from "crypto"

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Universal Standalone File Upload Endpoint (Plug & Play)
 *     description: >
 *       A dedicated, decoupled file upload endpoint that allows frontend developers to attach
 *       and upload files freely (e.g. inside AI Chat Box, avatar upload, temporary attachments, etc.)
 *       without forcing the file to be registered as a formal academic Document in the library.
 *       Calculates SHA-256 hash and saves the file cleanly into `/public/uploads/{purpose}`.
 *     tags:
 *       - General / Universal Upload
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
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The file to upload (PDF, DOCX, TXT, PNG, JPG, etc.).
 *               purpose:
 *                 type: string
 *                 description: Optional folder/category name to group files cleanly (e.g., "chat", "avatars", "general"). Defaults to "general".
 *                 default: "general"
 *     responses:
 *       201:
 *         description: File uploaded successfully and ready for immediate use.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 fileUrl: { type: string, example: "http://localhost:4000/uploads/chat/1720866000000-sample.pdf" }
 *                 filename: { type: string, example: "sample.pdf" }
 *                 fileSize: { type: integer, example: 1048576 }
 *                 mimeType: { type: string, example: "application/pdf" }
 *                 fileHash: { type: string, example: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649..." }
 *                 purpose: { type: string, example: "chat" }
 *       400:
 *         description: No file provided in the request payload.
 *       500:
 *         description: Internal server error during file write operations.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const purposeRaw = (formData.get("purpose") as string | null) || "general"

    // Sanitize folder name to prevent directory traversal attacks
    const purpose = purposeRaw.replace(/[^a-zA-Z0-9_-]/g, "") || "general"

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No valid file uploaded. Please attach a file under the 'file' field." }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Calculate SHA-256 hash of the uploaded binary stream
    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex")

    // Create target directory inside /public/uploads/{purpose} if it doesn't exist
    const uploadDir = path.join(process.cwd(), "public", "uploads", purpose)
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    // Generate safe, unique filename preventing overwrite conflicts
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const uniqueFilename = `${Date.now()}-${sanitizedName}`
    const targetPath = path.join(uploadDir, uniqueFilename)

    // Write file to local disk / public storage
    fs.writeFileSync(targetPath, buffer)

    // Construct accessible public URL
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
    const fileUrl = `${baseUrl}/uploads/${purpose}/${uniqueFilename}`

    return NextResponse.json(
      {
        success: true,
        fileUrl,
        filename: file.name,
        fileSize: buffer.length,
        mimeType: file.type || "application/octet-stream",
        fileHash,
        purpose,
      },
      { status: 201 }
    )
  } catch (err: any) {
    console.error("[Universal Upload Error]:", err.message)
    return NextResponse.json(
      { error: err.message ?? "An unexpected error occurred during universal file upload." },
      { status: 500 }
    )
  }
}
