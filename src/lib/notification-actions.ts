import "server-only"

import { verifyNotificationActionToken, type NotificationAction } from "@/lib/notification-tokens"
import { getZodError, notFutureIsoDateSchema, type PrayerName } from "@/lib/validation"

type ResolveNotificationActionUserInput = {
  sessionUserId: string | undefined
  actionToken: string | undefined
  prayerName: PrayerName
  date: string
  action: NotificationAction
}

export type ResolveNotificationActionUserResult =
  | { success: true; userId: string }
  | { success: false; status: 400 | 401; error: string }

export function resolveNotificationActionUserId({
  sessionUserId,
  actionToken,
  prayerName,
  date,
  action,
}: ResolveNotificationActionUserInput): ResolveNotificationActionUserResult {
  if (actionToken) {
    const tokenPayload = verifyNotificationActionToken(actionToken, {
      prayerName,
      date,
      action,
    })

    if (!tokenPayload) {
      return { success: false, status: 401, error: "Unauthorized" }
    }

    return { success: true, userId: tokenPayload.userId }
  }

  if (!sessionUserId) {
    return { success: false, status: 401, error: "Unauthorized" }
  }

  const parsedDate = notFutureIsoDateSchema.safeParse(date)
  if (!parsedDate.success) {
    return { success: false, status: 400, error: getZodError(parsedDate.error) }
  }

  return { success: true, userId: sessionUserId }
}
