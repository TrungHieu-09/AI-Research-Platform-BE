import { NextRequest, NextResponse } from "next/server"
import { LoginSchema } from "@/lib/validation/auth"
import { loginUser } from "@/lib/services/auth-service"

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User Login
 *     description: Authenticate a user with email and password and return a JWT access token.
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
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "student@fpt.edu.vn"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Login successful
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
 *       401:
 *         description: Unauthorized - Invalid credentials or account suspended.
 *         content:
 *           application/json:
 *             example:
 *               error: "Invalid email or password."
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
    const parsed = LoginSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const result = await loginUser(parsed.data)
    return NextResponse.json(result, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Login failed." }, { status: 401 })
  }
}
