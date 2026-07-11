import { z } from "zod"

const standardEmail = z
  .string()
  .email("Must be a valid email address.")

export const LoginSchema = z.object({
  email: standardEmail,
  password: z.string().min(8, "Password must be at least 8 characters long."),
})

export const SignupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: standardEmail,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter.")
    .regex(/[0-9]/, "Must contain at least one number."),
})

export const VerifyOtpSchema = z.object({
  email: standardEmail,
  otpCode: z.string().length(6, "OTP code must be exactly 6 digits.").regex(/^\d+$/, "OTP must be numeric."),
})

export const GoogleAuthSchema = z.object({
  email: standardEmail,
  name: z.string().min(1, "Name is required."),
  avatarUrl: z.string().optional().or(z.literal("")),
})

export const ForgotPasswordSchema = z.object({
  email: standardEmail,
})

export const ResetPasswordSchema = z.object({
  email: standardEmail,
  otpCode: z.string().length(6, "OTP code must be exactly 6 digits.").regex(/^\d+$/, "OTP must be numeric."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter.")
    .regex(/[0-9]/, "Must contain at least one number."),
})

export type LoginInput = z.infer<typeof LoginSchema>
export type SignupInput = z.infer<typeof SignupSchema>
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>
export type GoogleAuthInput = z.infer<typeof GoogleAuthSchema>
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>
