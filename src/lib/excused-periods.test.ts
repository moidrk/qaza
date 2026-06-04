import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isDateInExcusedRange,
  normalizeExcusedRanges,
  parseStoredExcusedRanges,
} from "@/lib/excused-periods"

describe("excused period helpers", () => {
  it("matches dates inclusively inside a cycle range", () => {
    const ranges = [{ start: "2026-06-01", end: "2026-06-07" }]

    assert.equal(isDateInExcusedRange("2026-06-01", ranges), true)
    assert.equal(isDateInExcusedRange("2026-06-04", ranges), true)
    assert.equal(isDateInExcusedRange("2026-06-07", ranges), true)
    assert.equal(isDateInExcusedRange("2026-06-08", ranges), false)
  })

  it("drops invalid or reversed ranges from stored data", () => {
    const ranges = normalizeExcusedRanges([
      { start: "2026-06-01", end: "2026-06-07" },
      { start: "2026-06-10", end: "2026-06-08" },
      { start: "bad", end: "2026-06-09" },
      null,
    ])

    assert.deepEqual(ranges, [{ start: "2026-06-01", end: "2026-06-07" }])
  })

  it("parses saved ranges safely", () => {
    assert.deepEqual(
      parseStoredExcusedRanges('[{"start":"2026-06-01","end":"2026-06-07"}]'),
      [{ start: "2026-06-01", end: "2026-06-07" }]
    )
    assert.deepEqual(parseStoredExcusedRanges("not json"), [])
  })
})
