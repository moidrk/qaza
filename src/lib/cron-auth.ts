import "server-only"

import { NextResponse } from "next/server"

export function requireCronAuth(request: Request) {
  const secret = process.env.CRON_SECRET

  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      return null
    }

    return NextResponse.json({ error: "Cron secret is not configured" }, { status: 500 })
  }

  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return null
}
