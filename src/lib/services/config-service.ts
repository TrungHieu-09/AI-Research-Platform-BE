import { db } from "@/lib/db"
import type { UpdateConfigInput } from "@/lib/validation/config"

const DEFAULT_CONFIGS = [
  {
    key: "free_ai_limit_per_day",
    value: "10",
    label: "Free AI Daily Limit",
    description: "Maximum number of RAG chat queries allowed per day for FREE tier users.",
  },
  {
    key: "premium_ai_limit_per_day",
    value: "50",
    label: "Premium AI Daily Limit",
    description: "Maximum number of RAG chat queries allowed per day for PREMIUM tier users.",
  },
  {
    key: "doc_retention_days",
    value: "30",
    label: "Trash Retention Period (Days)",
    description: "Number of days soft-deleted documents can be restored before permanent deletion.",
  },
  {
    key: "max_file_size_mb",
    value: "50",
    label: "Max Upload File Size (MB)",
    description: "Maximum allowed file size in megabytes for document uploads.",
  },
]

export async function getSystemConfigs() {
  const count = await db.systemConfig.count()
  if (count === 0) {
    await db.systemConfig.createMany({
      data: DEFAULT_CONFIGS,
      skipDuplicates: true,
    })
  }

  return db.systemConfig.findMany({
    orderBy: { key: "asc" },
  })
}

export async function updateSystemConfig(key: string, adminId: string, input: UpdateConfigInput, ipAddress?: string) {
  const updated = await db.systemConfig.upsert({
    where: { key },
    create: {
      key,
      value: input.value,
      label: input.label ?? key,
      description: input.description ?? null,
      updatedById: adminId,
    },
    update: {
      value: input.value,
      ...(input.label !== undefined && { label: input.label }),
      ...(input.description !== undefined && { description: input.description }),
      updatedById: adminId,
    },
  })

  await db.auditLog.create({
    data: {
      userId: adminId,
      action: "UPDATE_SYSTEM_CONFIG",
      targetEntity: "system_configs",
      targetId: updated.id,
      ipAddress: ipAddress ?? null,
    },
  })

  return updated
}
