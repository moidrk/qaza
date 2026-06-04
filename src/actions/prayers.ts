"use server"

import { and, eq, count, gte, inArray } from "drizzle-orm"
import { qazaItems, prayerLogs, users } from "@/db/schema"
import { db } from "@/db"
import { auth } from "@/auth"
import {
  getZodError,
  isoDateSchema,
  prayerNameSchema,
  qazaAmountSchema,
  syncPrayerMutationListSchema,
  type PrayerName,
  type PrayerStatus,
} from "@/lib/validation"
import { markPrayerMissed, upsertPrayerStatus } from "@/lib/prayer-writes"
import { isDateInExcusedRange, parseStoredExcusedRanges } from "@/lib/excused-periods"
import { z } from "zod"

export async function getTodayPrayers(dateStr?: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }

  const targetDate = dateStr || new Date().toISOString().split('T')[0];
  const parsedDate = isoDateSchema.safeParse(targetDate)
  if (!parsedDate.success) {
    return { error: getZodError(parsedDate.error) }
  }
  
  try {
    const logs = await db.query.prayerLogs.findMany({
      where: and(
        eq(prayerLogs.userId, session.user.id),
        eq(prayerLogs.date, parsedDate.data)
      )
    });
    return { success: true, data: logs };
  } catch {
    return { error: "Failed to fetch" };
  }
}

export async function getQazaStats() {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }

  const userId = session.user.id;
  
  // Implicitly run auto-backfill whenever we fetch qaza stats!
  await autoBackfillMissedPrayers(userId);

  try {
    const [
      qazaCounts,
      manualQazaCounts,
      completedPrayerLogs,
      completedManualQaza,
      user
    ] = await Promise.all([
      db.select({
        prayerName: prayerLogs.prayerName,
        count: count(),
      }).from(prayerLogs)
        .where(and(eq(prayerLogs.userId, userId), inArray(prayerLogs.status, ["missed", "qaza_completed"])))
        .groupBy(prayerLogs.prayerName),
      
      db.select({
        prayerName: qazaItems.prayerName,
        count: count(),
      }).from(qazaItems)
        .where(eq(qazaItems.userId, userId))
        .groupBy(qazaItems.prayerName),
        
      db.select({
        prayerName: prayerLogs.prayerName,
        count: count(),
      }).from(prayerLogs)
        .where(and(eq(prayerLogs.userId, userId), eq(prayerLogs.status, "qaza_completed")))
        .groupBy(prayerLogs.prayerName),
        
      db.select({
        prayerName: qazaItems.prayerName,
        count: count(),
      }).from(qazaItems)
        .where(and(eq(qazaItems.userId, userId), eq(qazaItems.isCompleted, true)))
        .groupBy(qazaItems.prayerName),
        
      db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { trackWitr: true }
      })
    ]);

    const trackWitrEnabled = user?.trackWitr || false;

    const backlog: Record<string, number> = {
      Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0
    };
    if (trackWitrEnabled) {
      backlog.Witr = 0;
    }
    
    let totalMissed = 0;
    let totalCovered = 0;

    qazaCounts.forEach(q => {
      const name = q.prayerName.charAt(0).toUpperCase() + q.prayerName.slice(1);
      if (name in backlog) {
        backlog[name] += q.count;
        totalMissed += q.count;
      }
    });

    manualQazaCounts.forEach(q => {
      const name = q.prayerName.charAt(0).toUpperCase() + q.prayerName.slice(1);
      if (name in backlog) {
        backlog[name] += q.count;
        totalMissed += q.count;
      }
    });

    completedPrayerLogs.forEach(q => {
      const name = q.prayerName.charAt(0).toUpperCase() + q.prayerName.slice(1);
      if (name in backlog) {
        backlog[name] -= q.count;
        totalCovered += q.count;
      }
    });

    completedManualQaza.forEach(q => {
      const name = q.prayerName.charAt(0).toUpperCase() + q.prayerName.slice(1);
      if (name in backlog) {
        backlog[name] -= q.count;
        totalCovered += q.count;
      }
    });

    // Weekly stats
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateStr = sevenDaysAgo.toISOString().split('T')[0];

    // Today's completed Qaza count (local timezone safe)
    const today = new Date();
    const offset = today.getTimezoneOffset() * 60000;
    const localDate = new Date(today.getTime() - offset);
    const todayStr = localDate.toISOString().split('T')[0];
    const startOfToday = new Date(localDate.setHours(0, 0, 0, 0));

    const [weeklyMissed, todayCompletedQaza, todayCompletedManual] = await Promise.all([
      db.select({ count: count() })
        .from(prayerLogs)
        .where(and(
          eq(prayerLogs.userId, userId),
          inArray(prayerLogs.status, ["missed", "qaza_completed"]),
          gte(prayerLogs.date, dateStr)
        )),
        
      db.select({ count: count() })
        .from(prayerLogs)
        .where(and(
          eq(prayerLogs.userId, userId),
          eq(prayerLogs.status, "qaza_completed"),
          eq(prayerLogs.date, todayStr)
        )),
        
      db.select({ count: count() })
        .from(qazaItems)
        .where(and(
          eq(qazaItems.userId, userId),
          eq(qazaItems.isCompleted, true),
          gte(qazaItems.completedAt, startOfToday)
        ))
    ]);

    const todayCompletedCount = (todayCompletedQaza[0]?.count || 0) + (todayCompletedManual[0]?.count || 0);

    return { 
      success: true, 
      data: {
        backlog,
        donut: { totalMissed, totalCovered, remaining: totalMissed - totalCovered },
        weeklyMissed: weeklyMissed[0]?.count || 0,
        todayCompletedCount
      } 
    };
  } catch {
    return { error: "Failed to fetch" };
  }
}

