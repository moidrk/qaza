import "server-only"

import crypto from "node:crypto"
import { z } from "zod"
import { isoDateSchema, prayerNameSchema, type PrayerName } from "@/lib/validation"

export type NotificationAction = "completed" | "missed"

const tokenPayloadSchema = z.object({
  userId: z.string().min(1),
  prayerName: prayerNameSchema,
  date: isoDateSchema,
  action: z.enum(["completed", "missed"]),
  exp: z.number().int().positive(),
})

export type NotificationActionTokenPayload = z.infer<typeof tokenPayloadSchema>

function getSigningSecret() {
  const secret = process.env.NOTIFICATION_ACTION_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET

  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("NOTIFICATION_ACTION_SECRET or AUTH_SECRET must be configured in production")
  }

  return secret || "development-notification-action-secret"
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

function sign(value: string) {
  return crypto.createHmac("sha256", getSigningSecret()).update(value).digest("base64url")
}

export function createNotificationActionToken(input: {
  userId: string
  prayerName: PrayerName
  date: string
  action: NotificationAction
  expiresInMs?: number
}) {
  const payload = tokenPayloadSchema.parse({
    ...input,
    exp: Date.now() + (input.expiresInMs ?? 1000 * 60 * 60 * 24),
  })

  const body = encode(payload)
  return `${body}.${sign(body)}`
}

export function verifyNotificationActionToken(
  token: string | undefined,
  expected: { prayerName: PrayerName; date: string; action: NotificationAction }
) {
  if (!token) return null

  const [body, signature] = token.split(".")
  if (!body || !signature) return null

  const expectedSignature = sign(body)
  const signatureBytes = Buffer.from(signature)
  const expectedBytes = Buffer.from(expectedSignature)

  if (signatureBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(signatureBytes, expectedBytes)) {
    return null
  }

  try {
    const parsed = tokenPayloadSchema.parse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")))
    if (parsed.exp < Date.now()) return null
    if (parsed.prayerName !== expected.prayerName || parsed.date !== expected.date || parsed.action !== expected.action) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}
