import { NextRequest, NextResponse } from "next/server"
import { getUserReceipts } from "@/lib/services/payment-service"

/**
 * @swagger
 * /api/payments/receipts:
 *   get:
 *     summary: Get User Payment Receipts & History
 *     description: Retrieve transaction history and upgrade receipts for the currently authenticated user.
 *     tags:
 *       - Payments & Subscriptions
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Payment receipts retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string, format: uuid }
 *                   planId: { type: string, example: "PREMIUM_MONTHLY" }
 *                   amount: { type: number, example: 49000 }
 *                   transferContent: { type: string }
 *                   status: { type: string, enum: [PENDING, COMPLETED, FAILED] }
 *                   createdAt: { type: string, format: date-time }
 *                   verifiedAt: { type: string, format: date-time, nullable: true }
 *       401:
 *         description: Authentication required.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    const receipts = await getUserReceipts(userId)
    return NextResponse.json(receipts, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed to retrieve payment receipts." }, { status: 500 })
  }
}
