import type { ExcusedRange, QazaPace } from "@/lib/validation"

export type UserPreferencesDTO = {
  latitude: number | null
  longitude: number | null
  timezone: string | null
  calcMethod: number | null
  asrMethod: number | null
  trackWitr: boolean | null
  qazaPace: QazaPace | null
  excusedRanges: ExcusedRange[]
}
