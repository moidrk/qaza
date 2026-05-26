import "server-only"

import crypto from "node:crypto"
export { checkRateLimit, clearRateLimit } from "@/lib/rate-limit"

function getOtpSecret() {
  const secret = process.env.OTP_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET

  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("OTP_SECRET or AUTH_SECRET must be configured in production")
  }

  return secret || "development-otp-secret"
}

export function createOtp() {
  return crypto.randomInt(100000, 1000000).toString()
}

export function hashOtp(email: string, otp: string) {
  return crypto
    .createHmac("sha256", getOtpSecret())
    .update(`${email.toLowerCase()}:${otp}`)
    .digest("hex")
}

export function verifyOtpHash(email: string, otp: string, hash: string) {
  const expected = hashOtp(email, otp)
  const expectedBytes = Buffer.from(expected)
  const hashBytes = Buffer.from(hash)

  return hashBytes.length === expectedBytes.length && crypto.timingSafeEqual(hashBytes, expectedBytes)
}
