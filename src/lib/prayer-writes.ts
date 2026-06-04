import { and, eq, gte, inArray, lte } from "drizzle-orm"
import { db } from "@/db"
import { prayerLogs, users } from "@/db/schema"
import {
  isDateInExcusedRange,
  parseStoredExcusedRanges,
  type ExcusedRange,
} from "@/lib/excused-periods"
import type { PrayerName, PrayerStatus } from "@/lib/validation"

const completedStatuses = new Set(["completed", "qaza_completed", "excused"])

function completedAtFor(status: PrayerStatus) {
  return status === "completed" || status === "qaza_completed" ? new Date() : null
}

async function getExcusedRangesForUser(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { excusedRanges: true },
  })

  return parseStoredExcusedRanges(user?.excusedRanges)
}

export async function reconcileExcusedPrayerLogs(input: {
  userId: string
  previousRanges: readonly ExcusedRange[]
  currentRanges: readonly ExcusedRange[]
}) {
  for (const range of input.previousRanges) {
    const staleExcusedLogs = await db.query.prayerLogs.findMany({
      where: and(
        eq(prayerLogs.userId, input.userId),
        eq(prayerLogs.status, "excused"),
        gte(prayerLogs.date, range.start),
        lte(prayerLogs.date, range.end)
      ),
      columns: { id: true, date: true },
    })

    const staleIds = staleExcusedLogs
      .filter((log) => !isDateInExcusedRange(log.date, input.currentRanges))
      .map((log) => log.id)

    if (staleIds.length > 0) {
      await db
        .update(prayerLogs)
        .set({ status: "missed", completedAt: null })
        .where(inArray(prayerLogs.id, staleIds))
    }
  }

  for (const range of input.currentRanges) {
    await db
      .update(prayerLogs)
      .set({ status: "excused", completedAt: null })
      .where(
        and(
          eq(prayerLogs.userId, input.userId),
          gte(prayerLogs.date, range.start),
          lte(prayerLogs.date, range.end),
          eq(prayerLogs.status, "missed")
        )
      )
  }
}

export async function upsertPrayerStatus(input: {
  userId: string
  prayerName: PrayerName
  date: string
  status: PrayerStatus
}) {
  await db
    .insert(prayerLogs)
    .values({
      userId: input.userId,
      prayerName: input.prayerName,
      date: input.date,
      status: input.status,
      completedAt: completedAtFor(input.status),
    })
    .onConflictDoUpdate({
      target: [prayerLogs.userId, prayerLogs.date, prayerLogs.prayerName],
      set: {
        status: input.status,
        completedAt: completedAtFor(input.status),
      },
    })
}

export async function markPrayerCompleted(input: {
  userId: string
  prayerName: PrayerName
  date: string
}) {
  const excusedRanges = await getExcusedRangesForUser(input.userId)
  if (isDateInExcusedRange(input.date, excusedRanges)) {
    await upsertPrayerStatus({
      userId: input.userId,
      prayerName: input.prayerName,
      date: input.date,
      status: "excused",
    })
    return
  }

  const existing = await db.query.prayerLogs.findFirst({
    where: and(
      eq(prayerLogs.userId, input.userId),
      eq(prayerLogs.date, input.date),
      eq(prayerLogs.prayerName, input.prayerName)
    ),
  })

  if (existing) {
    if (!completedStatuses.has(existing.status)) {
      await db
        .update(prayerLogs)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(prayerLogs.id, existing.id))
    }
    return
  }

  await db
    .insert(prayerLogs)
    .values({
      userId: input.userId,
      prayerName: input.prayerName,
      date: input.date,
      status: "completed",
      completedAt: new Date(),
    })
    .onConflictDoNothing({
      target: [prayerLogs.userId, prayerLogs.date, prayerLogs.prayerName],
    })
}

export async function markPrayerMissed(input: {
  userId: string
  prayerName: PrayerName
  date: string
}) {
  const excusedRanges = await getExcusedRangesForUser(input.userId)
  if (isDateInExcusedRange(input.date, excusedRanges)) {
    await upsertPrayerStatus({
      userId: input.userId,
      prayerName: input.prayerName,
      date: input.date,
      status: "excused",
    })
    return
  }

  await upsertPrayerStatus({
    userId: input.userId,
    prayerName: input.prayerName,
    date: input.date,
    status: "missed",
  })
}
