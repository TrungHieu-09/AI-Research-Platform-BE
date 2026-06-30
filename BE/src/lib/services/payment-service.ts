import { db } from "@/lib/db"

// Transfer content format for bank auto-verification:  LUMIS-{userId.slice(0,8).toUpperCase()}
const PLAN_PRICES: Record<string, number> = {
  PREMIUM_MONTHLY: 49000,
  PREMIUM_YEARLY: 490000,
}

export async function initiatePayment(userId: string, planId: string) {
  const amount = PLAN_PRICES[planId]
  if (!amount) throw new Error(`Unknown plan: ${planId}`)

  const transferContent = `LUMIS-${userId.slice(0, 8).toUpperCase()}-${Date.now()}`

  const receipt = await db.paymentReceipt.create({
    data: { userId, planId, amount, transferContent, status: "PENDING" },
  })

  return {
    receipt,
    paymentInstructions: {
      bankName: "VietcomBank",
      accountNumber: "1234567890",
      accountName: "CONG TY LUMIS EDTECH",
      amount,
      transferContent,
      expiresAt: new Date(Date.now() + 30 * 60_000), // 30 minutes
    },
  }
}

export async function handlePaymentWebhook(transferContent: string, amountReceived: number) {
  const receipt = await db.paymentReceipt.findUnique({ where: { transferContent } })
  if (!receipt) throw new Error("Payment receipt not found.")
  if (receipt.status !== "PENDING") throw new Error("Payment already processed.")

  if (amountReceived < Number(receipt.amount)) {
    await db.paymentReceipt.update({
      where: { id: receipt.id },
      data: { status: "FAILED" },
    })
    throw new Error("Insufficient payment amount received.")
  }

  // Activate premium tier for the user
  await db.paymentReceipt.update({
    where: { id: receipt.id },
    data: { status: "COMPLETED", verifiedAt: new Date() },
  })

  await db.user.update({
    where: { id: receipt.userId },
    data: { tier: "PREMIUM" },
  })

  await db.auditLog.create({
    data: {
      userId: receipt.userId,
      action: "PAYMENT_COMPLETED",
      targetEntity: "payment_receipts",
      targetId: receipt.id,
    },
  })

  return { success: true, message: "Payment verified. Premium tier activated." }
}
