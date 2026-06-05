"use client"

const WeeklyChart = dynamic(() => import("@/components/WeeklyChart").then(mod => mod.WeeklyChart), { ssr: false })
import { useQuery } from "@tanstack/react-query"
import { Trophy, AlertCircle, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getWeeklyConsistency, getPrayerInsights } from "@/actions/prayers"
import dynamic from "next/dynamic"
const ConsistencyHeatmap = dynamic(() => import("@/components/ConsistencyHeatmap").then(mod => mod.ConsistencyHeatmap), { ssr: false })
import { useMounted } from "@/hooks/useMounted"

type ConsistencyDatum = {
  name: string
  prayers: number
  requiredCount?: number
  isExcused?: boolean
}

const emptyWeek: ConsistencyDatum[] = [
  { name: "Mon", prayers: 0 },
  { name: "Tue", prayers: 0 },
  { name: "Wed", prayers: 0 },
  { name: "Thu", prayers: 0 },
  { name: "Fri", prayers: 0 },
  { name: "Sat", prayers: 0 },
  { name: "Sun", prayers: 0 },
]

export function AnalyticsClient() {
  const mounted = useMounted()

  const today = new Date()
  const offset = today.getTimezoneOffset() * 60000
  const localDate = new Date(today.getTime() - offset)
  const todayStr = localDate.toISOString().split("T")[0]

  const { data: consistencyRes, isLoading } = useQuery({
    queryKey: ["weeklyConsistency", todayStr],
    queryFn: async () => await getWeeklyConsistency(todayStr),
  })

  const data: ConsistencyDatum[] = consistencyRes?.success && consistencyRes.data ? consistencyRes.data : emptyWeek

  const { data: insightsRes } = useQuery({
    queryKey: ["prayerInsights"],
    queryFn: async () => await getPrayerInsights(),
  })

  const mostPrayed = insightsRes?.data?.mostPrayed
  const mostMissed = insightsRes?.data?.mostMissed

  if (isLoading) {
    return <div className="min-h-full flex items-center justify-center bg-background"><div className="animate-pulse h-16 w-16 bg-primary/20 rounded-full" /></div>
  }

  return (
    <main className="flex min-h-full flex-col items-center p-6 bg-background">
      <header className="w-full max-w-md py-6 mb-4 border-b border-border/50 text-center">
        <h1 className="text-2xl font-bold text-foreground">Your Review</h1>
        <p className="text-muted-foreground text-sm mt-1">Alhamdulillah, look at your progress.</p>
      </header>

      <section className="w-full max-w-md space-y-4">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">This Week&apos;s Consistency</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] w-full min-h-[250px] flex items-center justify-center">
            {mounted ? (
              <WeeklyChart data={data} />
            ) : (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg text-primary">Streaks &amp; Motivation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground/80">
              {(() => {
                const todayIdx = data.length - 1
                let streak = 0
                let reqCount = 5

                if (todayIdx >= 0) {
                  let tempStreak = 0
                  let checkIdx = todayIdx
                  const todayData = data[todayIdx]
                  reqCount = todayData.requiredCount ?? 5

                  if (!todayData.isExcused && todayData.prayers < reqCount) {
                    checkIdx = todayIdx - 1
                  }

                  for (let i = checkIdx; i >= 0; i--) {
                    const day = data[i]
                    const req = day.requiredCount ?? 5
                    if (day.isExcused) {
                      continue
                    }
                    if (day.prayers >= req) {
                      tempStreak++
                    } else {
                      break
                    }
                  }
                  streak = tempStreak
                }

                if (streak === 0) {
                  return `Try to hit all ${reqCount} prayers today to start a new streak! May Allah make it easy for you.`
                } else if (streak === 1) {
                  return "You've hit all required prayers today! Great start, keep the momentum going tomorrow."
                }

                return `You've hit all required prayers for ${streak} days in a row. Keep up the great momentum! May Allah reward your efforts.`
              })()}
            </p>
          </CardContent>
        </Card>

        <ConsistencyHeatmap />

        <div className="grid grid-cols-2 gap-4">
          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <Trophy className="w-8 h-8 text-amber-500 mb-2" />
              <h3 className="text-sm font-medium text-muted-foreground">Most Prayed</h3>
              <p className="text-lg font-bold text-foreground mt-1">{mostPrayed?.name || "N/A"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{mostPrayed?.count ? `${mostPrayed.count} times` : "Keep tracking!"}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <AlertCircle className="w-8 h-8 text-destructive/80 mb-2" />
              <h3 className="text-sm font-medium text-muted-foreground">Needs Focus</h3>
              <p className="text-lg font-bold text-foreground mt-1">{mostMissed?.name || "N/A"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{mostMissed?.count ? `${mostMissed.count} missed` : "All caught up!"}</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}
