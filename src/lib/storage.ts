import { createClient } from "@supabase/supabase-js"

/**
 * Cloud Storage wrapper. The multipart upload flow stores files in Supabase Storage
 * so document files are not tied to a single local machine.
 */

export interface PresignedUploadResult {
  uploadUrl: string
  fileUrl: string
  key: string
}

export interface StoredDocumentFile {
  fileUrl: string
  key: string
  bucket: string
}

function getSupabaseStorageConfig() {
  const databaseUrl = process.env.DATABASE_URL ?? ""
  const projectRef = databaseUrl.match(/postgres\.([a-z0-9]+):/i)?.[1] ?? databaseUrl.match(/db\.([a-z0-9]+)\.supabase\.co/i)?.[1]
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? (projectRef ? `https://${projectRef}.supabase.co` : undefined)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents"

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase Storage is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
  }

  return { supabaseUrl, serviceRoleKey, bucket }
}

function getSupabaseAdminClient() {
  const { supabaseUrl, serviceRoleKey } = getSupabaseStorageConfig()
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function buildStorageObjectUrl(supabaseUrl: string, bucket: string, key: string) {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/${bucket}/${key}`
}

export function parseSupabaseStorageUrl(fileUrl: string) {
  const match = fileUrl.match(/\/storage\/v1\/object\/(?:public\/)?([^/]+)\/(.+)$/)
  if (!match) return null

  return {
    bucket: decodeURIComponent(match[1]),
    key: decodeURIComponent(match[2]),
  }
}

export async function uploadDocumentFileToStorage(
  userId: string,
  filename: string,
  mimeType: string,
  buffer: Buffer,
): Promise<StoredDocumentFile> {
  const { supabaseUrl, bucket } = getSupabaseStorageConfig()
  const supabase = getSupabaseAdminClient()
  const timestamp = Date.now()
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_")
  const key = `documents/${userId}/${timestamp}_${safeFilename}`

  const { error } = await supabase.storage.from(bucket).upload(key, buffer, {
    contentType: mimeType || "application/octet-stream",
    upsert: false,
  })

  if (error) {
    throw new Error(`Failed to upload file to Supabase Storage: ${error.message}`)
  }

  return {
    bucket,
    key,
    fileUrl: buildStorageObjectUrl(supabaseUrl, bucket, key),
  }
}

export async function downloadDocumentFileFromStorage(fileUrl: string) {
  const parsed = parseSupabaseStorageUrl(fileUrl)
  if (!parsed) {
    const res = await fetch(fileUrl)
    if (!res.ok) throw new Error("File not found in storage")
    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase.storage.from(parsed.bucket).download(parsed.key)
  if (error || !data) {
    throw new Error("File not found in storage")
  }

  const arrayBuffer = await data.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// ──────────────────────────────────────────────────────────────────────────────
// S3 implementation kept for the older presigned-url flow.
// ──────────────────────────────────────────────────────────────────────────────

async function getS3PresignedUrl(
  key: string,
  mimeType: string,
  expiresInSeconds = 300,
): Promise<PresignedUploadResult> {
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
      key,
    }
  }

  if (provider === "s3") {
    return getS3PresignedUrl(key, mimeType)
  }

  throw new Error(`Unsupported storage provider: ${provider}`)
}

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

  if (provider === "supabase") {
    const { bucket } = getSupabaseStorageConfig()
    const supabase = getSupabaseAdminClient()
    const { error } = await supabase.storage.from(bucket).remove([key])
    if (error) throw new Error(error.message)
    return
  }

  throw new Error(`Unsupported storage provider: ${provider}`)
}