import { NextRequest, NextResponse } from "next/server"
import { getAdminDocumentStats } from "@/lib/services/admin-service"

export async function GET(req: NextRequest) {
  try {
    const role = req.headers.get("x-user-role")
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied. Admin role required." }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const from = searchParams.get("from") ?? undefined
    const to = searchParams.get("to") ?? undefined
    const subjectId = searchParams.get("subjectId") ?? undefined

    const result = await getAdminDocumentStats(from, to, subjectId)
    return NextResponse.json(result, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to fetch document stats." }, { status: 500 })
  }
}
