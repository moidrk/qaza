"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, CalendarDays, ListPlus, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getDetailedQaza, completeDetailedQaza, updateBulkQaza } from "@/actions/prayers"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"

interface QazaDetailSheetProps {
  prayer: string;
  isOpen: boolean;
  onClose: () => void;
}

export function QazaDetailSheet({ prayer, isOpen, onClose }: QazaDetailSheetProps) {
  const [data, setData] = useState<{ bulkCount: number, specificDates: { id: string, date: string, type: 'log' | 'item' }[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [addingBulk, setAddingBulk] = useState(false)
  const [bulkAmount, setBulkAmount] = useState("")

  useEffect(() => {
    let isActive = true

    async function loadDetails() {
      setLoading(true)
      const res = await getDetailedQaza(prayer)
      if (!isActive) return

      if (res.success && res.data) {
        setData(res.data)
      }
      setLoading(false)
    }

    if (isOpen && prayer) {
      void loadDetails()
    }

    return () => {
      isActive = false
    }
  }, [isOpen, prayer])

  const handleComplete = async (id: string, type: 'log' | 'item') => {
    const res = await completeDetailedQaza(id, type)
    if (res.success) {
      toast.success("Alhamdulillah, Qaza completed.")
      setData(prev => prev ? { ...prev, specificDates: prev.specificDates.filter(d => d.id !== id) } : null)
    } else {
      toast.error("Failed to mark as complete.")
    }
  }

  const handleCompleteBulk = async () => {
    const res = await updateBulkQaza(prayer, -1)
    if (res.success) {
      toast.success("Alhamdulillah, 1 Qaza completed from backlog.")
      setData(prev => prev ? { ...prev, bulkCount: Math.max(0, prev.bulkCount - 1) } : null)
    }
  }

  const handleAddBulk = async () => {
    const amount = parseInt(bulkAmount)
    if (!amount || amount <= 0) return;
    
    setAddingBulk(true)
    const res = await updateBulkQaza(prayer, amount)
    if (res.success) {
      toast.success(`${amount} Qaza added to backlog.`)
      setData(prev => prev ? { ...prev, bulkCount: prev.bulkCount + amount } : null)
      setBulkAmount("")
    }
    setAddingBulk(false)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md h-fit max-h-[85vh] z-[110] bg-card border border-border/60 rounded-3xl shadow-xl flex flex-col overflow-hidden"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.3 }}
            onDragEnd={(e, info) => {
              if (info.offset.y > 100 || info.velocity.y > 400) {
                onClose();
              }
            }}
          >
            <div className="pt-3 pb-2 flex justify-center bg-muted/20 cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 bg-muted/60 rounded-full" />
            </div>
            
            <div className="flex items-center justify-between px-6 pb-4 border-b border-border/50 bg-muted/20">
              <div>
                <h2 className="text-2xl font-bold text-foreground">{prayer} Qaza</h2>
                <p className="text-sm text-muted-foreground mt-1">Detailed view of missed prayers</p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full" aria-label="Close details">
                <X size={20} />
              </Button>
            </div>

            <div className="overflow-y-auto p-6 space-y-8">
              {loading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-16 bg-muted rounded-2xl w-full" />
                  <div className="h-16 bg-muted rounded-2xl w-full" />
                </div>
              ) : (
                <>
                  {/* Specific Missed Days */}
                  {data && data.specificDates.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <CalendarDays size={18} className="text-primary" /> 
                        Specific Dates Missed
                      </h3>
                      <div className="space-y-2">
                        {data.specificDates.map((item) => {
                          const dateObj = new Date(item.date)
                          return (
                            <div key={item.id} className="flex items-center justify-between p-4 bg-background border border-border/60 rounded-2xl">
                              <div>
                                <p className="font-medium">{dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                <p className="text-xs text-muted-foreground">Auto-tracked missing</p>
                              </div>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleComplete(item.id, item.type)}
                                className="rounded-xl hover:bg-primary hover:text-primary-foreground border-primary/20 text-primary"
                              >
                                <Check size={16} className="mr-1" /> Prayed
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Bulk Historic Backlog */}
                  {data && data.bulkCount > 0 && (
                    <div className="space-y-4 pt-4 border-t border-border/50">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <ListPlus size={18} className="text-primary" /> 
                        Historic Backlog
                      </h3>
                      <div className="flex items-center justify-between p-5 bg-primary/5 border border-primary/20 rounded-2xl">
                        <div>
                          <p className="font-bold text-xl">{data.bulkCount}</p>
                          <p className="text-sm text-muted-foreground">remaining bulk prayers</p>
                        </div>
                        <Button 
                          onClick={handleCompleteBulk}
                          className="rounded-xl shadow-sm"
                        >
                          <Check size={16} className="mr-1" /> Prayed One
                        </Button>
                      </div>
                    </div>
                  )}

                  {data && data.bulkCount === 0 && data.specificDates.length === 0 && (
                    <div className="py-12 flex flex-col items-center justify-center text-center">
                      <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 mb-4 ring-8 ring-emerald-50 dark:ring-emerald-950/10">
                        <Check size={32} strokeWidth={2.5} />
                      </div>
                      <h3 className="text-xl font-bold text-foreground mb-2">Alhamdulillah</h3>
                      <p className="text-sm text-muted-foreground max-w-[250px]">
                        You are fully caught up with your {prayer} Qaza prayers.
                      </p>
                    </div>
                  )}

                  {/* Manual Addition */}
                  <div className="space-y-4 pt-6 border-t border-border/50">
                    <h3 className="font-semibold">Add Historic Qaza</h3>
                    <div className="flex gap-2">
                      <div className="flex-1 space-y-1">
                        <Input 
                          type="number" 
                          placeholder="Amount (e.g. 10)" 
                          value={bulkAmount} 
                          onChange={e => setBulkAmount(e.target.value)}
                          className="bg-background"
                        />
                      </div>
                      <Button onClick={handleAddBulk} disabled={addingBulk} variant="secondary">
                        Add
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
