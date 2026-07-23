import { NextRequest, NextResponse } from "next/server"
import { handlePaymentWebhook } from "@/lib/services/payment-service"
import { z } from "zod"

/**
 * @swagger
 * /api/payments/webhook:
 *   post:
 *     summary: Payment Gateway Webhook Callback
 *     description: >
 *       Callback endpoint used by banking gateway or payment provider when a bank transfer completes.
 *       SUCCESS or COMPLETED transactions can activate Premium when transferContent is valid and
 *       the amount is sufficient. FAILED, CANCELLED, and PENDING transactions do not activate Premium.
 *       When PAYMENT_WEBHOOK_SECRET is configured, requests must include the x-api-key header.
 *     tags:
 *       - Payments
 *     parameters:
 *       - in: header
 *         name: x-api-key
 *         required: false
 *         description: Optional in local development; required when PAYMENT_WEBHOOK_SECRET is configured.
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transferContent
 *               - amount
 *             properties:
 *               transferContent:
 *                 type: string
 *                 example: "LUMIS_UPGRADE_USER_550e8400"
 *               amount:
 *                 type: number
 *                 example: 99000
 *               status:
 *                 type: string
 *                 enum: [SUCCESS, COMPLETED, FAILED, CANCELLED, PENDING]
 *                 description: Optional payment provider status.
 *                 example: "SUCCESS"
 *     responses:
 *       200:
 *         description: Webhook received. Premium is activated only for valid successful payments with sufficient amount.
 *       401:
 *         description: Invalid payment webhook API key.
 *       400:
 *         description: Invalid transaction signature or mismatch.
 *       422:
 *         description: Validation error.
 */
const WebhookSchema = z.object({
  transferContent: z.string().min(1),
  amount: z.number().positive(),
  status: z.string().optional(),
})

// POST /api/payments/webhook — Bank/payment gateway callback
// In production, validate a webhook signature/secret from the payment provider first.
export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET
    if (webhookSecret && req.headers.get("x-api-key") !== webhookSecret) {
      return NextResponse.json({ error: "Invalid payment webhook API key." }, { status: 401 })
    }

    const body = await req.json()
    const parsed = WebhookSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }

    const result = await handlePaymentWebhook(parsed.data.transferContent, parsed.data.amount, parsed.data.status)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
