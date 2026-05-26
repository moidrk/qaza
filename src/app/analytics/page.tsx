import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { AnalyticsClient } from "@/components/AnalyticsClient"
import { UserPreferenceHydrator } from "@/components/UserPreferenceHydrator"
import { getPrayerInsights, getWeeklyConsistency } from "@/actions/prayers"
import { getUserPreferences } from "@/actions/user"
import { getUserLocalDate } from "@/lib/date-utils"

export default async function AnalyticsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const preferencesRes = await getUserPreferences()
  const preferences = preferencesRes.success && preferencesRes.data ? preferencesRes.data : null
  const todayStr = getUserLocalDate(preferences?.timezone)
  const [weeklyRes, heatmapRes, insightsRes] = await Promise.all([
    getWeeklyConsistency(todayStr),
    getWeeklyConsistency(todayStr, 30),
    getPrayerInsights(),
  ])

  return (
    <>
      <UserPreferenceHydrator preferences={preferences} />
      <AnalyticsClient
        initialConsistency={weeklyRes.success && weeklyRes.data ? weeklyRes.data : undefined}
        initialHeatmap={heatmapRes.success && heatmapRes.data ? heatmapRes.data : undefined}
        initialInsights={insightsRes.success && insightsRes.data ? insightsRes.data : undefined}
        initialDate={todayStr}
      />
    </>
  )
}
