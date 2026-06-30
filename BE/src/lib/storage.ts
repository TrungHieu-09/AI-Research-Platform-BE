/**
 * Cloud Storage wrapper — supports AWS S3 or GCS (switchable via STORAGE_PROVIDER env)
 *
 * For the MVP, this module generates presigned upload URLs so the client can
 * upload files directly to the bucket without routing them through the API server.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface PresignedUploadResult {
  uploadUrl: string   // PUT this URL from the client
  fileUrl: string     // Public/CDN URL once the upload completes
  key: string         // Storage object key (for reference)
}

// ──────────────────────────────────────────────────────────────────────────────
// S3 implementation (using fetch-friendly REST pre-signed URLs via AWS SDK v3)
// ──────────────────────────────────────────────────────────────────────────────

async function getS3PresignedUrl(
  key: string,
  mimeType: string,
  expiresInSeconds = 300,
): Promise<PresignedUploadResult> {
  // Dynamic import so we only load the AWS SDK when STORAGE_PROVIDER === "s3"
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3")
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner")

  const client = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME!,
    Key: key,
    ContentType: mimeType,
  })

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds })
  const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`

  return { uploadUrl, fileUrl, key }
}

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Generate a presigned upload URL for a document.
 *
 * @param userId   - Owner's user ID (used to namespace the storage key)
 * @param filename - Original filename from the client
 * @param mimeType - MIME type of the file (e.g. "application/pdf")
 */
export async function getPresignedUploadUrl(
  userId: string,
  filename: string,
  mimeType: string,
): Promise<PresignedUploadResult> {
  const timestamp = Date.now()
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_")
  const key = `documents/${userId}/${timestamp}_${safeFilename}`

  const provider = process.env.STORAGE_PROVIDER ?? "s3"

  if (provider === "local" || !process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID.startsWith("AKIA...")) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:4000"
    return {
      uploadUrl: `${appUrl}/api/documents/mock-upload?key=${key}`,
      fileUrl: `${appUrl}/uploads/${key}`,
      key
    }
  }

  if (provider === "s3") {
    return getS3PresignedUrl(key, mimeType)
  }

  throw new Error(`Unsupported storage provider: ${provider}`)
}

/**
 * Delete a file from the storage bucket.
 *
 * @param key - Storage object key returned from getPresignedUploadUrl
 */
export async function deleteStorageFile(key: string): Promise<void> {
  const provider = process.env.STORAGE_PROVIDER ?? "s3"

  if (provider === "s3") {
    const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3")
    const client = new S3Client({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
    await client.send(new DeleteObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME!, Key: key }))
    return
  }

  throw new Error(`Unsupported storage provider: ${provider}`)
}
