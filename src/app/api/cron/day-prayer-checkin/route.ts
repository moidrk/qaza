import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, pushSubscriptions, notificationLogs, prayerLogs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getUserLocalDate } from '@/lib/date-utils';
import { requireCronAuth } from '@/lib/cron-auth';
import { createNotificationActionToken } from '@/lib/notification-tokens';
import { sendCronPushNotifications } from '@/lib/cron-push';
import { isDateInExcusedRange, parseStoredExcusedRanges } from '@/lib/excused-periods';
import type { PrayerName } from '@/lib/validation';

export const runtime = "nodejs";
export const maxDuration = 300; // allow 5 mins on Vercel Pro if available, though Hobby is 10s usually

export async function GET(request: Request) {
  const authError = requireCronAuth(request);
  if (authError) return authError;

  const allUsers = await db.query.users.findMany({
    where: eq(users.dayCheckinEnabled, true)
  });

  let processed = 0;
  let sent = 0;
  let skipped = 0;
  let errors = 0;
  let expiredSubscriptions = 0;

  const prayersList: PrayerName[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

  for (const user of allUsers) {
    processed++;
    try {
      const localDate = getUserLocalDate(user.timezone);
      
      const subs = await db.query.pushSubscriptions.findMany({
        where: eq(pushSubscriptions.userId, user.id)
      });

      if (subs.length === 0) {
        skipped++;
        continue; // No push subscriptions, skip
      }

      const isExcusedToday = isDateInExcusedRange(
        localDate,
        parseStoredExcusedRanges(user.excusedRanges)
      );

      if (isExcusedToday) {
        const uniqueKey = `${user.id}:${localDate}:day_checkin:excused`;
        const existingLog = await db.query.notificationLogs.findFirst({
          where: eq(notificationLogs.uniqueKey, uniqueKey)
        });

        if (existingLog) {
          skipped++;
          continue;
        }

        const payload = {
          title: "Stay connected today",
          body: "Your cycle excuse period is active. Take care of yourself, make dua, and stay close to Allah through dhikr and Wird when you can.",
          payload: {
            url: "/",
            type: "cycle_excused_morning"
          }
        };

        const delivery = await sendCronPushNotifications({
          userId: user.id,
          subscriptions: subs,
          payload,
        });
        expiredSubscriptions += delivery.expiredSubscriptions;

        if (delivery.sentToAtLeastOne) {
          await db.insert(notificationLogs).values({
            userId: user.id,
            uniqueKey,
            type: "day_checkin",
          });
          sent++;
        } else if (delivery.failures > 0) {
          errors++;
        } else {
          skipped++;
        }

        continue;
      }

      // Load today's logs
      const todaysLogs = await db.query.prayerLogs.findMany({
        where: and(
          eq(prayerLogs.userId, user.id),
          eq(prayerLogs.date, localDate)
        )
      });

      // Find the first unconfirmed prayer
      let targetPrayer: PrayerName | null = null;
      for (const p of prayersList) {
        const log = todaysLogs.find(l => l.prayerName.toLowerCase() === p);
        if (!log || log.status === 'missed') {
            // missed means it was marked as Qaza. Wait, if it's missed, it is "confirmed" as missed.
            // if log doesn't exist, it is unconfirmed.
            // If log exists and is 'missed' or 'excused' or 'completed', it's confirmed.
            if (!log) {
                targetPrayer = p;
                break;
            }
        }
      }

      if (!targetPrayer) {
        skipped++;
        continue;
      }

      const uniqueKey = `${user.id}:${localDate}:day_checkin:${targetPrayer}`;
      
      // Idempotency check
      const existingLog = await db.query.notificationLogs.findFirst({
        where: eq(notificationLogs.uniqueKey, uniqueKey)
      });

      if (existingLog) {
        skipped++;
        continue;
      }

      const prayerTitle = targetPrayer.charAt(0).toUpperCase() + targetPrayer.slice(1);

      // Build payload
      const payload = {
        title: `Did you pray ${prayerTitle}?`,
        body: `Quick check-in: mark it prayed if you completed it, or add it to Qaza if you missed it.`,
        payload: {
          url: `/?checkin=${targetPrayer}&date=${localDate}`,
          prayerName: targetPrayer,
          date: localDate,
          type: "prayer_checkin",
          tokens: {
            completed: createNotificationActionToken({
              userId: user.id,
              prayerName: targetPrayer,
              date: localDate,
              action: "completed",
            }),
            missed: createNotificationActionToken({
              userId: user.id,
              prayerName: targetPrayer,
              date: localDate,
              action: "missed",
            }),
          },
        }
      };

      const delivery = await sendCronPushNotifications({
        userId: user.id,
        subscriptions: subs,
        payload,
      });
      expiredSubscriptions += delivery.expiredSubscriptions;

      if (delivery.sentToAtLeastOne) {
        await db.insert(notificationLogs).values({
          userId: user.id,
          uniqueKey,
          type: "day_checkin",
        });
        sent++;
      } else if (delivery.failures > 0) {
        errors++;
      } else {
        skipped++;
      }
    } catch (e) {
      console.error("Error processing user", user.id, e);
      errors++;
    }
  }

  return NextResponse.json({ ok: true, processed, sent, skipped, errors, expiredSubscriptions });
}
