import { NextRequest, NextResponse } from "next/server"
import { requireBearerUser } from "@/lib/request-auth"
import { ProfileEmailVerificationOtpSchema } from "@/lib/validation/auth"
import { verifyProfileEmailOtp } from "@/lib/services/user-service"

/**
 * @swagger
 * /api/users/me/email-verification/verify-otp:
 *   post:
 *     summary: Verify Profile Biometric OTP
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otpCode]
 *             properties:
 *               otpCode: { type: string, example: "123456" }
 *     responses:
 *       200:
 *         description: Sinh trắc học đã xác thực thành công.
 *       400:
 *         description: Invalid or expired OTP.
 *       401:
 *         description: Authentication required.
 *       422:
 *         description: Validation error.
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await requireBearerUser(req)
    const body = await req.json()
    const parsed = ProfileEmailVerificationOtpSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const result = await verifyProfileEmailOtp(authUser.id, parsed.data)
    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    const status =
      error.message === "Authentication required."
        ? 401
        : error.message === "User not found."
          ? 404
          : 400
    return NextResponse.json({ error: error.message ?? "Failed to verify email OTP." }, { status })
  }
}