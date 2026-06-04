import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, pushSubscriptions, notificationLogs, prayerLogs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getUserLocalDate } from '@/lib/date-utils';
import { requireCronAuth } from '@/lib/cron-auth';
import { sendCronPushNotifications } from '@/lib/cron-push';
import { isDateInExcusedRange, parseStoredExcusedRanges } from '@/lib/excused-periods';

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const authError = requireCronAuth(request);
  if (authError) return authError;

  const allUsers = await db.query.users.findMany({
    where: eq(users.nightSummaryEnabled, true)
  });

  let processed = 0;
  let sent = 0;
  let skipped = 0;
  let errors = 0;
  let expiredSubscriptions = 0;

  for (const user of allUsers) {
    processed++;
    try {
      const localDate = getUserLocalDate(user.timezone);
      
      const subs = await db.query.pushSubscriptions.findMany({
        where: eq(pushSubscriptions.userId, user.id)
      });

      if (subs.length === 0) {
        skipped++;
        continue;
      }

      const uniqueKey = `${user.id}:${localDate}:night_summary`;
      const existingLog = await db.query.notificationLogs.findFirst({
        where: eq(notificationLogs.uniqueKey, uniqueKey)
      });

      if (existingLog) {
        skipped++;
        continue;
      }

      const isExcusedToday = isDateInExcusedRange(
        localDate,
        parseStoredExcusedRanges(user.excusedRanges)
      );

      if (isExcusedToday) {
        const payload = {
          title: "Take care of yourself tonight",
          body: "Your cycle excuse period is active, so today's prayers are not counted as Qaza. Rest well, make dua, and we will see you back soon.",
          payload: {
            url: "/",
            type: "cycle_excused_night_summary"
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
            type: "night_summary",
          });
          sent++;
        } else if (delivery.failures > 0) {
          errors++;
        } else {
          skipped++;
        }

        continue;
      }

      const todaysLogs = await db.query.prayerLogs.findMany({
        where: and(
          eq(prayerLogs.userId, user.id),
          eq(prayerLogs.date, localDate)
        )
      });

      const prayed = todaysLogs.filter(l => l.status === 'completed' || l.status === 'qaza_completed' || l.status === 'excused');
      const missed = todaysLogs.filter(l => l.status === 'missed' || l.status === 'qaza');
      
      const prayedNames = prayed.map(l => l.prayerName.charAt(0).toUpperCase() + l.prayerName.slice(1));
      const missedNames = missed.map(l => l.prayerName.charAt(0).toUpperCase() + l.prayerName.slice(1));
      
      const totalRequired = user.trackWitr ? 6 : 5;
      const allDone = prayed.length >= totalRequired;

      let title = "Today's Qaza summary";
      let body = "";

      if (allDone) {
        title = "Alhamdulillah, all prayers completed";
        body = "You prayed all your namazein today. Keep it going tomorrow and protect your streak.";
      } else if (missed.length > 0 && prayed.length > 0) {
        const pList = prayedNames.join(", ");
        const mList = missedNames.join(", ");
        body = `You prayed ${pList}. ${mList} are pending as Qaza. Take a small step before sleeping.`;
      } else if (missed.length > 0 && prayed.length === 0) {
        body = `It was a tough day. Don't worry, start fresh tomorrow and log these as Qaza so you can catch up slowly.`;
      } else {
        body = "Some prayers are still unconfirmed today. Review them now so your Qaza record stays accurate.";
      }

      const payload = {
        title,
        body,
        payload: {
          url: `/?date=${localDate}`,
          type: "night_summary"
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
          type: "night_summary",
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
