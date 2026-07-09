import { z } from "zod"

export const UpdateConfigSchema = z.object({
  value: z.string().min(1, "Config value cannot be empty"),
  label: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
})

export type UpdateConfigInput = z.infer<typeof UpdateConfigSchema>
