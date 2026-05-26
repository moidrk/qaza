import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readJsonBody, requireSameOriginMutation } from "@/lib/route-security"

describe("route security helpers", () => {
  it("allows same-origin mutation requests", () => {
    const request = new Request("https://qaza.example/api/push", {
      method: "POST",
      headers: {
        origin: "https://qaza.example",
        "sec-fetch-site": "same-origin",
      },
    })

    assert.equal(requireSameOriginMutation(request), null)
  })

  it("rejects cross-origin mutation requests", async () => {
    const request = new Request("https://qaza.example/api/push", {
      method: "POST",
      headers: {
        origin: "https://attacker.example",
      },
    })

    const response = requireSameOriginMutation(request)
    assert.equal(response?.status, 403)
  })

  it("rejects oversized JSON bodies", async () => {
    const request = new Request("https://qaza.example/api/push", {
      method: "POST",
      body: JSON.stringify({ value: "too large" }),
    })

    const result = await readJsonBody(request, 4)
    assert.equal(result.success, false)
    if (!result.success) {
      assert.equal(result.response.status, 413)
    }
  })

  it("parses valid JSON bodies", async () => {
    const request = new Request("https://qaza.example/api/push", {
      method: "POST",
      body: JSON.stringify({ ok: true }),
    })

    const result = await readJsonBody(request)
    assert.deepEqual(result, { success: true, data: { ok: true } })
  })
})
