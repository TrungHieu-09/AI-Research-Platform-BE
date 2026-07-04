import { NextRequest, NextResponse } from "next/server"
import { updateAdminConfig } from "@/lib/services/admin-service"

export async function PUT(req: NextRequest, { params }: { params: { key: string } }) {
  try {
    const role = req.headers.get("x-user-role")
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied. Admin role required." }, { status: 403 })
    }

    const body = await req.json()
    const value = typeof body?.value === "string" ? body.value : String(body?.value ?? "")

    const result = await updateAdminConfig(params.key, value)
    return NextResponse.json(result, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to update admin config." }, { status: 500 })
  }
}
