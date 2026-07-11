import { NextRequest, NextResponse } from "next/server"
import { verifyResetOtp } from "@/lib/services/auth-service"

export async function POST(req: NextRequest) {
  try {
    const { email, otpCode } = await req.json()
    if (!email || !otpCode) {
      return NextResponse.json({ error: "Email và mã OTP là bắt buộc." }, { status: 422 })
    }
    const result = await verifyResetOtp(email, otpCode)
    return NextResponse.json(result, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Mã OTP không hợp lệ." }, { status: 400 })
  }
}
