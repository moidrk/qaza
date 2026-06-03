"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getQazaStats, updateBulkQaza } from "@/actions/prayers"
import { useAppStore } from "@/store"
import { Plus, Check, Loader2, ChevronUp, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useState } from "react"
import { toast } from "sonner"
import { useMounted } from "@/hooks/useMounted"

export function QuickCatchUp() {
  const queryClient = useQueryClient()
  const trackWitr = useAppStore(state => state.trackWitr)
  const [loggingPrayer, setLoggingPrayer] = useState<string | null>(null)
  
  const [isOpen, setIsOpen] = useState(false)
  const isMounted = useMounted()

  const { data: statsRes } = useQuery({
    queryKey: ['qazaStats'],
    queryFn: async () => await getQazaStats(),
  })

  const prayersList = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]
  if (trackWitr) {
    prayersList.push("Witr")
  }

  const handleQuickLog = async (prayer: string) => {
    const backlogVal = statsRes?.data?.backlog?.[prayer] || 0
    if (backlogVal <= 0) {
      toast.info(`You have no remaining Qaza for ${prayer}!`)
      return
    }

    setLoggingPrayer(prayer)
    const res = await updateBulkQaza(prayer.toLowerCase(), -1)
    
    if (res.success) {
      toast.success(`Alhamdulillah, completed 1 ${prayer} Qaza!`)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['qazaStats'] }),
        queryClient.invalidateQueries({ queryKey: ['weeklyConsistency'] }),
        queryClient.invalidateQueries({ queryKey: ['prayers'] }),
        queryClient.invalidateQueries({ queryKey: ['prayerInsights'] })
      ])
      // Auto-close drawer after logging
      setTimeout(() => setIsOpen(false), 300)
    } else {
      toast.error("Failed to update Qaza backlog")
    }
    setLoggingPrayer(null)
  }

  if (!isMounted) return <div className="w-14 h-14" />

  const backlog: Record<string, number> = statsRes?.data?.backlog || {}
  const totalRemaining = Object.values(backlog).reduce((acc, val) => acc + val, 0)

  return (
    <>
      <div className="relative flex flex-col items-center justify-end w-16 -mt-8 z-50">
        <button 
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Close Quick Catch-up" : "Open Quick Catch-up"}
          aria-expanded={isOpen}
          aria-controls="quick-catchup-drawer"
          className="relative flex items-center justify-center w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-[0_0_15px_rgba(0,0,0,0.1)] border-[4px] border-background transition-transform active:scale-95"
        >
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
          >
            <ChevronUp size={28} />
          </motion.div>
          {totalRemaining > 0 && !isOpen && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-full border-2 border-background">
              {totalRemaining > 99 ? '99+' : totalRemaining}
            </span>
          )}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[110]"
            />
            <motion.div
              id="quick-catchup-drawer"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-[120] px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-3 bg-card border-t border-border/50 rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] flex justify-center"
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.5 }}
              onDragEnd={(e, info) => {
                if (info.offset.y > 80 || info.velocity.y > 300) {
                  setIsOpen(false);
                }
              }}
            >
              <div className="w-full max-w-md">
                {/* Drag Handle */}
                <div className="w-12 h-1.5 bg-muted/60 rounded-full mx-auto mb-4" />

                <div className="flex items-center justify-between mb-6 px-2">
                  <div>
                    <h3 className="font-bold text-lg text-foreground">Quick Catch-up</h3>
                    <p className="text-sm text-muted-foreground">Tap a prayer to quickly log one Qaza.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close Quick Catch-up"
                    className="p-2 bg-secondary/50 hover:bg-secondary rounded-full transition-colors text-muted-foreground"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {prayersList.map((prayer) => {
                    const count = backlog[prayer] || 0
                    const isLogging = loggingPrayer === prayer
                    const isDisabled = count <= 0

                    return (
                      <button
                        key={prayer}
                        type="button"
                        onClick={() => handleQuickLog(prayer)}
                        disabled={isLogging || isDisabled}
                        className={`
                          flex flex-col items-center justify-between p-4 rounded-2xl border transition-all text-center h-24 relative select-none
                          ${isDisabled 
                            ? 'bg-muted/10 border-border/30 opacity-40 cursor-not-allowed' 
                            : 'bg-background hover:bg-muted/20 border-border/60 cursor-pointer active:scale-95'}
                        `}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm font-semibold text-foreground leading-tight">
                            {prayer}
                          </span>
                          <span className="text-xs text-muted-foreground font-medium">
                            {count} left
                          </span>
                        </div>
                        
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${
                          isDisabled 
                            ? 'border-border bg-muted/20' 
                            : isLogging 
                              ? 'border-primary bg-primary/10 text-primary' 
                              : 'border-primary/30 text-primary bg-primary/5'
                        }`}>
                          {isLogging ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isDisabled ? (
                            <Check className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
