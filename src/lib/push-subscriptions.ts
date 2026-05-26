import "server-only"

import { db } from "@/db"
import { pushSubscriptions } from "@/db/schema"
import { and, eq, ne } from "drizzle-orm"

type BrowserPushSubscription = {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export async function savePushSubscriptionForUser(userId: string, subscription: BrowserPushSubscription) {
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, subscription.endpoint), ne(pushSubscriptions.userId, userId)))

  await db
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    })
    .onConflictDoUpdate({
      target: [pushSubscriptions.userId, pushSubscriptions.endpoint],
      set: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        createdAt: new Date(),
      },
    })
}

export async function deletePushSubscriptionForUser(userId: string, endpoint: string) {
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
}
