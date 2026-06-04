"use client"

import { useState } from "react"
import { useAppStore } from "@/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar, Trash2, Plus } from "lucide-react"
import { toast } from "sonner"
import { updateUserPreferences } from "@/actions/user"
import { useMounted } from "@/hooks/useMounted"

export function CycleSettings() {
  const excusedRanges = useAppStore(state => state.excusedRanges)
  const setExcusedRanges = useAppStore(state => state.setExcusedRanges)

  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const mounted = useMounted()

  if (!mounted) return null

  const handleAddRange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!startDate || !endDate) {
      toast.error("Please select both start and end dates")
      return
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast.error("Start date cannot be after end date")
      return
    }

    const newRange = { start: startDate, end: endDate }
    const updatedRanges = [...excusedRanges, newRange].sort((a, b) => b.start.localeCompare(a.start))

    // Save to DB
    const res = await updateUserPreferences({ excusedRanges: updatedRanges })
    if (res.success) {
      setExcusedRanges(updatedRanges)
      setStartDate("")
      setEndDate("")
      toast.success("Cycle period added successfully!")
    } else {
      toast.error("Failed to save period settings")
    }
  }

  const handleRemoveRange = async (indexToRemove: number) => {
    const updatedRanges = excusedRanges.filter((_, i) => i !== indexToRemove)

    const res = await updateUserPreferences({ excusedRanges: updatedRanges })
    if (res.success) {
      setExcusedRanges(updatedRanges)
      toast.success("Cycle period removed")
    } else {
      toast.error("Failed to update settings")
    }
  }

  return (
    <div className="space-y-6">
      {/* Form */}
      <form onSubmit={handleAddRange} className="space-y-4 p-4 bg-muted/20 border border-border/50 rounded-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="start-date" className="text-xs">Start Date</Label>
            <Input 
              id="start-date" 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              className="bg-background text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="end-date" className="text-xs">End Date</Label>
            <Input 
              id="end-date" 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              className="bg-background text-sm"
            />
          </div>
        </div>
        <Button 
          type="submit" 
          className="w-full rounded-xl flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" /> Add Cycle Period
        </Button>
      </form>

      {/* List */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground">Logged Cycle Periods</h4>
        {excusedRanges.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-2">No cycle periods logged.</p>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
            {excusedRanges.map((range, index) => {
              const startObj = new Date(range.start)
              const endObj = new Date(range.end)
              return (
                <div key={index} className="flex items-center justify-between p-3 bg-background border border-border/50 rounded-xl text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary/70" />
                    <span className="font-medium text-xs font-mono">
                      {startObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {endObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
                    </span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    type="button"
                    onClick={() => handleRemoveRange(index)} 
                    className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-full"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