export async function updateBulkQaza(prayerName: string, amount: number) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }
  const userId = session.user.id;

  const parsedPrayer = prayerNameSchema.safeParse(prayerName)
  if (!parsedPrayer.success) {
    return { error: getZodError(parsedPrayer.error) }
  }

  const parsedAmount = qazaAmountSchema.safeParse(amount)
  if (!parsedAmount.success) {
    return { error: getZodError(parsedAmount.error) }
  }

  try {
    const pNameLower = parsedPrayer.data;
    const pNameTitle = pNameLower.charAt(0).toUpperCase() + pNameLower.slice(1);
    const qazaAmount = parsedAmount.data;

    if (qazaAmount > 0) {
      const values = Array(qazaAmount).fill(0).map(() => ({
        userId,
        prayerName: pNameLower,
        isCompleted: false,
      }));
      const chunkSize = 1000;
      for (let i = 0; i < values.length; i += chunkSize) {
        await db.insert(qazaItems).values(values.slice(i, i + chunkSize));
      }
    } else if (qazaAmount < 0) {
      let remainingToComplete = Math.abs(qazaAmount);

      // First try to tick off specific missed prayers (most recent first)
      const oldestMissedLogs = await db.query.prayerLogs.findMany({
        where: and(
          eq(prayerLogs.userId, userId),
          inArray(prayerLogs.prayerName, [pNameLower, pNameTitle]),
          eq(prayerLogs.status, "missed")
        ),
        orderBy: (logs, { desc }) => [desc(logs.date)],
        limit: remainingToComplete
      });

      if (oldestMissedLogs.length > 0) {
        const ids = oldestMissedLogs.map(l => l.id);
        await db.update(prayerLogs)
          .set({ status: "qaza_completed", completedAt: new Date() })
          .where(inArray(prayerLogs.id, ids));
          
        remainingToComplete -= oldestMissedLogs.length;
      }

      // If still remaining, tick off from historic bulk backlog
      if (remainingToComplete > 0) {
        const toComplete = await db.query.qazaItems.findMany({
          where: and(
            eq(qazaItems.userId, userId), 
            inArray(qazaItems.prayerName, [pNameLower, pNameTitle]), 
            eq(qazaItems.isCompleted, false)
          ),
          limit: remainingToComplete
        });
        if (toComplete.length > 0) {
          const ids = toComplete.map(t => t.id);
          await db.update(qazaItems)
            .set({ isCompleted: true, completedAt: new Date() })
            .where(inArray(qazaItems.id, ids));
        }
      }
    }
    return { success: true }
  } catch {
    return { error: "Failed to update" }
  }
}

