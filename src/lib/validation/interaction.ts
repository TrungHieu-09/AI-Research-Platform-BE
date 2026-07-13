import { z } from "zod"

export const CreateRatingSchema = z.object({
  rating: z.number().int().min(1, "Rating must be at least 1").max(5, "Rating cannot exceed 5"),
  comment: z.string().max(1000, "Comment is too long").optional(),
})

export const UpdateRatingSchema = z.object({
  rating: z.number().int().min(1, "Rating must be at least 1").max(5, "Rating cannot exceed 5").optional(),
  comment: z.string().max(1000, "Comment is too long").optional(),
})

export const ShareDocumentSchema = z.object({
  sharedWith: z.string().min(1, "Recipient user ID or email is required"),
  permission: z.enum(["view", "comment", "edit"]).default("view"),
})

export type CreateRatingInput = z.infer<typeof CreateRatingSchema>
export type UpdateRatingInput = z.infer<typeof UpdateRatingSchema>
export type ShareDocumentInput = z.infer<typeof ShareDocumentSchema>
