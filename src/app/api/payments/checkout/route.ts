import { NextRequest, NextResponse } from "next/server"
import { initiatePayment } from "@/lib/services/payment-service"
import { z } from "zod"

/**
 * @swagger
 * /api/payments/checkout:
 *   post:
 *     summary: Initiate Subscription Checkout
 *     description: Creates a payment intent or bank transfer order for upgrading account tier from FREE to PREMIUM.
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
 *               - planId
 *             properties:
 *               planId:
 *                 type: string
 *                 enum: [PREMIUM_MONTHLY, PREMIUM_YEARLY]
 *                 example: "PREMIUM_MONTHLY"
 *     responses:
 *       201:
 *         description: Payment order created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 orderId: { type: string, format: uuid }
 *                 amount: { type: integer, example: 99000 }
 *                 currency: { type: string, example: "VND" }
 *                 transferContent: { type: string, example: "LUMIS_UPGRADE_USER_123" }
 *                 qrCodeUrl: { type: string, example: "https://api.vietqr.io/..." }
 *       400:
 *         description: Payment initiation failed.
 *       422:
 *         description: Validation error.
 */
const CheckoutSchema = z.object({
  planId: z.enum(["PREMIUM_MONTHLY", "PREMIUM_YEARLY"]),
})

// POST /api/payments/checkout
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

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
