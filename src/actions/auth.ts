"use server"

import bcrypt from "bcryptjs"
import { headers } from "next/headers"
import { and, eq, lt } from "drizzle-orm"
import { signIn } from "@/auth"
import { db } from "@/db"
import { pendingRegistrations, users, verificationTokens } from "@/db/schema"
import { sendPasswordResetOtpEmail, sendVerificationOtpEmail } from "@/lib/email"
import {
  emailOnlySchema,
  getZodError,
  otpVerificationSchema,
  passwordResetSchema,
  registerSchema,
} from "@/lib/validation"
import { checkRateLimit, createOtp, hashOtp, verifyOtpHash } from "@/lib/otp"
import {
  isBlockedEmail,
  isHoneypotFilled,
  isLikelyRandomName,
  isTooFastRegistration,
} from "@/lib/auth-guards"

const OTP_EXPIRY_MS = 15 * 60 * 1000
const MAX_OTP_ATTEMPTS = 5

async function getClientIp() {
  const headerStore = await headers()
  return (
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip") ||
    "unknown"
  )
}

async function enforceRateLimit(scope: string, email: string, maxAttempts: number, windowMs: number) {
  const ip = await getClientIp()
  const emailError = await checkRateLimit(`${scope}:email:${email}`, maxAttempts, windowMs)
  if (emailError) return emailError

  return checkRateLimit(`${scope}:ip:${ip}`, maxAttempts, windowMs)
}

async function cleanupExpiredAuthRecords() {
  const now = new Date()
  await Promise.all([
    db.delete(verificationTokens).where(lt(verificationTokens.expires, now)),
    db.delete(pendingRegistrations).where(lt(pendingRegistrations.expiresAt, now)),
  ])
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

async function storePendingRegistration(email: string, name: string, passwordHash: string) {
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS)

  await db
    .insert(pendingRegistrations)
    .values({
      email,
      name,
      passwordHash,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: pendingRegistrations.email,
      set: {
        name,
        passwordHash,
        expiresAt,
        createdAt: new Date(),
      },
    })
}

async function verifyPendingRegistration(email: string) {
  const pendingRegistration = await db.query.pendingRegistrations.findFirst({
    where: eq(pendingRegistrations.email, email),
  })

  if (!pendingRegistration) {
    await db.update(users).set({ emailVerified: new Date() }).where(eq(users.email, email))
    return null
  }

  if (new Date() > new Date(pendingRegistration.expiresAt)) {
    await db.delete(pendingRegistrations).where(eq(pendingRegistrations.email, email))
    return "Registration expired. Please sign up again."
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  })

  if (existing) {
    await db
      .update(users)
      .set({
        name: pendingRegistration.name,
        password: pendingRegistration.passwordHash,
        emailVerified: new Date(),
      })
      .where(eq(users.email, email))
  } else {
    await db.insert(users).values({
      name: pendingRegistration.name,
      email,
      password: pendingRegistration.passwordHash,
      emailVerified: new Date(),
    })
  }

  await db.delete(pendingRegistrations).where(eq(pendingRegistrations.email, email))
  return null
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
    if (isHoneypotFilled(formData)) {
      return { success: true }
    }

    const parsed = registerSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    })

    if (!parsed.success) {
      return { error: getZodError(parsed.error) }
    }

    const { name, email, password } = parsed.data

    if (isTooFastRegistration(formData)) {
      return { error: "Please wait a moment before submitting the form." }
    }

    if (isBlockedEmail(email)) {
      return { error: "Registration is unavailable for this email domain." }
    }

    if (isLikelyRandomName(name)) {
      return { error: "Please enter your real name." }
    }

    await cleanupExpiredAuthRecords()

    const rateLimitError = await enforceRateLimit("auth:register", email, 5, 15 * 60 * 1000)
    if (rateLimitError) return { error: rateLimitError }

    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    })

    if (existing?.emailVerified) {
      return { error: "User already exists. Please log in." }
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await storePendingRegistration(email, name, hashedPassword)
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

    const registrationError = await verifyPendingRegistration(email)
    if (registrationError) return { error: registrationError }

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
    await cleanupExpiredAuthRecords()

    const rateLimitError = await enforceRateLimit("auth:resend-otp", email, 3, 10 * 60 * 1000)
    if (rateLimitError) return { error: rateLimitError }

    const [existingUser, pendingRegistration] = await Promise.all([
      db.query.users.findFirst({
        where: eq(users.email, email),
      }),
      db.query.pendingRegistrations.findFirst({
        where: eq(pendingRegistrations.email, email),
      }),
    ])

    if (!existingUser && !pendingRegistration) {
      return { success: true }
    }

    if (existingUser?.emailVerified) {
      return { error: "Email is already verified" }
    }

    if (!pendingRegistration && !existingUser?.password) {
      return { success: true }
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
