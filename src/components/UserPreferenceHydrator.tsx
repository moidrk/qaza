"use client"

import { useEffect } from "react"
import { useAppStore } from "@/store"
import type { UserPreferencesDTO } from "@/lib/user-preferences"

export function UserPreferenceHydrator({ preferences }: { preferences: UserPreferencesDTO | null }) {
  const setUserLocation = useAppStore((state) => state.setUserLocation)
  const setCalcMethod = useAppStore((state) => state.setCalcMethod)
  const setAsrMethod = useAppStore((state) => state.setAsrMethod)
  const setTrackWitr = useAppStore((state) => state.setTrackWitr)
  const setExcusedRanges = useAppStore((state) => state.setExcusedRanges)
  const setQazaPace = useAppStore((state) => state.setQazaPace)

  useEffect(() => {
    if (!preferences) return

    if (preferences.latitude !== null && preferences.longitude !== null) {
      setUserLocation({ lat: preferences.latitude, lng: preferences.longitude })
    }
    if (preferences.calcMethod !== null) setCalcMethod(preferences.calcMethod)
    if (preferences.asrMethod !== null) setAsrMethod(preferences.asrMethod)
    if (preferences.trackWitr !== null) setTrackWitr(preferences.trackWitr)
    setExcusedRanges(preferences.excusedRanges)
    setQazaPace(preferences.qazaPace)
  }, [preferences, setUserLocation, setCalcMethod, setAsrMethod, setTrackWitr, setExcusedRanges, setQazaPace])

  return null
}
