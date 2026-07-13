import { NextRequest, NextResponse } from "next/server"
import { confirmPaymentOrder } from "@/lib/services/payment-service"
import { z } from "zod"

/**
 * @swagger
 * /api/payments/confirm:
 *   post:
 *     summary: Confirm & Simulate Payment Completion (Sandbox)
 *     description: Verifies payment order and instantly activates PREMIUM account tier. Ideal for student prototype verification.
 *     tags:
 *       - Payments
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *             properties:
 *               orderId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Payment confirmed and account upgraded to PREMIUM.
 *       400:
 *         description: Invalid order or confirmation failed.
 *       401:
 *         description: Authentication required.
 */
const ConfirmSchema = z.object({
  orderId: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    const body = await req.json()
    const parsed = ConfirmSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const result = await confirmPaymentOrder(userId, parsed.data.orderId)
    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed to confirm payment." }, { status: 400 })
  }
}
