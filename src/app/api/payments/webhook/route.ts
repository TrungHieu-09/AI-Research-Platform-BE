import { NextRequest, NextResponse } from "next/server"
import { handlePaymentWebhook } from "@/lib/services/payment-service"
import { z } from "zod"

/**
 * @swagger
 * /api/payments/webhook:
 *   post:
 *     summary: Payment Callback Webhook
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook received and processed
 */
const WebhookSchema = z.object({
  transferContent: z.string().min(1),
  amount: z.number().positive(),
})

// POST /api/payments/webhook — Bank/payment gateway callback
// In production, validate a webhook signature/secret from the payment provider first.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = WebhookSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const result = await handlePaymentWebhook(parsed.data.transferContent, parsed.data.amount)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
