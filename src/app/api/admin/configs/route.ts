import { NextRequest, NextResponse } from "next/server"
import { getSystemConfigs } from "@/lib/services/config-service"

/**
 * @swagger
 * /api/admin/configs:
 *   get:
 *     summary: Get System Configurations (Admin only)
 *     description: Retrieve all dynamic system settings (e.g. AI quotas, retention days, upload size limits). Auto-seeds default configurations if empty.
 *     tags:
 *       - Admin Settings
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of system configurations retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string, format: uuid }
 *                   key: { type: string, example: "free_ai_limit_per_day" }
 *                   value: { type: string, example: "10" }
 *                   label: { type: string, example: "Free AI Daily Limit" }
 *                   description: { type: string }
 *                   updatedAt: { type: string, format: date-time }
 *       403:
 *         description: Access denied (Admin role required).
 */
export async function GET(req: NextRequest) {
  try {
    const role = req.headers.get("x-user-role")
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied. Admin role required." }, { status: 403 })
    }

    const configs = await getSystemConfigs()
    return NextResponse.json(configs, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed to fetch system configurations." }, { status: 500 })
  }
}
