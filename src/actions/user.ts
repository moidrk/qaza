"use server"

import { db } from "@/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { applyExcusedRangesToExistingPrayers } from "@/lib/prayer-writes"
import {
  excusedRangeSchema,
  geolocationSchema,
  getZodError,
  qazaPaceSchema,
  userPreferencesSchema,
} from "@/lib/validation"
import { z } from "zod"

function parseJsonValue<T>(value: string | null, schema: z.ZodType<T>, fallback: T) {
  if (!value) return fallback

  try {
    return schema.parse(JSON.parse(value))
  } catch {
    return fallback
  }
}

export async function getUserPreferences() {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }
  
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: {
        latitude: true,
        longitude: true,
        timezone: true,
        calcMethod: true,
        asrMethod: true,
        trackWitr: true,
        qazaPace: true,
        excusedRanges: true,
      }
    })
    
    if (!user) return { error: "User not found" }
    
    return {
      success: true,
      data: {
        ...user,
        qazaPace: parseJsonValue(user.qazaPace, qazaPaceSchema.nullable(), null),
        excusedRanges: parseJsonValue(user.excusedRanges, z.array(excusedRangeSchema), []),
      }
    }
  } catch (e) {
    console.error(e)
    return { error: "Failed to fetch user preferences" }
  }
}

export async function updateUserPreferences(data: unknown) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }

  const parsed = userPreferencesSchema.safeParse(data)
  if (!parsed.success) {
    return { error: getZodError(parsed.error) }
  }

  const updateData: {
    calcMethod?: number
    asrMethod?: number
    trackWitr?: boolean
    qazaPace?: string | null
    excusedRanges?: string
  } = {}

  if (parsed.data.calcMethod !== undefined) updateData.calcMethod = parsed.data.calcMethod
  if (parsed.data.asrMethod !== undefined) updateData.asrMethod = parsed.data.asrMethod
  if (parsed.data.trackWitr !== undefined) updateData.trackWitr = parsed.data.trackWitr
  if (parsed.data.qazaPace !== undefined) updateData.qazaPace = parsed.data.qazaPace ? JSON.stringify(parsed.data.qazaPace) : null
  if (parsed.data.excusedRanges !== undefined) updateData.excusedRanges = JSON.stringify(parsed.data.excusedRanges)

  try {
    await db.update(users).set(updateData).where(eq(users.id, session.user.id))
    if (parsed.data.excusedRanges !== undefined) {
      await applyExcusedRangesToExistingPrayers(session.user.id, parsed.data.excusedRanges)
    }
    revalidatePath("/")
    revalidatePath("/settings")
    revalidatePath("/qaza")
    revalidatePath("/analytics")
    return { success: true }
  } catch (e) {
    console.error(e)
    return { error: "Failed to update user preferences" }
  }
}

export async function updateUserLocation(lat: number, lng: number, timezone: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }

  const parsed = geolocationSchema.safeParse({ lat, lng, timezone })
  if (!parsed.success) {
    return { error: getZodError(parsed.error) }
  }

  try {
    await db.update(users).set({
      latitude: parsed.data.lat,
      longitude: parsed.data.lng,
      timezone: parsed.data.timezone,
    }).where(eq(users.id, session.user.id))
    
    revalidatePath("/")
    revalidatePath("/settings")
    return { success: true }
  } catch (e) {
    console.error(e)
    return { error: "Failed to update location" }
  }
}

export async function updatePwaInstalled(installed: boolean) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }

  const parsed = z.boolean().safeParse(installed)
  if (!parsed.success) {
    return { error: "Invalid install status" }
  }

  try {
    await db.update(users).set({ pwaInstalled: parsed.data }).where(eq(users.id, session.user.id))
    revalidatePath("/")
    return { success: true }
  } catch (e) {
    console.error(e)
    return { error: "Failed to update install status" }
  }
}
