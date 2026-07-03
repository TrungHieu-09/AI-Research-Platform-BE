import { NextRequest, NextResponse } from "next/server"
import { initiatePayment } from "@/lib/services/payment-service"
import { z } from "zod"

/**
 * @swagger
 * /api/payments/checkout:
 *   post:
 *     summary: Initiate Order Checkout
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               planId: { type: string }
 *     responses:
 *       201:
 *         description: Payment intent initiated
 */
const CheckoutSchema = z.object({
  planId: z.enum(["PREMIUM_MONTHLY", "PREMIUM_YEARLY"]),
})

// POST /api/payments/checkout
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")!
    const body = await req.json()
    const parsed = CheckoutSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const result = await initiatePayment(userId, parsed.data.planId)
    return NextResponse.json(result, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
