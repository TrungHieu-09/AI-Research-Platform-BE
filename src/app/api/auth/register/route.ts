import { NextRequest, NextResponse } from "next/server"
import { SignupSchema } from "@/lib/validation/auth"
import { registerUser } from "@/lib/services/auth-service"

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: User Registration
 *     description: Register a new student account and trigger an OTP verification email. Account starts in UNVERIFIED status until OTP is verified. If the email already exists in UNVERIFIED status, resends OTP and updates account details.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 example: "Nguyen Van A"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "student@fpt.edu.vn"
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: "password123"
 *     responses:
 *       201:
 *         description: Registration initiated successfully. OTP verification code sent to email.
 *         content:
 *           application/json:
 *             example:
 *               message: "Registration initiated. Please verify your email with the OTP sent."
 *       400:
 *         description: Registration failed (e.g. email already exists or SMTP failure).
 *         content:
 *           application/json:
 *             example:
 *               error: "An account with this email already exists."
 *       422:
 *         description: Validation error.
 *         content:
 *           application/json:
 *             example:
 *               error:
 *                 email: ["Invalid email format"]
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = SignupSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const result = await registerUser(parsed.data)
    return NextResponse.json(result, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Registration failed." }, { status: 400 })
  }
}
