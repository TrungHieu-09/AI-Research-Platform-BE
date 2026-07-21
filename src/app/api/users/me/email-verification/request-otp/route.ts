import { NextRequest, NextResponse } from "next/server"
import { requireBearerUser } from "@/lib/request-auth"
import { requestProfileEmailVerificationOtp } from "@/lib/services/user-service"

/**
 * @swagger
 * /api/users/me/email-verification/request-otp:
 *   post:
 *     summary: Request Profile Biometric Verification OTP
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: OTP sent or sinh trắc học đã xác thực.
 *       401:
 *         description: Authentication required.
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await requireBearerUser(req)
    const result = await requestProfileEmailVerificationOtp(authUser.id)
    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    const status = error.message === "Authentication required." ? 401 : error.message === "User not found." ? 404 : 500
    return NextResponse.json({ error: error.message ?? "Failed to request verification OTP." }, { status })
  }
}