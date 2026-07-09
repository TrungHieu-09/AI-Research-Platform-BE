import { NextRequest, NextResponse } from "next/server"
import { updateSystemConfig } from "@/lib/services/config-service"
import { UpdateConfigSchema } from "@/lib/validation/config"

/**
 * @swagger
 * /api/admin/configs/{key}:
 *   put:
 *     summary: Update System Configuration (Admin only)
 *     description: Update or create a dynamic system configuration setting without redeploying the backend. Automatically records an audit log.
 *     tags:
 *       - Admin Settings
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         example: "free_ai_limit_per_day"
 *         description: Unique setting key.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - value
 *             properties:
 *               value: { type: string, example: "15" }
 *               label: { type: string, example: "Free AI Daily Limit" }
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: System configuration updated successfully.
 *       403:
 *         description: Access denied (Admin role required).
 *       422:
 *         description: Validation error.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params
    const role = req.headers.get("x-user-role")
    const adminId = req.headers.get("x-user-id")
    if (role !== "ADMIN" || !adminId) {
      return NextResponse.json({ error: "Access denied. Admin role required." }, { status: 403 })
    }

    const body = await req.json()
    const parsed = UpdateConfigSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const updated = await updateSystemConfig(key, adminId, parsed.data, req.headers.get("x-forwarded-for") ?? (req as any).ip)
    return NextResponse.json(updated, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed to update system configuration." }, { status: 400 })
  }
}
