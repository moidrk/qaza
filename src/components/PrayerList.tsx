"use client"

import { usePrayerTimes } from "@/hooks/usePrayerTimes"
import { motion } from "framer-motion"
import { Check } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useAppStore } from "@/store"
import { toast } from "sonner"
import { useQuery } from "@tanstack/react-query"
import { getTodayPrayers } from "@/actions/prayers"
import { format } from "date-fns"
import { useMounted } from "@/hooks/useMounted"

type PrayerLog = {
  prayerName: string
  status: string
}

interface PrayerListProps {
  selectedDate: Date;
  onProgressChange?: (completed: number, total: number) => void;
}

export function PrayerList({ selectedDate, onProgressChange }: PrayerListProps) {
  const mounted = useMounted()
  const dateStr = format(selectedDate, "yyyy-MM-dd")
  const { data: timings, isLoading: isTimingsLoading } = usePrayerTimes(dateStr)
  
  const addMutation = useAppStore(state => state.addMutation)
  const offlineMutations = useAppStore(state => state.offlineMutations)
  const timeFormatPref = useAppStore(state => state.timeFormat)
  const trackWitr = useAppStore(state => state.trackWitr)

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

  // Compute completed state instantly from DB results + pending offline mutations
  const completed = useMemo(() => {
    const state: Record<string, boolean> = {};
    
    // 1. Start with database state
    if (dbPrayersRes?.success && dbPrayersRes.data) {
      dbPrayersRes.data.forEach((log: PrayerLog) => {
        const pNameLower = log.prayerName.charAt(0).toUpperCase() + log.prayerName.slice(1).toLowerCase();
        state[pNameLower] = log.status === "completed" || log.status === "qaza_completed";
        state[log.prayerName] = log.status === "completed" || log.status === "qaza_completed";
      });
    }
    
    // 2. Overlay any pending local mutations (last mutation wins)
    offlineMutations.forEach(mut => {
      if (mut.type === "LOG_PRAYER" && mut.payload.date.startsWith(dateStr)) {
        state[mut.payload.prayerName] = mut.payload.status === "completed" || mut.payload.status === "qaza_completed";
      }
    });
    
    return state;
  }, [dbPrayersRes, offlineMutations, dateStr]);

  const completedCount = useMemo(() => {
    return requiredPrayers.filter(p => completed[p]).length;
  }, [requiredPrayers, completed]);

  useEffect(() => {
    onProgressChange?.(completedCount, requiredPrayers.length);
  }, [completedCount, requiredPrayers.length, onProgressChange]);

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

  const handleToggle = (prayer: string) => {
    if (isFuture) {
      toast.error("You cannot log prayers for future dates!");
      setLastActionMessage(`Cannot log ${prayer} for a future date.`)
      return;
    }

    const isCompleted = !completed[prayer]
    
    if (isCompleted) {
      toast.success(`Alhamdulillah, ${prayer} logged!`)
      setLastActionMessage(`${prayer} marked as completed.`)
    } else {
      setLastActionMessage(`${prayer} marked as uncompleted.`)
    }
    
    addMutation({
      type: "LOG_PRAYER",
      payload: { prayerName: prayer, date: dateStr, status: isCompleted ? "completed" : "missed" }
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
        const isDone = completed[prayer]

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
            onClick={() => handleToggle(prayer)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                if (!e.repeat) {
                  handleToggle(prayer)
                }
              }
            }}
            tabIndex={0}
            role="button"
            aria-pressed={isDone}
            aria-disabled={isFuture}
            aria-label={isDone ? `${prayer} is completed` : `Mark ${prayer} as prayed`}
            className={`
              p-5 rounded-2xl flex items-center justify-between transition-all border select-none active:scale-[0.98]
              ${isFuture ? 'bg-muted/30 border-border/30 cursor-not-allowed opacity-60' : 
                isDone ? 'bg-primary/5 border-primary/30 shadow-sm cursor-pointer' : 
                'bg-card border-border/60 hover:border-primary/30 shadow-sm cursor-pointer'}
            `}
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`font-semibold text-lg transition-colors ${isDone ? 'text-primary' : 'text-foreground'}`}>
                  {prayer}
                </h3>
                {currentPrayer === prayer && (
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground rounded-full animate-pulse shadow-sm">
                    Now
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm text-muted-foreground" aria-hidden="true">{time}</p>
                {!isFuture && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-sm ${isDone ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {isDone ? 'Completed' : 'Pending'}
                  </span>
                )}
              </div>
            </div>
            
            <motion.div
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center overflow-hidden transition-colors ${
                isDone ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
              }`}
              whileTap={{ scale: 0.85 }}
              aria-hidden="true"
            >
              <motion.div
                initial={false}
                animate={{ 
                  scale: isDone ? 1 : 0.2, 
                  opacity: isDone ? 1 : 0,
                  rotate: isDone ? 0 : -45
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <Check size={16} strokeWidth={3} />
              </motion.div>
            </motion.div>
          </motion.div>
        )
      })}
    </div>
  )
}
