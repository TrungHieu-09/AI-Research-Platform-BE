import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { sendOtpEmail } from "@/lib/services/auth-service"
import type { AdminCreateUserInput, ProfileEmailVerificationOtpInput } from "@/lib/validation/auth"

export const userProfileSelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  role: true,
  status: true,
  tier: true,
  tierExpiresAt: true,
  createdAt: true,
  updatedAt: true,
} as const

export const publicUserVerificationSelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,

} as const

export async function createUserByAdmin(input: AdminCreateUserInput) {
  const existing = await db.user.findUnique({ where: { email: input.email } })
  if (existing) throw new Error("An account with this email already exists.")

  const passwordHash = await bcrypt.hash(input.password, 12)

  return db.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role ?? "STUDENT",
      status: "ACTIVE",

    },
    select: userProfileSelect,
  })
}

export async function requestProfileEmailVerificationOtp(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: userProfileSelect })
  if (!user) throw new Error("User not found.")
  if (user.status !== "UNVERIFIED") {
    return {
      message: "Sinh trắc học đã xác thực",
      email: user.email,
      expiresInMinutes: Number(process.env.OTP_EXPIRES_MINUTES ?? 10),
    }
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresInMinutes = Number(process.env.OTP_EXPIRES_MINUTES ?? 10)
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60_000)

  await db.oneTimePassword.deleteMany({ where: { email: user.email } })
  await db.oneTimePassword.create({
    data: { email: user.email, otpCode, expiresAt },
  })

  await sendOtpEmail(user.email, otpCode)

  return {
    message: "Verification OTP sent to your email.",
    email: user.email,
    expiresInMinutes,
  }
}

export async function verifyProfileEmailOtp(userId: string, input: ProfileEmailVerificationOtpInput) {
  const user = await db.user.findUnique({ where: { id: userId }, select: userProfileSelect })
  if (!user) throw new Error("User not found.")
  if (user.status !== "UNVERIFIED") {
    return {
      message: "Sinh trắc học đã xác thực",
      user,
    }
  }

  const otp = await db.oneTimePassword.findFirst({
    where: { email: user.email },
    orderBy: { createdAt: "desc" },
  })

  if (!otp) throw new Error("No pending OTP found for this email.")
  if (otp.attempts >= 3) throw new Error("Maximum OTP attempts reached. Please request a new code.")
  if (new Date() > otp.expiresAt) throw new Error("OTP has expired. Please request a new code.")

  if (otp.otpCode !== input.otpCode) {
    await db.oneTimePassword.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    })
    throw new Error("Invalid OTP code.")
  }

  const updatedUser = await db.user.update({
    where: { id: userId },
    data: {
      status: "ACTIVE",
    },
    select: userProfileSelect,
  })

  await db.oneTimePassword.delete({ where: { id: otp.id } })

  return {
    message: "Sinh trắc học đã xác thực thành công.",
    user: updatedUser,
  }
}