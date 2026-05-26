import "server-only";

import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { sendPushNotification } from "@/lib/web-push";
import { and, eq, inArray } from "drizzle-orm";

type PushSubscriptionRecord = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type CronPushDeliveryResult = {
  sentToAtLeastOne: boolean;
  expiredSubscriptions: number;
  failures: number;
};

const PUSH_CONCURRENCY = 5;

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
) {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await mapper(items[current]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );

  return results;
}

export async function sendCronPushNotifications({
  userId,
  subscriptions,
  payload,
}: {
  userId: string;
  subscriptions: PushSubscriptionRecord[];
  payload: Record<string, unknown>;
}): Promise<CronPushDeliveryResult> {
  let sentToAtLeastOne = false;
  let failures = 0;
  const expiredSubscriptionIds: string[] = [];

  await mapWithConcurrency(subscriptions, PUSH_CONCURRENCY, async (sub) => {
    const result = await sendPushNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload
    );

    if (result.success) {
      sentToAtLeastOne = true;
      return;
    }

    if (result.shouldDeleteSubscription) {
      expiredSubscriptionIds.push(sub.id);
      return;
    }

    failures++;
    console.error("Error sending push notification", {
      userId,
      subscriptionId: sub.id,
      statusCode: result.statusCode,
      error: result.error,
    });
  });

  if (expiredSubscriptionIds.length > 0) {
    await db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), inArray(pushSubscriptions.id, expiredSubscriptionIds)));
  }

  return { sentToAtLeastOne, expiredSubscriptions: expiredSubscriptionIds.length, failures };
}
