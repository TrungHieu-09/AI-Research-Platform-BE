import { z } from "zod"

export const CreateSubjectSchema = z.object({
  name: z.string().min(2, "Subject name must be at least 2 characters.").max(150),
  code: z
    .string()
    .min(2, "Subject code is required.")
    .max(20)
    .regex(/^[A-Z0-9]+$/, "Subject code must be uppercase letters and numbers only (e.g. CS301)."),
})

export const UpdateSubjectSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
})

export const SubjectSuggestionSchema = z.object({
  name: z.string().min(3, "Suggested subject name must be at least 3 characters.").max(150),
})

export const ReviewSuggestionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
})

export type CreateSubjectInput = z.infer<typeof CreateSubjectSchema>
export type UpdateSubjectInput = z.infer<typeof UpdateSubjectSchema>
export type SubjectSuggestionInput = z.infer<typeof SubjectSuggestionSchema>
export type ReviewSuggestionInput = z.infer<typeof ReviewSuggestionSchema>