export async function getWeeklyConsistency(clientDateStr?: string, daysBack: number = 7) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }

  const userId = session.user.id;
  
  const todayStr = clientDateStr || new Date().toISOString().split('T')[0];
  const parsedToday = isoDateSchema.safeParse(todayStr)
  if (!parsedToday.success) {
    return { error: getZodError(parsedToday.error) }
  }

  const parsedDaysBack = z.coerce.number().int().min(1).max(31).safeParse(daysBack)
  if (!parsedDaysBack.success) {
    return { error: getZodError(parsedDaysBack.error) }
  }

  const todayDate = new Date(parsedToday.data); // Parses strictly as midnight UTC
  
  const startDateObj = new Date(todayDate);
  startDateObj.setUTCDate(startDateObj.getUTCDate() - (parsedDaysBack.data - 1));
  const dateStr = startDateObj.toISOString().split('T')[0];

  try {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    const joinDate = user ? new Date(user.createdAt) : new Date();
    const joinDateStr = joinDate.toISOString().split('T')[0];
    const trackWitrEnabled = user?.trackWitr || false;
    const excusedRanges = parseStoredExcusedRanges(user?.excusedRanges);

    const isDateExcused = (dStr: string) => {
      return isDateInExcusedRange(dStr, excusedRanges);
    };

    const logs = await db.query.prayerLogs.findMany({
      where: and(
        eq(prayerLogs.userId, userId),
        inArray(prayerLogs.status, ["completed", "qaza_completed"]),
        gte(prayerLogs.date, dateStr)
      )
    });

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const consistency: { name: string, date: string, prayers: number, isExcused: boolean, requiredCount: number }[] = [];

    for (let i = parsedDaysBack.data - 1; i >= 0; i--) {
      const d = new Date(todayDate);
      d.setUTCDate(d.getUTCDate() - i);
      const dStr = d.toISOString().split('T')[0];
      
      // Only include days starting from the user's join date
      if (dStr >= joinDateStr) {
        consistency.push({
          name: dayNames[d.getUTCDay()],
          date: dStr,
          prayers: 0,
          isExcused: isDateExcused(dStr),
          requiredCount: trackWitrEnabled ? 6 : 5
        });
      }
    }

    logs.forEach(log => {
      const dayObj = consistency.find(d => d.date === log.date);
      if (dayObj) {
        dayObj.prayers += 1;
      }
    });

    return { success: true, data: consistency };
  } catch {
    return { error: "Failed to fetch" };
  }
}

export async function syncPrayerMutations(mutations: unknown) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }

  const userId = session.user.id;

  const parsedMutations = syncPrayerMutationListSchema.safeParse(mutations)
  if (!parsedMutations.success) {
    return { error: getZodError(parsedMutations.error) }
  }

  try {
    // Process unique mutations only (last one wins for the same prayer and date)
    const latestMutations = new Map<string, {
      prayerName: PrayerName
      date: string
      status: PrayerStatus
    }>();

    for (const mut of parsedMutations.data) {
      const key = `${mut.payload.prayerName}-${mut.payload.date}`;
      latestMutations.set(key, mut.payload);
    }

    for (const payload of latestMutations.values()) {
      const { prayerName, date, status } = payload;
      if (status === "missed") {
        await markPrayerMissed({ userId, prayerName, date });
      } else {
        await upsertPrayerStatus({ userId, prayerName, date, status });
      }
    }
    return { success: true };
  } catch (error) {
    console.error("Failed to sync mutations", error);
    return { error: "Failed to sync" };
  }
}

