export type ExcusedRange = {
  start: string
  end: string
}

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !isoDatePattern.test(value)) {
    return false
  }

  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function normalizeExcusedRanges(value: unknown): ExcusedRange[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((range): range is ExcusedRange => {
    if (!range || typeof range !== "object") {
      return false
    }

    const candidate = range as Partial<ExcusedRange>
    return isIsoDate(candidate.start) && isIsoDate(candidate.end) && candidate.start <= candidate.end
  })
}

export function parseStoredExcusedRanges(value: string | null | undefined): ExcusedRange[] {
  if (!value) {
    return []
  }

  try {
    return normalizeExcusedRanges(JSON.parse(value))
  } catch {
    return []
  }
}

export function isDateInExcusedRange(date: string, ranges: readonly ExcusedRange[]) {
  return isIsoDate(date) && ranges.some((range) => date >= range.start && date <= range.end)
}
