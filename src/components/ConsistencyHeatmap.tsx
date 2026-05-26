"use client"

import { useQuery } from "@tanstack/react-query"
import { getWeeklyConsistency } from "@/actions/prayers"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { format, parseISO } from "date-fns"
import { motion } from "framer-motion"
import { useMounted } from "@/hooks/useMounted"

type ConsistencyDay = {
  name: string
  date: string
  prayers: number
  requiredCount: number
  isExcused: boolean
}

export function ConsistencyHeatmap({
  initialData,
  initialDate,
}: {
  initialData?: ConsistencyDay[]
  initialDate?: string
}) {
  const mounted = useMounted()

  // Compute local date string reliably
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60000;
  const localDate = new Date(today.getTime() - offset);
  const todayStr = initialDate || localDate.toISOString().split('T')[0];

  const { data: consistencyRes, isLoading } = useQuery({
    queryKey: ['weeklyConsistency', todayStr, 30],
    queryFn: async () => await getWeeklyConsistency(todayStr, 30),
    enabled: mounted,
    initialData: initialData ? { success: true, data: initialData } : undefined,
  })

  if (!mounted) return null

  if (isLoading) {
    return (
      <Card className="border-border/60 shadow-sm w-full">
        <CardContent className="p-5 flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  const data: ConsistencyDay[] = consistencyRes?.success && consistencyRes.data ? consistencyRes.data : []

  if (data.length === 0) return null

  return (
    <Card className="border-border/60 shadow-sm w-full bg-card overflow-hidden">
      <CardHeader className="pb-3 pt-5 px-5">
        <CardTitle className="text-base font-bold">Consistency (Last 30 Days)</CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-5 pb-5 pt-0">
        <div className="grid grid-cols-7 gap-2 sm:gap-3 justify-items-center">
          {data.map((day) => {
            const dateObj = parseISO(day.date)
            const completed = day.prayers
            const required = day.requiredCount || 5
            const isExcused = day.isExcused

            let bgClass = "bg-muted/30 border-border/30 text-muted-foreground/60"
            let titleText = `${format(dateObj, "MMM d")}: No prayers logged`

            if (isExcused) {
              bgClass = "bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400"
              titleText = `${format(dateObj, "MMM d")}: Excused day`
            } else if (completed >= required) {
              bgClass = "bg-primary border-primary/20 text-primary-foreground"
              titleText = `${format(dateObj, "MMM d")}: Completed (${completed}/${required})`
            } else if (completed > 0) {
              bgClass = "bg-primary/20 border-primary/30 text-primary dark:text-primary-foreground/90"
              titleText = `${format(dateObj, "MMM d")}: Partial (${completed}/${required})`
            }

            return (
              <motion.div
                key={day.date}
                title={titleText}
                whileHover={{ scale: 1.08 }}
                className={`
                  w-10 h-10 sm:w-11 sm:h-11 rounded-lg border flex items-center justify-center text-[11px] sm:text-xs font-bold select-none cursor-pointer transition-all active:scale-95
                  ${bgClass}
                `}
              >
                {isExcused ? (
                  <span className="text-[8px] font-semibold leading-none">EX</span>
                ) : completed > 0 ? (
                  completed
                ) : (
                  ""
                )}
              </motion.div>
            )
          })}
        </div>
        <div className="flex flex-wrap justify-between items-center mt-6 text-[10px] sm:text-xs text-muted-foreground px-1 gap-y-2">
          <div className="flex items-center gap-1.5 w-[48%] sm:w-auto">
            <span className="w-3 h-3 rounded bg-muted/30 border border-border/30 inline-block" />
            <span>Empty</span>
          </div>
          <div className="flex items-center gap-1.5 w-[48%] sm:w-auto">
            <span className="w-3 h-3 rounded bg-primary/20 border border-primary/30 inline-block" />
            <span>Partial</span>
          </div>
          <div className="flex items-center gap-1.5 w-[48%] sm:w-auto">
            <span className="w-3 h-3 rounded bg-primary border border-primary/20 inline-block" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1.5 w-[48%] sm:w-auto">
            <span className="w-3 h-3 rounded bg-sky-500/15 border border-sky-500/25 inline-block" />
            <span>Excused</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
