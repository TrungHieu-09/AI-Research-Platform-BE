import { z } from "zod"

export const UploadMetadataSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters.").max(200),
  description: z.string().max(2000).optional(),
  subjectId: z.string().uuid("Invalid subject ID."),
  visibility: z.enum(["PRIVATE", "PUBLIC"]).default("PRIVATE"),
  fileUrl: z.string().url("Invalid file URL.").or(z.string().min(1)),
  fileHash: z.string().optional().default("0000000000000000000000000000000000000000000000000000000000000000"),
  fileSize: z.number().int().positive().optional().default(1024),
  mimeType: z.string().optional().default("application/pdf"),
  pageCount: z.number().int().nonnegative().optional().default(1),
})

export const ModerationDecisionSchema = z.preprocess(
  (val: any) => {
    if (val && typeof val === "object" && !val.decision && val.status) {
      return { ...val, decision: val.status }
    }
    return val
  },
  z.object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    rejectionReason: z.string().max(500).optional(),
  }).refine(
    (data) => {
      if (data.decision === "REJECTED") return !!data.rejectionReason && data.rejectionReason.length > 0
      return true
    },
    { message: "A rejection reason is required when rejecting a document.", path: ["rejectionReason"] }
  )
)

export const PresignedUrlSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  fileSize: z.number().int().positive().max(50 * 1024 * 1024, "File size cannot exceed 50 MB."),
  fileHash: z.string().optional(),
})

export type UploadMetadataInput = z.infer<typeof UploadMetadataSchema>
export type ModerationDecisionInput = z.infer<typeof ModerationDecisionSchema>
export type PresignedUrlInput = z.infer<typeof PresignedUrlSchema>
