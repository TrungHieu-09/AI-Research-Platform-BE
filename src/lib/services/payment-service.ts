import { db } from "@/lib/db"

// Transfer content format for bank auto-verification:  LUMIS-{userId.slice(0,8).toUpperCase()}
const PLAN_PRICES: Record<string, number> = {
  PREMIUM_MONTHLY: 49000,
  PREMIUM_YEARLY: 490000,
}

const PAYMENT_BANK = {
  bankName: "VietcomBank",
  bankCode: "VCB",
  accountNumber: "1234567890",
  accountName: "CONG TY LUMIS EDTECH",
}

function buildVietQrUrl(amount: number, transferContent: string) {
  const params = new URLSearchParams({
    amount: String(amount),
    addInfo: transferContent,
    accountName: PAYMENT_BANK.accountName,
  })

  return `https://img.vietqr.io/image/${PAYMENT_BANK.bankCode}-${PAYMENT_BANK.accountNumber}-compact2.png?${params.toString()}`
}

function isSuccessfulPaymentStatus(status?: string) {
  if (!status) return true
  return ["COMPLETED", "SUCCESS", "PAID"].includes(status.trim().toUpperCase())
}

export async function initiatePayment(userId: string, planId: string) {
  const amount = PLAN_PRICES[planId]
  if (!amount) throw new Error(`Unknown plan: ${planId}`)

  const transferContent = `LUMIS-${userId.slice(0, 8).toUpperCase()}-${Date.now()}`

  const receipt = await db.paymentReceipt.create({
    data: { userId, planId, amount, transferContent, status: "PENDING" },
  })

  const qrCodeUrl = buildVietQrUrl(amount, transferContent)

  return {
    orderId: receipt.id,
    amount,
    currency: "VND",
    transferContent,
    qrCodeUrl,
    receipt,
    paymentInstructions: {
      bankName: PAYMENT_BANK.bankName,
      accountNumber: PAYMENT_BANK.accountNumber,
      accountName: PAYMENT_BANK.accountName,
      amount,
      currency: "VND",
      transferContent,
      qrCodeUrl,
      expiresAt: new Date(Date.now() + 30 * 60_000), // 30 minutes
    },
  }
}

export async function handlePaymentWebhook(transferContent: string, amountReceived: number, status?: string) {
  const receipt = await db.paymentReceipt.findUnique({ where: { transferContent } })
  if (!receipt) throw new Error("Payment receipt not found.")
  if (receipt.status !== "PENDING") throw new Error("Payment already processed.")

  if (!isSuccessfulPaymentStatus(status)) {
    await db.paymentReceipt.update({
      where: { id: receipt.id },
      data: { status: "FAILED" },
    })

    await db.auditLog.create({
      data: {
        userId: receipt.userId,
        action: "PAYMENT_FAILED",
        targetEntity: "payment_receipts",
        targetId: receipt.id,
      },
    })

    return { success: false, message: "Payment was not completed. Premium tier was not activated." }
  }

  if (amountReceived < Number(receipt.amount)) {
    await db.paymentReceipt.update({
      where: { id: receipt.id },
      data: { status: "FAILED" },
    })
    throw new Error("Insufficient payment amount received.")
  }

  const user = await db.user.findUnique({ where: { id: receipt.userId } })
  if (!user) throw new Error("User not found.")

  const additionalDays = receipt.planId === "PREMIUM_YEARLY" ? 365 : 30
  const now = new Date()
  const currentExpiresAt = user.tierExpiresAt && user.tierExpiresAt > now ? user.tierExpiresAt : now
  const newExpiresAt = new Date(currentExpiresAt.getTime() + additionalDays * 24 * 60 * 60 * 1000)

  // Activate premium tier for the user
  await db.paymentReceipt.update({
    where: { id: receipt.id },
    data: { status: "COMPLETED", verifiedAt: now },
  })

  await db.user.update({
    where: { id: receipt.userId },
    data: { 
      tier: "PREMIUM",
      tierExpiresAt: newExpiresAt
    },
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

export async function getUserReceipts(userId: string) {
  return db.paymentReceipt.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      planId: true,
      amount: true,
      transferContent: true,
      status: true,
      createdAt: true,
      verifiedAt: true,
    },
  })
}

export async function confirmPaymentOrder(userId: string, orderId: string) {
  const receipt = await db.paymentReceipt.findFirst({
    where: { id: orderId, userId },
  })

  if (!receipt) {
    throw new Error("Không tìm thấy đơn hàng thanh toán này của bạn.")
  }

  if (receipt.status === "COMPLETED") {
    return { success: true, message: "Đơn hàng đã được thanh toán từ trước." }
  }

  if (receipt.status === "FAILED") {
    throw new Error("Đơn hàng này đã bị hủy hoặc thất bại.")
  }

  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error("User not found.")

  const additionalDays = receipt.planId === "PREMIUM_YEARLY" ? 365 : 30
  const now = new Date()
  const currentExpiresAt = user.tierExpiresAt && user.tierExpiresAt > now ? user.tierExpiresAt : now
  const newExpiresAt = new Date(currentExpiresAt.getTime() + additionalDays * 24 * 60 * 60 * 1000)

  await db.paymentReceipt.update({
    where: { id: receipt.id },
    data: { status: "COMPLETED", verifiedAt: now },
  })

  await db.user.update({
    where: { id: userId },
    data: { 
      tier: "PREMIUM",
      tierExpiresAt: newExpiresAt
    },
  })

  await db.auditLog.create({
    data: {
      userId,
      action: "PAYMENT_CONFIRMED_SANDBOX",
      targetEntity: "payment_receipts",
      targetId: receipt.id,
    },
  })

  return { success: true, message: "Xác nhận thanh toán thành công! Tài khoản của bạn đã được nâng cấp lên PREMIUM." }
}
