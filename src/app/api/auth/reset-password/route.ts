import { NextRequest, NextResponse } from "next/server"
import { ResetPasswordSchema } from "@/lib/validation/auth"
import { resetPassword } from "@/lib/services/auth-service"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = ResetPasswordSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const result = await resetPassword(parsed.data)
    return NextResponse.json(result, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to reset password." }, { status: 400 })
  }
}
