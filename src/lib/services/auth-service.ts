import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import { SignJWT } from "jose"
import nodemailer from "nodemailer"
import type { SignupInput, LoginInput, VerifyOtpInput, GoogleAuthInput, ForgotPasswordInput, ResetPasswordInput } from "@/lib/validation/auth"

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
    secure: false, // true for 465, false for 587 (STARTTLS)
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: { rejectUnauthorized: false },
  })
}

async function sendOtpEmail(email: string, otpCode: string) {
  console.log(`\n======================================================`)
  console.log(`🔑 DEV MODE OTP: Email sent to ${email} -> Code: ${otpCode}`)
  console.log(`======================================================\n`)

  try {
    const mailer = getMailer()
    await mailer.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: "Lumis — Mã xác thực tài khoản của bạn",
      headers: {
        "X-Priority": "1",
        "X-MSMail-Priority": "High",
        "Importance": "high",
      },
      text: `Mã xác thực của bạn là: ${otpCode}. Mã này sẽ hết hạn sau ${process.env.OTP_EXPIRES_MINUTES ?? 10} phút. Vui lòng không chia sẻ mã này với bất kỳ ai.`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Xác thực tài khoản Lumis</title>
        </head>
        <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f8f9ff;color:#121c2a;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f9ff;padding:40px 0;">
            <tr>
              <td align="center">
                <table width="100%" max-width="500" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:24px;border:1px solid #eef4ff;box-shadow:0 12px 40px rgba(0,88,190,0.05);overflow:hidden;max-width:500px;margin:0 auto;">
                  
                  <!-- Header -->
                  <tr>
                    <td align="center" style="padding:40px 40px 20px;background:linear-gradient(135deg, #0058be 0%, #0051d5 100%);">
                      <h1 style="color:#ffffff;font-size:28px;font-weight:700;margin:0;letter-spacing:-0.5px;">Lumis</h1>
                      <p style="color:#adc6ff;font-size:15px;margin:8px 0 0;">Nền tảng Nghiên cứu AI</p>
                    </td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="padding:40px;">
                      <h2 style="font-size:20px;font-weight:600;margin:0 0 16px;">Xin chào,</h2>
                      <p style="font-size:15px;line-height:1.6;color:#424754;margin:0 0 32px;">
                        Cảm ơn bạn đã tham gia cộng đồng Lumis. Để hoàn tất việc đăng ký và truy cập vào Không gian làm việc, vui lòng sử dụng mã xác thực dưới đây:
                      </p>

                      <div style="background-color:#f8f9ff;border:1px solid #c2c6d6;border-radius:16px;padding:24px;text-align:center;margin-bottom:32px;">
                        <span style="font-family:monospace;font-size:36px;font-weight:700;letter-spacing:12px;color:#0058be;display:inline-block;margin-left:12px;">
                          ${otpCode}
                        </span>
                      </div>

                      <p style="font-size:14px;color:#727785;margin:0 0 8px;text-align:center;">
                        Mã này sẽ hết hạn sau <b>${process.env.OTP_EXPIRES_MINUTES ?? 10} phút</b>.
                      </p>
                      <p style="font-size:13px;color:#a0a4b0;margin:0;text-align:center;">
                        Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email.
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td align="center" style="padding:24px;background-color:#f8f9ff;border-top:1px solid #eef4ff;">
                      <p style="font-size:12px;color:#a0a4b0;margin:0;">
                        © ${new Date().getFullYear()} Lumis Academic Platform. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    })
  } catch (error) {
    console.error(`Failed to send email to ${email}, but OTP is visible above.`, error)
  }
}

async function sendPasswordResetEmail(email: string, otpCode: string) {
  console.log(`\n======================================================`)
  console.log(`🔑 DEV MODE OTP (RESET): Email sent to ${email} -> Code: ${otpCode}`)
  console.log(`======================================================\n`)

  try {
    const mailer = getMailer()
    await mailer.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: "Lumis — Đặt lại mật khẩu",
      headers: {
        "X-Priority": "1",
        "X-MSMail-Priority": "High",
        "Importance": "high",
      },
      text: `Mã đặt lại mật khẩu của bạn là: ${otpCode}. Mã này sẽ hết hạn sau ${process.env.OTP_EXPIRES_MINUTES ?? 10} phút. Nếu bạn không yêu cầu điều này, hãy bỏ qua email này.`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Đặt lại mật khẩu Lumis</title>
        </head>
        <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f8f9ff;color:#121c2a;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f9ff;padding:40px 0;">
            <tr>
              <td align="center">
                <table width="100%" max-width="500" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:24px;border:1px solid #eef4ff;box-shadow:0 12px 40px rgba(0,88,190,0.05);overflow:hidden;max-width:500px;margin:0 auto;">
                  <tr>
                    <td align="center" style="padding:40px 40px 20px;background:linear-gradient(135deg, #0058be 0%, #0051d5 100%);">
                      <h1 style="color:#ffffff;font-size:28px;font-weight:700;margin:0;letter-spacing:-0.5px;">Lumis</h1>
                      <p style="color:#adc6ff;font-size:15px;margin:8px 0 0;">Yêu cầu đặt lại mật khẩu</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:40px;">
                      <h2 style="font-size:20px;font-weight:600;margin:0 0 16px;">Xin chào,</h2>
                      <p style="font-size:15px;line-height:1.6;color:#424754;margin:0 0 32px;">
                        Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Vui lòng sử dụng mã xác thực dưới đây để tiến hành đổi mật khẩu:
                      </p>
                      <div style="background-color:#f8f9ff;border:1px solid #c2c6d6;border-radius:16px;padding:24px;text-align:center;margin-bottom:32px;">
                        <span style="font-family:monospace;font-size:36px;font-weight:700;letter-spacing:12px;color:#0058be;display:inline-block;margin-left:12px;">
                          ${otpCode}
                        </span>
                      </div>
                      <p style="font-size:14px;color:#727785;margin:0 0 8px;text-align:center;">
                        Mã này sẽ hết hạn sau <b>${process.env.OTP_EXPIRES_MINUTES ?? 10} phút</b>.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:24px;background-color:#f8f9ff;border-top:1px solid #eef4ff;">
                      <p style="font-size:12px;color:#a0a4b0;margin:0;">
                        © ${new Date().getFullYear()} Lumis Academic Platform. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    })
  } catch (error) {
    console.error(`Failed to send email to ${email}, but OTP is visible above.`, error)
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Service methods
// ──────────────────────────────────────────────────────────────────────────────

export async function registerUser(input: SignupInput) {
  const existing = await db.user.findUnique({ where: { email: input.email } })
  if (existing && existing.status !== "UNVERIFIED") {
    throw new Error("An account with this email already exists.")
  }

  const passwordHash = await bcrypt.hash(input.password, 12)

  // Generate 6-digit OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + Number(process.env.OTP_EXPIRES_MINUTES ?? 10) * 60_000)

  if (existing) {
    // Update existing unverified user with new details and trigger new OTP
    await db.user.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        passwordHash,
      },
    })
  } else {
    // Store as pending (user not yet activated — stored in OTP table temporarily)
    // We also create the user record upfront with UNVERIFIED status; OTP verify activates it
    await db.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        status: "UNVERIFIED", // Activated after OTP verification
      },
    })
  }

  // Invalidate previous OTPs for this email
  await db.oneTimePassword.deleteMany({ where: { email: input.email } })

  await db.oneTimePassword.create({
    data: { email: input.email, otpCode, expiresAt },
  })

  await sendOtpEmail(input.email, otpCode)

  return { message: "Registration initiated. Please verify your email with the OTP sent." }
}

