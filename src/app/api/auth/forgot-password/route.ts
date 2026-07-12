import { NextRequest, NextResponse } from "next/server"
import { ForgotPasswordSchema } from "@/lib/validation/auth"
import { forgotPassword } from "@/lib/services/auth-service"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = ForgotPasswordSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const result = await forgotPassword(parsed.data)
    return NextResponse.json(result, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to request password reset." }, { status: 400 })
  }
}
