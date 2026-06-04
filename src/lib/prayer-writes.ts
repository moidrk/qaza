import { and, eq, gte, inArray, lte } from "drizzle-orm"
import { db } from "@/db"
import { prayerLogs, qazaItems, users } from "@/db/schema"
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

async function deleteDateSpecificQaza(input: {
  userId: string
  prayerName: PrayerName
  date: string
}) {
  await db
    .delete(qazaItems)
    .where(
      and(
        eq(qazaItems.userId, input.userId),
        eq(qazaItems.prayerName, input.prayerName),
        eq(qazaItems.dateMissed, input.date)
      )
    )
}

export async function applyExcusedRangesToExistingPrayers(userId: string, ranges: readonly ExcusedRange[]) {
  for (const range of ranges) {
    await db
      .update(prayerLogs)
      .set({ status: "excused", completedAt: null })
      .where(
        and(
          eq(prayerLogs.userId, userId),
          gte(prayerLogs.date, range.start),
          lte(prayerLogs.date, range.end),
          inArray(prayerLogs.status, ["missed", "qaza_completed"])
        )
      )

    await db
      .delete(qazaItems)
      .where(
        and(
          eq(qazaItems.userId, userId),
          gte(qazaItems.dateMissed, range.start),
          lte(qazaItems.dateMissed, range.end)
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
    await deleteDateSpecificQaza(input)
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
    await deleteDateSpecificQaza(input)
    return
  }

  await upsertPrayerStatus({
    userId: input.userId,
    prayerName: input.prayerName,
    date: input.date,
    status: "missed",
  })

  await db
    .insert(qazaItems)
    .values({
      userId: input.userId,
      prayerName: input.prayerName,
      dateMissed: input.date,
      isCompleted: false,
    })
    .onConflictDoNothing({
      target: [qazaItems.userId, qazaItems.dateMissed, qazaItems.prayerName],
    })
}
