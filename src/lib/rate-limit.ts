import "server-only"

import crypto from "node:crypto"
import { headers } from "next/headers"
import { eq, sql } from "drizzle-orm"
import { getDb } from "@/db"
import { rateLimits } from "@/db/schema"

function getRateLimitSecret() {
  const secret = process.env.OTP_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET

  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("OTP_SECRET or AUTH_SECRET must be configured in production")
  }

  return secret || "development-rate-limit-secret"
}

function getRateLimitStorageKey(key: string) {
  return crypto.createHmac("sha256", getRateLimitSecret()).update(key).digest("hex")
}

export async function getClientIp() {
  const headerStore = await headers()
  return (
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip") ||
    "unknown"
  )
}

export async function checkRateLimit(key: string, maxAttempts: number, windowMs: number) {
  const db = getDb()
  const storageKey = getRateLimitStorageKey(key)
  const windowSeconds = Math.ceil(windowMs / 1000)

  const result = await db.execute<{
    count: number
    retryAfterSeconds: number
  }>(sql`
    INSERT INTO "rate_limit" ("key", "count", "resetAt", "updatedAt")
    VALUES (${storageKey}, 1, now() + (${windowSeconds} * interval '1 second'), now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "rate_limit"."resetAt" <= now() THEN 1
        ELSE "rate_limit"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "rate_limit"."resetAt" <= now() THEN now() + (${windowSeconds} * interval '1 second')
        ELSE "rate_limit"."resetAt"
      END,
      "updatedAt" = now()
    RETURNING
      "count" AS count,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("resetAt" - now())))::int) AS "retryAfterSeconds"
  `)
  const entry = result.rows[0]

  if (entry.count > maxAttempts) {
    return `Too many attempts. Try again in ${entry.retryAfterSeconds} seconds.`
  }

  return null
}

export async function clearRateLimit(key: string) {
  const db = getDb()
  await db.delete(rateLimits).where(eq(rateLimits.key, getRateLimitStorageKey(key)))
}

export async function enforceEmailAndIpRateLimit(
  scope: string,
  email: string,
  maxAttempts: number,
  windowMs: number
) {
  const normalizedEmail = email.trim().toLowerCase()
  const ip = await getClientIp()
  const emailError = await checkRateLimit(`${scope}:email:${normalizedEmail}`, maxAttempts, windowMs)
  if (emailError) return emailError

  return checkRateLimit(`${scope}:ip:${ip}`, maxAttempts, windowMs)
}
