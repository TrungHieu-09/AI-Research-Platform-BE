import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminId = req.headers.get("x-user-id")
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { action } = body

    if (action !== "APPROVED" && action !== "REJECTED") {
      return NextResponse.json({ error: "Invalid action. Must be APPROVED or REJECTED." }, { status: 400 })
    }

    const suggestion = await db.subjectSuggestion.findUnique({
      where: { id: params.id }
    })

    if (!suggestion) {
      return NextResponse.json({ error: "Suggestion not found" }, { status: 404 })
    }

    if (suggestion.status !== "PENDING") {
      return NextResponse.json({ error: "Suggestion is already processed" }, { status: 400 })
    }

    // Update suggestion status
    const updatedSuggestion = await db.subjectSuggestion.update({
      where: { id: params.id },
      data: { status: action }
    })

    // If approved, create the subject
    if (action === "APPROVED") {
      const code = suggestion.name.toUpperCase().replace(/\s+/g, '_').substring(0, 10)
      
      await db.subject.create({
        data: {
          name: suggestion.name,
          code: code,
          status: "ACTIVE"
        }
      })
    }

    // Audit log
    await db.auditLog.create({
      data: {
        userId: adminId,
        action: `SUGGESTION_${action}`,
        targetEntity: "subject_suggestions",
        targetId: params.id,
        ipAddress: req.headers.get("x-forwarded-for") ?? req.ip
      }
    })

    return NextResponse.json(updatedSuggestion)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
