import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import { SignJWT } from "jose"
import nodemailer from "nodemailer"
import type { SignupInput, LoginInput, VerifyOtpInput, GoogleAuthInput } from "@/lib/validation/auth"

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

// ──────────────────────────────────────────────────────────────────────────────
// JWT helpers
// ──────────────────────────────────────────────────────────────────────────────

export async function signToken(payload: { sub: string; role: string; tier: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN ?? "7d")
    .sign(JWT_SECRET)
}

// ──────────────────────────────────────────────────────────────────────────────
// Email (OTP)
// ──────────────────────────────────────────────────────────────────────────────

function getMailer() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
}

async function sendOtpEmail(email: string, otpCode: string) {
  const mailer = getMailer()
  await mailer.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Lumis — Your Verification Code",
    html: `
      <div style="font-family:sans-serif;max-width:480px">
        <h2 style="color:#4F46E5">Lumis Academic Platform</h2>
        <p>Your one-time verification code is:</p>
        <h1 style="letter-spacing:8px;color:#111">${otpCode}</h1>
        <p style="color:#888;font-size:13px">This code expires in ${process.env.OTP_EXPIRES_MINUTES ?? 10} minutes. Do not share it with anyone.</p>
      </div>
    `,
  })
}

// ──────────────────────────────────────────────────────────────────────────────
// Service methods
// ──────────────────────────────────────────────────────────────────────────────

export async function registerUser(input: SignupInput) {
  const existing = await db.user.findUnique({ where: { email: input.email } })
  if (existing) throw new Error("An account with this email already exists.")

  const passwordHash = await bcrypt.hash(input.password, 12)

  // Generate 6-digit OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + Number(process.env.OTP_EXPIRES_MINUTES ?? 10) * 60_000)

  // Store as pending (user not yet activated — stored in OTP table temporarily)
  // We also create the user record upfront with SUSPENDED status; OTP verify activates it
  const user = await db.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      status: "SUSPENDED", // Activated after OTP verification
    },
  })

  // Invalidate previous OTPs for this email
  await db.oneTimePassword.deleteMany({ where: { email: input.email } })

  await db.oneTimePassword.create({
    data: { email: input.email, otpCode, expiresAt },
  })

  await sendOtpEmail(input.email, otpCode)

  return { message: "Registration initiated. Please verify your email with the OTP sent." }
}

export async function verifyOtp(input: VerifyOtpInput) {
  const otp = await db.oneTimePassword.findFirst({
    where: { email: input.email },
    orderBy: { createdAt: "desc" },
  })

  if (!otp) throw new Error("No pending OTP found for this email.")
  if (otp.attempts >= 3) throw new Error("Maximum OTP attempts reached. Please register again.")
  if (new Date() > otp.expiresAt) throw new Error("OTP has expired. Please register again.")

  if (otp.otpCode !== input.otpCode) {
    await db.oneTimePassword.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    })
    throw new Error("Invalid OTP code.")
  }

  // Activate the user account
  const user = await db.user.update({
    where: { email: input.email },
    data: { status: "ACTIVE" },
  })

  // Clean up OTP record
  await db.oneTimePassword.delete({ where: { id: otp.id } })

  const token = await signToken({ sub: user.id, role: user.role, tier: user.tier })
  return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role, tier: user.tier } }
}

export async function loginUser(input: LoginInput) {
  const user = await db.user.findUnique({ where: { email: input.email } })
  if (!user) throw new Error("Invalid email or password.")
  if (user.status === "SUSPENDED") throw new Error("Your account is suspended. Please contact support.")
  if (!user.passwordHash) throw new Error("This account was registered via Google SSO. Please sign in with Google.")

  const valid = await bcrypt.compare(input.password, user.passwordHash)
  if (!valid) throw new Error("Invalid email or password.")

  const token = await signToken({ sub: user.id, role: user.role, tier: user.tier })
  return { token, user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, role: user.role, tier: user.tier } }
}

export async function googleLoginUser(input: GoogleAuthInput) {
  let user = await db.user.findUnique({ where: { email: input.email } })

  if (user) {
    if (user.status === "SUSPENDED") throw new Error("Your account is suspended. Please contact support.")
    if (input.avatarUrl && !user.avatarUrl) {
      user = await db.user.update({
        where: { id: user.id },
        data: { avatarUrl: input.avatarUrl }
      })
    }
  } else {
    user = await db.user.create({
      data: {
        name: input.name,
        email: input.email,
        avatarUrl: input.avatarUrl || null,
        status: "ACTIVE",
        role: "STUDENT"
      }
    })
  }

  const token = await signToken({ sub: user.id, role: user.role, tier: user.tier })
  return { token, user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, role: user.role, tier: user.tier } }
}
