import { NextRequest, NextResponse } from "next/server"
import { GoogleAuthSchema } from "@/lib/validation/auth"
import { googleLoginUser } from "@/lib/services/auth-service"

/**
 * @swagger
 * /api/auth/google:
 *   post:
 *     summary: Google SSO Login / Signup
 *     description: Authenticate or register a student/faculty member using Google SSO (@fpt.edu.vn)
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
 *                 example: "student@fpt.edu.vn"
 *               name:
 *                 type: string
 *                 example: "Nguyen Van A"
 *               avatarUrl:
 *                 type: string
 *                 example: "https://lh3.googleusercontent.com/..."
 *     responses:
 *       200:
 *         description: Login or Registration successful
 *       401:
 *         description: Unauthorized (Suspended account)
 *       422:
 *         description: Validation error (Non FPT email)
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
