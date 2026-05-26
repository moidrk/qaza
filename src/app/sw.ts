/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

type PushPayload = {
  title?: string;
  body?: string;
  payload?: {
    url?: string;
    type?: string;
    prayerName?: string;
    date?: string;
    tokens?: {
      completed?: string;
      missed?: string;
    };
  };
};

type NotificationActionOption = {
  action: string;
  title: string;
};

type ActionableNotificationOptions = NotificationOptions & {
  actions?: NotificationActionOption[];
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ sameOrigin, url: { pathname } }) => sameOrigin && pathname.startsWith("/api/"),
      method: "GET",
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ request, sameOrigin, url: { pathname } }) =>
        sameOrigin &&
        !pathname.startsWith("/api/") &&
        (request.mode === "navigate" ||
          request.headers.get("RSC") === "1" ||
          pathname.startsWith("/_next/data/")),
      method: "GET",
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();

function getNotificationUrl(data: PushPayload["payload"]) {
  const target = data?.url || "/";
  const url = new URL(target, self.location.origin);

  if (url.origin !== self.location.origin) {
    return self.location.origin;
  }

  return url.href;
}

async function openOrFocusNotificationUrl(data: PushPayload["payload"]) {
  const targetUrl = getNotificationUrl(data);
  const clientList = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  for (const client of clientList) {
    if ("focus" in client) {
      if ("navigate" in client && client.url !== targetUrl) {
        await client.navigate(targetUrl);
      }

      return client.focus();
    }
  }

  return self.clients.openWindow(targetUrl);
}

self.addEventListener('push', (event) => {
  let data: PushPayload = {};

  try {
    data = (event.data?.json() ?? {}) as PushPayload;
  } catch (error) {
    console.warn("Failed to parse push payload", error);
  }

  const title = data.title || "Prayer Reminder";
  const payload = data.payload ?? {};
  const options: ActionableNotificationOptions = {
    body: data.body,
    icon: "/icon-192x192.png",
    data: payload,
  };

  if (payload.type === "prayer_checkin" && payload.prayerName && payload.date) {
    options.actions = [
      { action: "completed", title: "Yes, I prayed" },
      { action: "missed", title: "No, log to Qaza" }
    ];
  }
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === "test_completed" || event.action === "test_missed") {
    // Just close the notification. In a real SW we could postMessage to the client to show a toast,
    // but the user just wants to see what the buttons look like without backend calls.
    return;
  }

  if (event.action === "completed" || event.action === "missed") {
    const payload = event.notification.data as PushPayload["payload"];
    const endpoint = event.action === "completed" 
      ? '/api/notifications/prayer-checkin/prayed'
      : '/api/notifications/prayer-checkin/qaza';
    const actionToken = event.action === "completed"
      ? payload?.tokens?.completed
      : payload?.tokens?.missed;
    const targetUrl = payload?.url ? payload : { url: "/" };
      
    event.waitUntil(
      fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prayerName: payload?.prayerName,
          date: payload?.date,
          actionToken,
        })
      }).then((response) => {
        if (!response.ok) {
          return openOrFocusNotificationUrl(targetUrl);
        }
      }).catch(() => openOrFocusNotificationUrl(targetUrl))
    );
  } else {
    event.waitUntil(
      openOrFocusNotificationUrl(event.notification.data as PushPayload["payload"])
    );
  }
});
