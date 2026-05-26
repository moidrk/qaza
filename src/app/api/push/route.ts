import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { savePushSubscriptionForUser } from "@/lib/push-subscriptions"
import { readJsonBody, requireSameOriginMutation } from "@/lib/route-security"
import { getZodError, pushSubscribeBodySchema } from "@/lib/validation"

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

    const parsed = pushSubscribeBodySchema.safeParse(body.data)
    if (!parsed.success) {
      return NextResponse.json({ error: getZodError(parsed.error) }, { status: 400 })
    }

    const { subscription } = parsed.data

    await savePushSubscriptionForUser(session.user.id, subscription)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error saving subscription", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
