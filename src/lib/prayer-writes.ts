import "server-only"

import { and, eq, sql } from "drizzle-orm"
import { db } from "@/db"
import { prayerLogs, qazaItems } from "@/db/schema"
import type { PrayerName, PrayerStatus } from "@/lib/validation"

const completedStatuses = new Set(["completed", "qaza_completed", "excused"])

function completedAtFor(status: PrayerStatus) {
  return status === "completed" || status === "qaza_completed" ? new Date() : null
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

export async function upsertPrayerStatuses(inputs: {
  userId: string
  prayerName: PrayerName
  date: string
  status: PrayerStatus
}[]) {
  if (inputs.length === 0) return

  await db
    .insert(prayerLogs)
    .values(
      inputs.map((input) => ({
        userId: input.userId,
        prayerName: input.prayerName,
        date: input.date,
        status: input.status,
        completedAt: completedAtFor(input.status),
      }))
    )
    .onConflictDoUpdate({
      target: [prayerLogs.userId, prayerLogs.date, prayerLogs.prayerName],
      set: {
        status: sql`excluded."status"`,
        completedAt: sql`excluded."completedAt"`,
      },
    })
}

export async function markPrayerCompleted(input: {
  userId: string
  prayerName: PrayerName
  date: string
}) {
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
