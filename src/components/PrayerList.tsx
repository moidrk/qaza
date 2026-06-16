"use client"

import { usePrayerTimes } from "@/hooks/usePrayerTimes"
import { motion } from "framer-motion"
import { Check, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useAppStore } from "@/store"
import { toast } from "sonner"
import { useQuery } from "@tanstack/react-query"
import { getTodayPrayers } from "@/actions/prayers"
import { format } from "date-fns"
import { useMounted } from "@/hooks/useMounted"
import { isDateInExcusedRange } from "@/lib/excused-periods"

type PrayerLog = {
  prayerName: string
  status: string
}

function isCompletedStatus(status: string | undefined) {
  return status === "completed" || status === "qaza_completed"
}

interface PrayerListProps {
  selectedDate: Date;
  onProgressChange?: (completed: number, total: number, isExcused?: boolean) => void;
}

export function PrayerList({ selectedDate, onProgressChange }: PrayerListProps) {
  const mounted = useMounted()
  const dateStr = format(selectedDate, "yyyy-MM-dd")
  const { data: timings, isLoading: isTimingsLoading } = usePrayerTimes(dateStr)
  
  const addMutation = useAppStore(state => state.addMutation)
  const offlineMutations = useAppStore(state => state.offlineMutations)
  const timeFormatPref = useAppStore(state => state.timeFormat)
  const trackWitr = useAppStore(state => state.trackWitr)
  const excusedRanges = useAppStore(state => state.excusedRanges)

  const isExcusedDate = useMemo(() => {
    return isDateInExcusedRange(dateStr, excusedRanges)
  }, [dateStr, excusedRanges])

  const requiredPrayers = useMemo(() => {
    const list = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]
    if (trackWitr) {
      list.push("Witr")
    }
    return list
  }, [trackWitr])

  const { data: dbPrayersRes, isLoading: isDbLoading } = useQuery({
    queryKey: ['prayers', dateStr],
    queryFn: async () => await getTodayPrayers(dateStr),
  })

  // Compute prayer state instantly from DB results + pending offline mutations
  const prayerStatuses = useMemo(() => {
    const state: Record<string, string> = {};
    
    // 1. Start with database state
    if (dbPrayersRes?.success && dbPrayersRes.data) {
      dbPrayersRes.data.forEach((log: PrayerLog) => {
        const pNameLower = log.prayerName.charAt(0).toUpperCase() + log.prayerName.slice(1).toLowerCase();
        state[pNameLower] = log.status;
        state[log.prayerName] = log.status;
      });
    }
    
    // 2. Overlay any pending local mutations (last mutation wins)
    offlineMutations.forEach(mut => {
      if (mut.type === "LOG_PRAYER" && mut.payload.date.startsWith(dateStr)) {
        state[mut.payload.prayerName] = mut.payload.status;
      }
    });
    
    return state;
  }, [dbPrayersRes, offlineMutations, dateStr]);

  const completedCount = useMemo(() => {
    if (isExcusedDate) {
      return requiredPrayers.length
    }

    return requiredPrayers.filter((prayer) => {
      const status = prayerStatuses[prayer]
      return isCompletedStatus(status) || status === "excused"
    }).length;
  }, [requiredPrayers, prayerStatuses, isExcusedDate]);

  useEffect(() => {
    onProgressChange?.(completedCount, requiredPrayers.length, isExcusedDate);
  }, [completedCount, requiredPrayers.length, isExcusedDate, onProgressChange]);

  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const currentPrayer = useMemo(() => {
    if (!timings || dateStr !== format(new Date(), "yyyy-MM-dd")) {
      return null
    }

    const now = new Date(nowTick);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const pTimes = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"].map((p) => {
      const t = timings[p as keyof typeof timings];
      if (!t || t === "--:--") return { name: p, mins: 0 };
      const [h, m] = t.split(":");
      return { name: p, mins: parseInt(h, 10) * 60 + parseInt(m, 10) };
    });

    for (let i = pTimes.length - 1; i >= 0; i--) {
      if (nowMins >= pTimes[i].mins) {
        return pTimes[i].name;
      }
    }

    return nowMins < pTimes[0].mins ? "Isha" : null;
  }, [timings, dateStr, nowTick]);

  const [lastActionMessage, setLastActionMessage] = useState("")

  if (!mounted) {
    return <div className="animate-pulse space-y-3">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="h-16 bg-muted rounded-2xl w-full" />
      ))}
    </div>
  }

  if (isTimingsLoading || isDbLoading) {
    return <div className="animate-pulse space-y-3">
      {requiredPrayers.map((p) => (
        <div key={p} className="h-16 bg-muted rounded-2xl w-full" />
      ))}
    </div>
  }

  const todayStr = format(new Date(), "yyyy-MM-dd")
  const isFuture = dateStr > todayStr;

  const handleAction = (prayer: string, actionStatus: "completed" | "missed") => {
    if (isFuture) {
      toast.error("You cannot log prayers for future dates!");
      setLastActionMessage(`Cannot log ${prayer} for a future date.`)
      return;
    }

    if (isExcusedDate) {
      toast.info("This date is marked as a cycle excuse period, so it will not be counted as Qaza.")
      setLastActionMessage(`${prayer} is excused for this cycle period.`)
      return;
    }

    const currentStatus = prayerStatuses[prayer];
    const isCurrentlyDone = isCompletedStatus(currentStatus);
    const isCurrentlyMissed = currentStatus === "missed";

    // Since the backend only accepts completed, missed, qaza_completed, excused,
    // and we cannot easily "delete" a log through this payload,
    // we explicitly set it to the chosen status rather than toggling it to a "pending" state.
    // If the user taps the same status, we'll still send the mutation (which is idempotent),
    // but we can skip showing a duplicate toast.

    if (actionStatus === "completed" && !isCurrentlyDone) {
      toast.success(`Alhamdulillah, ${prayer} logged!`)
      setLastActionMessage(`${prayer} marked as completed.`)
    } else if (actionStatus === "missed" && !isCurrentlyMissed) {
      toast.info(`${prayer} marked as missed.`)
      setLastActionMessage(`${prayer} explicitly marked as missed.`)
    } else if (actionStatus === "completed") {
      setLastActionMessage(`${prayer} is already completed.`)
    } else {
      setLastActionMessage(`${prayer} is already missed.`)
    }
    
    addMutation({
      type: "LOG_PRAYER",
      payload: { prayerName: prayer, date: dateStr, status: actionStatus }
    })
  }

  return (
    <div className="w-full space-y-3">
      {/* Visually hidden but announced region for screen readers */}
      <div aria-live="polite" className="sr-only">
        {lastActionMessage}
      </div>
      {requiredPrayers.map((prayer) => {
        let time = timings ? timings[prayer as keyof typeof timings] : "--:--"
        if (prayer === "Witr") {
          time = timings ? `${timings.Isha} (After Isha)` : "After Isha"
        }
        const status = prayerStatuses[prayer]
        const isExcused = isExcusedDate || status === "excused"
        const isDone = isExcused || isCompletedStatus(status)
        const isMissed = status === "missed"

        if (time !== "--:--" && time !== "After Isha" && timeFormatPref === '12h') {
          // If includes " (After Isha)", split first
          const parts = time.split(" ");
          const tPart = parts[0];
          const suffix = parts.slice(1).join(" ");
          
          if (tPart.includes(":")) {
            const [hourStr, minStr] = tPart.split(":")
            let hour = parseInt(hourStr, 10)
            const ampm = hour >= 12 ? "PM" : "AM"
            hour = hour % 12 || 12
            time = `${hour}:${minStr} ${ampm}${suffix ? ' ' + suffix : ''}`
          }
        }

        return (
          <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={prayer}
            className={`
              p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all border
              ${isFuture ? 'bg-muted/30 border-border/30 opacity-60' :
                isExcused ? 'bg-sky-500/5 border-sky-500/20 shadow-sm' :
                isDone ? 'bg-primary/5 border-primary/30 shadow-sm' :
                isMissed ? 'bg-amber-500/5 border-amber-500/30 shadow-sm' :
                'bg-card border-border/60 hover:border-primary/30 shadow-sm'}
            `}
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`font-semibold text-lg transition-colors ${isExcused ? 'text-sky-600 dark:text-sky-400' : isDone ? 'text-primary' : isMissed ? 'text-amber-600 dark:text-amber-500' : 'text-foreground'}`}>
                  {prayer}
                </h3>
                {!isExcused && currentPrayer === prayer && (
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground rounded-full animate-pulse shadow-sm">
                    Now
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm text-muted-foreground" aria-hidden="true">{isExcused ? "Cycle period" : time}</p>
                {!isFuture && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-sm ${isExcused ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400' : isDone ? 'bg-primary/10 text-primary' : isMissed ? 'bg-amber-500/10 text-amber-600 dark:text-amber-500' : 'bg-muted text-muted-foreground'}`}>
                    {isExcused ? 'Excused' : isDone ? 'Completed' : isMissed ? 'Missed' : 'Pending'}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto mt-1 sm:mt-0">
              {isExcused ? (
                <div className="w-11 h-11 rounded-full bg-sky-500/10 border-2 border-sky-500/30 text-sky-600 dark:text-sky-400 flex items-center justify-center" aria-hidden="true">
                  <span className="text-[10px] font-bold leading-none">EX</span>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isFuture || isExcused}
                    onClick={() => handleAction(prayer, "missed")}
                    aria-pressed={isMissed}
                    aria-label={`Mark ${prayer} as missed`}
                    className={`h-11 px-3 min-w-[44px] rounded-full border-2 flex items-center justify-center gap-1.5 overflow-hidden transition-all active:scale-90 flex-1 sm:flex-none
                      ${isMissed ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-500' : 'border-border hover:border-amber-500/40 hover:bg-amber-500/5 text-muted-foreground hover:text-amber-600'}
                      ${isFuture || isExcused ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                    `}
                  >
                    <X size={18} strokeWidth={2.5} />
                    <span className="text-xs font-semibold">{isMissed ? "Missed" : "Miss"}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isFuture || isExcused}
                    onClick={() => handleAction(prayer, "completed")}
                    aria-pressed={isDone}
                    aria-label={`Mark ${prayer} as completed`}
                    className={`h-11 px-4 min-w-[44px] rounded-full border-2 flex items-center justify-center gap-1.5 overflow-hidden transition-all active:scale-90 flex-[2] sm:flex-none
                      ${isDone ? 'bg-primary border-primary text-primary-foreground' : 'border-border hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-primary'}
                      ${isFuture || isExcused ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                    `}
                  >
                    <Check size={18} strokeWidth={2.5} />
                    <span className="text-xs font-semibold">{isDone ? "Prayed" : "Pray"}</span>
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
