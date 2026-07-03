import { NextRequest, NextResponse } from "next/server"
import { VerifyOtpSchema } from "@/lib/validation/auth"
import { verifyOtp } from "@/lib/services/auth-service"

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify OTP and Activate Account
 *     description: Verify the 6-digit OTP code sent to user email to activate their account and receive a JWT token.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otpCode
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "student@fpt.edu.vn"
 *               otpCode:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OTP Verified Successfully, account activated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     name: { type: string, example: "Nguyen Van A" }
 *                     email: { type: string, example: "student@fpt.edu.vn" }
 *                     role: { type: string, enum: [STUDENT, ADMIN], example: "STUDENT" }
 *                     tier: { type: string, enum: [FREE, PREMIUM], example: "FREE" }
 *       400:
 *         description: Verification failed (Invalid OTP, expired, or max attempts reached).
 *         content:
 *           application/json:
 *             example:
 *               error: "Invalid OTP code."
 *       422:
 *         description: Validation error.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = VerifyOtpSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const result = await verifyOtp(parsed.data)
    return NextResponse.json(result, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "OTP verification failed." }, { status: 400 })
  }
}