export async function forgotPassword(input: ForgotPasswordInput) {
  const existing = await db.user.findUnique({ where: { email: input.email } })
  if (!existing) {
    // Return success to avoid email enumeration attacks
    return { message: "If an account exists, an OTP has been sent." }
  }

  // Generate 6-digit OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + Number(process.env.OTP_EXPIRES_MINUTES ?? 10) * 60_000)

  // Invalidate previous OTPs for this email
  await db.oneTimePassword.deleteMany({ where: { email: input.email } })

  await db.oneTimePassword.create({
    data: { email: input.email, otpCode, expiresAt },
  })

  await sendPasswordResetEmail(input.email, otpCode)

  return { message: "If an account exists, an OTP has been sent." }
}

export async function verifyResetOtp(email: string, otpCode: string) {
  const otp = await db.oneTimePassword.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
  })

  if (!otp) throw new Error("No pending OTP found for this email.")
  if (otp.attempts >= 3) throw new Error("Đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới.")
  if (new Date() > otp.expiresAt) throw new Error("Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.")

  if (otp.otpCode !== otpCode) {
    await db.oneTimePassword.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    })
    throw new Error("Mã OTP không đúng. Vui lòng kiểm tra lại.")
  }

  return { message: "OTP verified." }
}

export async function resetPassword(input: ResetPasswordInput) {
  const otp = await db.oneTimePassword.findFirst({
    where: { email: input.email },
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

  const passwordHash = await bcrypt.hash(input.password, 12)

  await db.user.update({
    where: { email: input.email },
    data: { 
      passwordHash,
      status: "ACTIVE" // Verify the user if they were UNVERIFIED
    },
  })

  // Clean up OTP record
  await db.oneTimePassword.delete({ where: { id: otp.id } })

  return { message: "Password reset successfully." }
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
  if (user.status === "UNVERIFIED") throw new Error("Please verify your email with the OTP code sent before logging in.")
  if (!user.passwordHash) throw new Error("This account was registered via Google SSO. Please sign in with Google.")

  const valid = await bcrypt.compare(input.password, user.passwordHash)
  if (!valid) throw new Error("Invalid email or password.")

  let currentTier = user.tier
  if (user.tierExpiresAt && new Date(user.tierExpiresAt) < new Date()) {
    await db.user.update({
      where: { id: user.id },
      data: { tier: "FREE", tierExpiresAt: null }
    })
    currentTier = "FREE" as any // Type assertion to bypass TS error temporarily
  }

  const token = await signToken({ sub: user.id, role: user.role, tier: currentTier })
  return { token, user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, role: user.role, tier: currentTier } }
}

export async function googleLoginUser(input: GoogleAuthInput) {
  let user = await db.user.findUnique({ where: { email: input.email } })

  if (user) {
    if (user.status === "SUSPENDED") throw new Error("Your account is suspended. Please contact support.")
    if (user.status === "UNVERIFIED" || (input.avatarUrl && !user.avatarUrl)) {
      user = await db.user.update({
        where: { id: user.id },
        data: {
          status: "ACTIVE",
          avatarUrl: input.avatarUrl || user.avatarUrl,
        }
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

  let currentTier = user.tier
  if ((user as any).tierExpiresAt && new Date((user as any).tierExpiresAt) < new Date()) {
    await db.user.update({
      where: { id: user.id },
      data: { tier: "FREE", tierExpiresAt: null }
    })
    currentTier = "FREE" as any
  }

  const token = await signToken({ sub: user.id, role: user.role, tier: currentTier })
  return { token, user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, role: user.role, tier: currentTier } }
}
