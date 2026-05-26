import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { readJsonBody, requireSameOriginMutation } from "@/lib/route-security"
import { getZodError, pushLogSchema } from "@/lib/validation"
import { markPrayerMissed, upsertPrayerStatus } from "@/lib/prayer-writes"

export async function POST(req: Request) {
  try {
    const originError = requireSameOriginMutation(req)
    if (originError) return originError

    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await readJsonBody(req)
    if (!body.success) return body.response

    const parsed = pushLogSchema.safeParse(body.data)
    if (!parsed.success) {
      return NextResponse.json({ error: getZodError(parsed.error) }, { status: 400 })
    }

    const { prayerName, status, date } = parsed.data

    if (status === "missed") {
      await markPrayerMissed({ userId: session.user.id, prayerName, date })
    } else {
      await upsertPrayerStatus({ userId: session.user.id, prayerName, date, status })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error logging from push:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
