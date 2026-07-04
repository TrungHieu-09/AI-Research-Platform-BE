import { NextRequest, NextResponse } from "next/server"
import { getAdminConfigs } from "@/lib/services/admin-service"

export async function GET(req: NextRequest) {
  try {
    const role = req.headers.get("x-user-role")
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied. Admin role required." }, { status: 403 })
    }

    const result = await getAdminConfigs()
    return NextResponse.json(result, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to fetch admin configs." }, { status: 500 })
  }
}
