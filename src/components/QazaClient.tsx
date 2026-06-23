"use client"

import { Card } from "@/components/ui/card"
import { useState } from "react"
import { DonutChart } from "@/components/DonutChart"
import { QazaDetailSheet } from "@/components/QazaDetailSheet"
import { useAppStore } from "@/store"
import { motion } from "framer-motion"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getQazaStats } from "@/actions/prayers"
import { ChevronRight } from "lucide-react"

interface QazaClientProps {
  stats: {
    backlog: Record<string, number>;
    donut: { totalMissed: number, totalCovered: number, remaining: number };
    weeklyMissed: number;
    todayCompletedCount: number;
  };
}

export function QazaClient({ stats: initialStats }: QazaClientProps) {
  const [selectedPrayer, setSelectedPrayer] = useState<string | null>(null)
  const queryClient = useQueryClient()
  
  const { data: statsRes } = useQuery({
    queryKey: ['qazaStats'],
    queryFn: async () => await getQazaStats(),
    initialData: { success: true, data: initialStats },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  const stats = statsRes?.success && statsRes.data ? statsRes.data : initialStats

  const qazaPace = useAppStore(state => state.qazaPace)
  const trackWitr = useAppStore(state => state.trackWitr)

  const paceMode = qazaPace?.paceMode || "none"
  const prayersPerDayBase = trackWitr ? 6 : 5
  
  let targetCount = 0
  if (paceMode === "1:1") targetCount = prayersPerDayBase
  else if (paceMode === "2:1") targetCount = prayersPerDayBase * 2
  else if (paceMode === "3:1") targetCount = prayersPerDayBase * 3

  const todayCount = stats.todayCompletedCount || 0
  const progressPercent = targetCount > 0 ? Math.min(100, Math.round((todayCount / targetCount) * 100)) : 0
  const remaining = stats.donut.remaining

  let forecastText = ""
  if (targetCount > 0 && remaining > 0) {
    const days = Math.ceil(remaining / targetCount)
    if (days <= 30) {
      forecastText = `At your target pace (${targetCount} Qaza/day), you will be caught up in ${days} days!`
    } else {
      const months = Math.round((days / 30.4) * 10) / 10
      if (months <= 12) {
        forecastText = `At your target pace (${targetCount} Qaza/day), you will be caught up in ${months} months.`
      } else {
        const years = Math.round((days / 365) * 10) / 10
        forecastText = `At your target pace (${targetCount} Qaza/day), you will be caught up in ${years} years.`
      }
    }
  }
  
  return (
    <div className="w-full max-w-md space-y-6">
      
      {/* Visualizations */}
      <DonutChart 
        totalMissed={stats.donut.totalMissed} 
        totalCovered={stats.donut.totalCovered} 
        weeklyMissed={stats.weeklyMissed} 
      />

      {/* Pacing & Forecast Widget */}
      {targetCount > 0 && remaining > 0 && (
        <div className="bg-primary/5 border border-primary/20 p-5 rounded-3xl shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-sm font-bold text-foreground">Today&apos;s Qaza Goal</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Target: {targetCount} prayers per day</p>
            </div>
            <span className="text-lg font-extrabold text-primary">{todayCount} / {targetCount}</span>
          </div>
          
          <div className="w-full bg-muted/40 rounded-full h-3.5 overflow-hidden border border-border/30">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="bg-primary h-full rounded-full"
            />
          </div>
          
          {progressPercent >= 100 ? (
            <p className="text-xs text-emerald-600 font-semibold text-center bg-emerald-50 py-1.5 rounded-xl border border-emerald-200/50">
              Alhamdulillah, today&apos;s catch-up target met! Keep it up.
            </p>
          ) : (
            forecastText && (
              <p className="text-xs text-muted-foreground text-center font-medium">
                {forecastText}
              </p>
            )
          )}
        </div>
      )}
      
      {paceMode === "none" && remaining > 0 && (
        <div className="bg-muted/10 border border-border/40 p-4 rounded-3xl text-center space-y-1">
          <p className="text-xs font-semibold text-foreground/80">Want a completion timeline?</p>
          <p className="text-[11px] text-muted-foreground">
            Set a Daily Catch-up Target in Settings to estimate when you&apos;ll finish.
          </p>
        </div>
      )}

      <div className="pt-2">
        <h3 className="text-lg font-bold mb-4">Your Qaza List</h3>
        <div className="flex flex-col gap-3">
          {Object.entries(stats.backlog).map(([prayer, count]) => {
            const isCaughtUp = count === 0;

            return (
              <Card 
                key={prayer} 
                onClick={() => setSelectedPrayer(prayer)}
                role="button"
                tabIndex={0}
                aria-label={`${prayer} Qaza details, ${isCaughtUp ? "Caught up" : count + " remaining"}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (!e.repeat) {
                      setSelectedPrayer(prayer);
                    }
                  }
                }}
                className={`transition-all overflow-hidden cursor-pointer active:scale-[0.98] !flex-row items-center justify-between p-4 min-h-[72px] shadow-sm ${
                  isCaughtUp
                    ? 'bg-muted/10 border-border/30 opacity-70 hover:opacity-100'
                    : 'bg-card border-border/60 hover:border-primary/30'
                }`}
              >
                <div className="flex flex-col">
                  <h3 className={`text-lg font-bold ${isCaughtUp ? 'text-muted-foreground' : ''}`}>{prayer}</h3>
                  {isCaughtUp ? (
                    <div className="mt-1 flex items-center gap-1 text-emerald-600/80 bg-emerald-50/50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full w-fit">
                      <span className="text-xs font-medium">Caught Up</span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="font-semibold text-foreground text-sm">{count}</span> remaining
                    </p>
                  )}
                </div>
                <ChevronRight size={20} className="text-muted-foreground/50" />
              </Card>
            )
          })}
        </div>
      </div>

      <QazaDetailSheet 
        prayer={selectedPrayer || ""} 
        isOpen={!!selectedPrayer} 
        onClose={() => {
          setSelectedPrayer(null);
          // Invalidate multiple queries gracefully without reloading the page
          queryClient.invalidateQueries({ queryKey: ['qazaStats'] })
          queryClient.invalidateQueries({ queryKey: ['weeklyConsistency'] })
          queryClient.invalidateQueries({ queryKey: ['prayers'] })
          queryClient.invalidateQueries({ queryKey: ['prayerInsights'] })
        }} 
      />
    </div>
  )
}
