"use server"

import bcrypt from "bcryptjs"
import { and, eq } from "drizzle-orm"
import { signIn } from "@/auth"
import { db } from "@/db"
import { users, verificationTokens } from "@/db/schema"
import { sendPasswordResetOtpEmail, sendVerificationOtpEmail } from "@/lib/email"
import {
  emailOnlySchema,
  getZodError,
  otpVerificationSchema,
  passwordResetSchema,
  registerSchema,
} from "@/lib/validation"
import { createOtp, hashOtp, verifyOtpHash } from "@/lib/otp"
import { enforceEmailAndIpRateLimit } from "@/lib/rate-limit"

const OTP_EXPIRY_MS = 15 * 60 * 1000
const MAX_OTP_ATTEMPTS = 5

async function enforceRateLimit(scope: string, email: string, maxAttempts: number, windowMs: number) {
  return enforceEmailAndIpRateLimit(scope, email, maxAttempts, windowMs)
}

async function createAndStoreOtp(email: string) {
  const otp = createOtp()
  const expires = new Date(Date.now() + OTP_EXPIRY_MS)

  await db.delete(verificationTokens).where(eq(verificationTokens.identifier, email))
  await db.insert(verificationTokens).values({
    identifier: email,
    token: hashOtp(email, otp),
    expires,
    attempts: 0,
  })

  return otp
}

async function validateStoredOtp(email: string, otp: string) {
  const tokenRecord = await db.query.verificationTokens.findFirst({
    where: eq(verificationTokens.identifier, email),
  })

  if (!tokenRecord) {
    return { error: "Invalid OTP code" }
  }

  if (new Date() > new Date(tokenRecord.expires)) {
    await db.delete(verificationTokens).where(eq(verificationTokens.identifier, email))
    return { error: "OTP expired" }
  }

  if (tokenRecord.attempts >= MAX_OTP_ATTEMPTS) {
    await db.delete(verificationTokens).where(eq(verificationTokens.identifier, email))
    return { error: "Too many invalid attempts. Please request a new code." }
  }

  if (!verifyOtpHash(email, otp, tokenRecord.token)) {
    const nextAttempts = tokenRecord.attempts + 1
    if (nextAttempts >= MAX_OTP_ATTEMPTS) {
      await db.delete(verificationTokens).where(eq(verificationTokens.identifier, email))
      return { error: "Too many invalid attempts. Please request a new code." }
    }

    await db
      .update(verificationTokens)
      .set({ attempts: nextAttempts })
      .where(and(eq(verificationTokens.identifier, email), eq(verificationTokens.token, tokenRecord.token)))

    return { error: "Invalid OTP code" }
  }

  return { success: true }
}

export async function registerUser(formData: FormData) {
  try {
    const parsed = registerSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    })

    if (!parsed.success) {
      return { error: getZodError(parsed.error) }
    }

    const { name, email, password } = parsed.data
    const rateLimitError = await enforceRateLimit("auth:register", email, 5, 15 * 60 * 1000)
    if (rateLimitError) return { error: rateLimitError }

    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    })

    if (existing?.emailVerified) {
      return { error: "User already exists. Please log in." }
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    if (existing) {
      await db
        .update(users)
        .set({
          name,
          password: hashedPassword,
        })
        .where(eq(users.email, email))
    } else {
      await db.insert(users).values({
        name,
        email,
        password: hashedPassword,
      })
    }

    const otp = await createAndStoreOtp(email)
    await sendVerificationOtpEmail({
      email,
      otp,
    })

    return { success: true }
  } catch (error) {
    console.error("Registration error", error)
    return { error: "An unexpected error occurred." }
  }
}

export async function verifyOtp(formData: FormData) {
  try {
    const parsed = otpVerificationSchema.safeParse({
      email: formData.get("email"),
      otp: formData.get("otp"),
    })

    if (!parsed.success) {
      return { error: getZodError(parsed.error) }
    }

    const { email, otp } = parsed.data
    const rateLimitError = await enforceRateLimit("auth:verify-otp", email, 10, 15 * 60 * 1000)
    if (rateLimitError) return { error: rateLimitError }

    const otpResult = await validateStoredOtp(email, otp)
    if (!otpResult.success) return { error: otpResult.error }

    await db.update(users).set({ emailVerified: new Date() }).where(eq(users.email, email))
    await db.delete(verificationTokens).where(eq(verificationTokens.identifier, email))

    return { success: true }
  } catch (error) {
    console.error("Verification error", error)
    return { error: "An unexpected error occurred" }
  }
}

export async function resendOtp(formData: FormData) {
  try {
    const parsed = emailOnlySchema.safeParse({ email: formData.get("email") })
    if (!parsed.success) {
      return { error: getZodError(parsed.error) }
    }

    const { email } = parsed.data
    const rateLimitError = await enforceRateLimit("auth:resend-otp", email, 3, 10 * 60 * 1000)
    if (rateLimitError) return { error: rateLimitError }

    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    })

    if (!existingUser) {
      return { success: true }
    }

    if (existingUser.emailVerified) {
      return { error: "Email is already verified" }
    }

    const otp = await createAndStoreOtp(email)
    await sendVerificationOtpEmail({
      email,
      otp,
    })

    return { success: true }
  } catch (error) {
    console.error("Resend OTP error", error)
    return { error: "Failed to resend OTP" }
  }
}

export async function googleSignIn() {
  await signIn("google", { redirectTo: "/" })
}

export async function sendForgotPasswordOtp(formData: FormData) {
  try {
    const parsed = emailOnlySchema.safeParse({ email: formData.get("email") })
    if (!parsed.success) {
      return { error: getZodError(parsed.error) }
    }

    const { email } = parsed.data
    const rateLimitError = await enforceRateLimit("auth:forgot-password", email, 3, 10 * 60 * 1000)
    if (rateLimitError) return { error: rateLimitError }

    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    })

    if (!existingUser) {
      return { success: true }
    }

    const otp = await createAndStoreOtp(email)
    await sendPasswordResetOtpEmail({
      email,
      otp,
    })

    return { success: true }
  } catch (error) {
    console.error("Forgot password OTP error", error)
    return { error: "Failed to send reset code" }
  }
}

export async function resetPassword(formData: FormData) {
  try {
    const parsed = passwordResetSchema.safeParse({
      email: formData.get("email"),
      otp: formData.get("otp"),
      newPassword: formData.get("newPassword"),
    })

    if (!parsed.success) {
      return { error: getZodError(parsed.error) }
    }

    const { email, otp, newPassword } = parsed.data
    const rateLimitError = await enforceRateLimit("auth:reset-password", email, 10, 15 * 60 * 1000)
    if (rateLimitError) return { error: rateLimitError }

    const otpResult = await validateStoredOtp(email, otp)
    if (!otpResult.success) return { error: otpResult.error }

    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await db
      .update(users)
      .set({
        password: hashedPassword,
        emailVerified: new Date(),
      })
      .where(eq(users.email, email))

    await db.delete(verificationTokens).where(eq(verificationTokens.identifier, email))

    return { success: true }
  } catch (error) {
    console.error("Password reset error", error)
    return { error: "An unexpected error occurred" }
  }
}
