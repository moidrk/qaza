import "server-only";

import webpush from 'web-push';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.NEXT_PUBLIC_VAPID_SUBJECT || 'mailto:admin@qaza.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey
  );
}

export type PushNotificationResult =
  | { success: true }
  | {
      success: false;
      error: string;
      statusCode?: number;
      shouldDeleteSubscription: boolean;
    };

function getWebPushStatusCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) {
    return undefined;
  }

  const { statusCode } = error as { statusCode?: unknown };
  return typeof statusCode === "number" ? statusCode : undefined;
}

export function shouldDeletePushSubscription(statusCode: number | undefined) {
  return statusCode === 404 || statusCode === 410;
}

function sendWebPushWithoutLegacyUrlWarning(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string
) {
  const previousNoDeprecation = process.noDeprecation;

  try {
    process.noDeprecation = true;
    return webpush.sendNotification(subscription, payload, {
      TTL: 60 * 60 * 24,
      timeout: 10_000,
      urgency: "normal",
    });
  } finally {
    process.noDeprecation = previousNoDeprecation;
  }
}

export async function sendPushNotification(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: Record<string, unknown>
): Promise<PushNotificationResult> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("VAPID keys missing, skipping push");
    return { success: false, error: "VAPID keys missing", shouldDeleteSubscription: false };
  }

  try {
    await sendWebPushWithoutLegacyUrlWarning(subscription, JSON.stringify(payload));
    return { success: true };
  } catch (error) {
    const statusCode = getWebPushStatusCode(error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown push error",
      statusCode,
      shouldDeleteSubscription: shouldDeletePushSubscription(statusCode),
    };
  }
}