async function autoBackfillMissedPrayers(userId: string) {
  try {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) return { error: "User not found" };

    const startDate = new Date(user.createdAt);
    // Set to start of the day in local time/UTC so it correctly compares with yesterday
    startDate.setHours(0, 0, 0, 0);
    
    // Safety check: Don't backfill more than 30 days at once to prevent timeouts
    const maxBackfillDate = new Date();
    maxBackfillDate.setHours(0, 0, 0, 0);
    maxBackfillDate.setDate(maxBackfillDate.getDate() - 30);
    if (startDate < maxBackfillDate) {
      startDate.setTime(maxBackfillDate.getTime());
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (startDate > yesterday) return { success: true };

    const startStr = startDate.toISOString().split('T')[0];

    const logs = await db.query.prayerLogs.findMany({
      where: and(
        eq(prayerLogs.userId, userId),
        gte(prayerLogs.date, startStr)
      )
    });

    const existingSet = new Set<string>();
    logs.forEach(l => existingSet.add(`${l.date}-${l.prayerName.toLowerCase()}`));

    const prayers: PrayerName[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
    if (user.trackWitr) {
      prayers.push("witr");
    }

    const excusedRanges = parseStoredExcusedRanges(user.excusedRanges);
    const isDateExcused = (dStr: string) => {
      return isDateInExcusedRange(dStr, excusedRanges);
    };

    const missing: { userId: string, prayerName: PrayerName, date: string, status: PrayerStatus }[] = [];

    const current = new Date(startDate);
    while (current <= yesterday) {
      const dStr = current.toISOString().split('T')[0];
      prayers.forEach(p => {
        if (!existingSet.has(`${dStr}-${p}`)) {
          const excused = isDateExcused(dStr);
          missing.push({
            userId,
            prayerName: p,
            date: dStr,
            status: excused ? "excused" : "missed"
          });
        }
      });
      current.setDate(current.getDate() + 1);
    }

    if (missing.length > 0) {
      const chunkSize = 1000;
      for (let i = 0; i < missing.length; i += chunkSize) {
        await db.insert(prayerLogs)
          .values(missing.slice(i, i + chunkSize))
          .onConflictDoNothing({
            target: [prayerLogs.userId, prayerLogs.date, prayerLogs.prayerName],
          });
      }
    }

    return { success: true, count: missing.length };
  } catch (error) {
    console.error("Backfill error:", error);
    return { error: "Failed to backfill" };
  }
}

export async function getDetailedQaza(prayerName: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }
  const userId = session.user.id;

  const parsedPrayer = prayerNameSchema.safeParse(prayerName)
  if (!parsedPrayer.success) {
    return { error: getZodError(parsedPrayer.error) }
  }

  try {
    const pNameLower = parsedPrayer.data;
    const pNameTitle = pNameLower.charAt(0).toUpperCase() + pNameLower.slice(1);

    const logs = await db.query.prayerLogs.findMany({
      where: and(
        eq(prayerLogs.userId, userId),
        inArray(prayerLogs.prayerName, [pNameLower, pNameTitle]),
        eq(prayerLogs.status, "missed")
      ),
      orderBy: (prayerLogs, { desc }) => [desc(prayerLogs.date)]
    });

    const items = await db.query.qazaItems.findMany({
      where: and(
        eq(qazaItems.userId, userId),
        inArray(qazaItems.prayerName, [pNameLower, pNameTitle]),
        eq(qazaItems.isCompleted, false)
      )
    });

    let bulkCount = 0;
    const specificDates: { id: string, date: string, type: 'log' | 'item' }[] = [];

    logs.forEach(l => {
      specificDates.push({ id: l.id, date: l.date, type: 'log' });
    });

    items.forEach(i => {
      if (i.dateMissed) {
        specificDates.push({ id: i.id, date: i.dateMissed, type: 'item' });
      } else {
        bulkCount++;
      }
    });

    // Sort descending by date
    specificDates.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { success: true, data: { bulkCount, specificDates } };
  } catch {
    return { error: "Failed to fetch detailed qaza" };
  }
}

