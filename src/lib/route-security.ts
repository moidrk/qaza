import "server-only"

import { NextResponse } from "next/server"

const DEFAULT_MAX_JSON_BYTES = 16 * 1024

export function requireSameOriginMutation(request: Request) {
  const requestOrigin = new URL(request.url).origin
  const origin = request.headers.get("origin")
  if (origin && origin !== requestOrigin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const fetchSite = request.headers.get("sec-fetch-site")
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return null
}

export async function readJsonBody(request: Request, maxBytes = DEFAULT_MAX_JSON_BYTES) {
  const contentLength = request.headers.get("content-length")
  if (contentLength && Number(contentLength) > maxBytes) {
    return {
      success: false as const,
      response: NextResponse.json({ error: "Request body too large" }, { status: 413 }),
    }
  }

  const body = await request.text()
  if (new TextEncoder().encode(body).byteLength > maxBytes) {
    return {
      success: false as const,
      response: NextResponse.json({ error: "Request body too large" }, { status: 413 }),
    }
  }

  try {
    return { success: true as const, data: JSON.parse(body) as unknown }
  } catch {
    return {
      success: false as const,
      response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    }
  }
}
