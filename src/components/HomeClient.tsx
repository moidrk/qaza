"use client"

import { useState, useEffect, useCallback } from "react"
import { PrayerList } from "@/components/PrayerList"
import { DateStrip } from "@/components/DateStrip"
import { DailyProgress } from "@/components/DailyProgress"
import { format, isSameDay } from "date-fns"
import { useQuery } from "@tanstack/react-query"
import { getWeeklyConsistency } from "@/actions/prayers"

import Link from "next/link"
import { Star } from "lucide-react"

import { motion, AnimatePresence } from "framer-motion"
import { OnboardingWizard } from "@/components/OnboardingWizard"
import { useSearchParams } from "next/navigation"
import { CheckInModal } from "@/components/CheckInModal"
import { useMounted } from "@/hooks/useMounted"

type ConsistencyDay = {
  prayers: number
  requiredCount?: number
  isExcused?: boolean
}

export function HomeClient({
  userName = "Friend",
  pwaInstalled = false,
}: {
  userName?: string
  pwaInstalled?: boolean
}) {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [progress, setProgress] = useState({ completed: 0, total: 5 })
  const isMounted = useMounted()
  const [showGreeting, setShowGreeting] = useState(true)
  
  const searchParams = useSearchParams()
  const checkinPrayer = searchParams.get('checkin')
  const checkinDate = searchParams.get('date')

  const handleProgressChange = useCallback((completed: number, total: number) => {
    setProgress(prev => (prev.completed === completed && prev.total === total) ? prev : { completed, total })
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setShowGreeting(false), 2500)
    return () => clearTimeout(t)
  }, [])

  const isToday = isMounted ? isSameDay(selectedDate, new Date()) : true
  
  const { data: consistencyRes } = useQuery({
    queryKey: ['weeklyConsistency'],
    queryFn: async () => await getWeeklyConsistency(),
  })

  let totalWeekly = 0;
  let totalRequiredWeekly = 0;
  let streak = 0;

  if (consistencyRes?.success && consistencyRes.data) {
    const data: ConsistencyDay[] = consistencyRes.data;
    
    data.forEach((day) => {
      if (!day.isExcused) {
        totalWeekly += day.prayers;
        totalRequiredWeekly += day.requiredCount ?? 5;
      }
    });

    const todayIdx = data.length - 1;
    if (todayIdx >= 0) {
      let tempStreak = 0;
      let checkIdx = todayIdx;
      
      const today = data[todayIdx];
      const todayReq = today.requiredCount ?? 5;
      
      if (!today.isExcused && today.prayers < todayReq) {
        checkIdx = todayIdx - 1;
      }
      
      for (let i = checkIdx; i >= 0; i--) {
        const day = data[i];
        const req = day.requiredCount ?? 5;
        if (day.isExcused) {
          continue;
        }
        if (day.prayers >= req) {
          tempStreak++;
        } else {
          break;
        }
      }
      
      streak = tempStreak;
    }
  }
  
  const weeklyPercentage = totalRequiredWeekly > 0 
    ? Math.round((totalWeekly / totalRequiredWeekly) * 100) 
    : 100;
  
  return (
    <div className="w-full max-w-md space-y-4">
      <div className="flex items-center justify-between h-[48px]">
        <div className="relative flex-1 h-full">
          <AnimatePresence mode="wait">
            {showGreeting ? (
              <motion.div 
                key="greeting"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0"
              >
                <h2 className="text-xl font-bold text-foreground">
                  Assalamu Alaikum, {userName}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Let&apos;s catch up together.
                </p>
              </motion.div>
            ) : (
              <motion.div 
                key="date"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0"
              >
                <h2 className="text-xl font-bold text-foreground">
                  {isToday ? "Today's Prayers" : format(selectedDate, "MMMM d, yyyy")}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {isToday ? "Stay consistent, stay blessed." : "Reviewing past logs."}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <DailyProgress completed={progress.completed} total={progress.total} />
      </div>

      <div className="flex items-stretch gap-3 h-[72px]">
        <div className="flex-1 flex items-center gap-3 bg-primary/5 border border-primary/10 rounded-2xl px-4">
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-foreground leading-tight">Weekly</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Last 7 days</p>
          </div>
          <div className="text-2xl font-bold text-primary">{weeklyPercentage}%</div>
        </div>

        <Link href="/analytics" className="h-full">
          <div className="h-full flex flex-col items-center justify-center bg-amber-500/10 border border-amber-500/20 rounded-2xl px-5 transition-transform hover:scale-105 active:scale-95">
             <Star className="text-amber-500 fill-amber-500 mb-1" size={20} />
             <span className="font-bold text-amber-600 text-sm leading-none">{streak} <span className="text-[10px]">Day</span></span>
          </div>
        </Link>
      </div>

      <DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} />
      
      <PrayerList 
        selectedDate={selectedDate} 
        onProgressChange={handleProgressChange} 
      />

      <OnboardingWizard pwaInstalled={pwaInstalled} />
      
      {checkinPrayer && checkinDate && (
        <CheckInModal prayerName={checkinPrayer} date={checkinDate} />
      )}
    </div>
  )
}
