import { z } from "zod"

export const CreateCollectionSchema = z.object({
  name: z.string().min(1, "Collection name cannot be empty").max(100, "Collection name is too long"),
})

export const AddDocumentToCollectionSchema = z.object({
  documentId: z.string().uuid("Invalid document ID format"),
})

export type CreateCollectionInput = z.infer<typeof CreateCollectionSchema>
export type AddDocumentToCollectionInput = z.infer<typeof AddDocumentToCollectionSchema>
