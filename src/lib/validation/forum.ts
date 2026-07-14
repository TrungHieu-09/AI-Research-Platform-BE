import { z } from "zod"

export const CreateForumPostSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(200),
  content: z.string().trim().min(1, "Content is required.").max(20000),
  subjectId: z.string().uuid("Invalid subject ID.").nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional().default([]),
  visibility: z.enum(["PRIVATE", "PUBLIC"]),
})

export const CreateForumReplySchema = z.object({
  content: z.string().trim().min(1, "Content is required.").max(10000),
})

export const SolveForumPostSchema = z.object({
  replyId: z.string().uuid("Invalid reply ID."),
})

export const ForumModerationSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    rejectionReason: z.string().trim().max(500).optional(),
  })
  .refine(
    (data) => data.decision === "APPROVED" || !!data.rejectionReason,
    { message: "A rejection reason is required when rejecting a forum post.", path: ["rejectionReason"] },
  )

export type CreateForumPostInput = z.infer<typeof CreateForumPostSchema>
export type CreateForumReplyInput = z.infer<typeof CreateForumReplySchema>
export type SolveForumPostInput = z.infer<typeof SolveForumPostSchema>
export type ForumModerationInput = z.infer<typeof ForumModerationSchema>
