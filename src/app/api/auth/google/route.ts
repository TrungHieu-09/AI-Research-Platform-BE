import { NextRequest, NextResponse } from "next/server"
import { GoogleAuthSchema } from "@/lib/validation/auth"
import { googleLoginUser } from "@/lib/services/auth-service"

/**
 * @swagger
 * /api/auth/google:
 *   post:
 *     summary: Google SSO Login / Signup
 *     description: Authenticate or register a student/faculty member using Google SSO. Accepts any valid email address (standard email/Gmail). If user does not exist, an account is auto-created.
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
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "student@gmail.com"
 *               name:
 *                 type: string
 *                 example: "Nguyen Van A"
 *               avatarUrl:
 *                 type: string
 *                 example: "https://lh3.googleusercontent.com/..."
 *     responses:
 *       200:
 *         description: Google authentication successful. Returns JWT token and clean user object.
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
 *                     email: { type: string, example: "student@gmail.com" }
 *                     avatarUrl: { type: string, example: "https://lh3.googleusercontent.com/..." }
 *                     role: { type: string, enum: [STUDENT, ADMIN], example: "STUDENT" }
 *                     tier: { type: string, enum: [FREE, PREMIUM], example: "FREE" }
 *       401:
 *         description: Unauthorized - Account is suspended.
 *         content:
 *           application/json:
 *             example:
 *               error: "Your account is suspended. Please contact support."
 *       422:
 *         description: Validation error - Invalid email format or missing name.
 *         content:
 *           application/json:
 *             example:
 *               error:
 *                 email: ["Must be a valid email address."]
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = GoogleAuthSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const result = await googleLoginUser(parsed.data)
    return NextResponse.json(result, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Google authentication failed." }, { status: 401 })
  }
}