export async function completeDetailedQaza(id: string, type: 'log' | 'item') {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }
  const userId = session.user.id;

  const parsedInput = z.object({
    id: z.string().uuid(),
    type: z.enum(["log", "item"]),
  }).safeParse({ id, type })

  if (!parsedInput.success) {
    return { error: getZodError(parsedInput.error) }
  }

  try {
    if (parsedInput.data.type === 'log') {
      await db.update(prayerLogs)
        .set({ status: 'qaza_completed', completedAt: new Date() })
        .where(and(eq(prayerLogs.id, parsedInput.data.id), eq(prayerLogs.userId, userId)));
    } else {
      await db.update(qazaItems)
        .set({ isCompleted: true, completedAt: new Date() })
        .where(and(eq(qazaItems.id, parsedInput.data.id), eq(qazaItems.userId, userId)));
    }
    return { success: true };
  } catch {
    return { error: "Failed to complete" };
  }
}

export async function getPrayerInsights() {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }
  const userId = session.user.id;
  
  try {
    const [completedCounts, missedLogs, missedItems, user] = await Promise.all([
      db.select({
        prayerName: prayerLogs.prayerName,
        count: count(),
      }).from(prayerLogs)
        .where(and(eq(prayerLogs.userId, userId), inArray(prayerLogs.status, ["completed", "qaza_completed"])))
        .groupBy(prayerLogs.prayerName),
        
      db.select({
        prayerName: prayerLogs.prayerName,
        count: count(),
      }).from(prayerLogs)
        .where(and(eq(prayerLogs.userId, userId), eq(prayerLogs.status, "missed")))
        .groupBy(prayerLogs.prayerName),
        
      db.select({
        prayerName: qazaItems.prayerName,
        count: count(),
      }).from(qazaItems)
        .where(and(eq(qazaItems.userId, userId), eq(qazaItems.isCompleted, false)))
        .groupBy(qazaItems.prayerName),
        
      db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { trackWitr: true }
      })
    ]);
    const trackWitrEnabled = user?.trackWitr || false;

    const missedMap: Record<string, number> = { Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0 };
    if (trackWitrEnabled) {
      missedMap.Witr = 0;
    }

    missedLogs.forEach(c => {
       const n = c.prayerName.charAt(0).toUpperCase() + c.prayerName.slice(1).toLowerCase();
       if (n in missedMap) missedMap[n] += c.count;
    });
    missedItems.forEach(c => {
       const n = c.prayerName.charAt(0).toUpperCase() + c.prayerName.slice(1).toLowerCase();
       if (n in missedMap) missedMap[n] += c.count;
    });

    let mostPrayed = { name: "None", count: 0 };
    completedCounts.forEach(c => {
       const n = c.prayerName.charAt(0).toUpperCase() + c.prayerName.slice(1);
       if (c.count > mostPrayed.count) {
          mostPrayed = { name: n, count: c.count };
       }
    });

    let mostMissed = { name: "None", count: 0 };
    Object.entries(missedMap).forEach(([name, count]) => {
       if (count > mostMissed.count) {
          mostMissed = { name, count };
       }
    });

    return { success: true, data: { mostPrayed, mostMissed } };
  } catch {
    return { error: "Failed to fetch insights" };
  }
}

export async function resetAllData() {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }
  const userId = session.user.id;

  try {
    await db.delete(prayerLogs).where(eq(prayerLogs.userId, userId));
    await db.delete(qazaItems).where(eq(qazaItems.userId, userId));
    return { success: true };
  } catch {
    return { error: "Failed to reset data" };
  }
}

