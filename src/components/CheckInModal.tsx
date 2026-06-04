"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./ui/button";
import { useAppStore } from "@/store";
import { isDateInExcusedRange } from "@/lib/excused-periods";

export function CheckInModal({
  prayerName,
  date,
}: {
  prayerName: string;
  date: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const excusedRanges = useAppStore((state) => state.excusedRanges);
  const isExcusedDate = date !== "test" && isDateInExcusedRange(date, excusedRanges);

  // Close modal and remove query params
  const close = () => {
    setIsOpen(false);
    router.replace("/");
  };

  const handleAction = async (action: "prayed" | "qaza") => {
    if (isExcusedDate) {
      close();
      return;
    }

    if (date === "test") {
      alert(`Test mode: Action '${action}' clicked! No data was saved.`);
      close();
      return;
    }
    
    setLoading(true);
    try {
      await fetch(`/api/notifications/prayer-checkin/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prayerName, date }),
      });
      // Optionally trigger a re-fetch of queries here, or rely on existing invalidations
      setTimeout(() => {
        close();
        // forcefully refresh the router to show updated state
        router.refresh();
      }, 500);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-sm bg-card rounded-3xl shadow-xl overflow-hidden flex flex-col p-6 space-y-6"
        >
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-bold">
              {isExcusedDate
                ? "Cycle excuse period"
                : `Did you pray ${prayerName.charAt(0).toUpperCase() + prayerName.slice(1)}?`}
            </h2>
            <p className="text-muted-foreground text-sm">
              {isExcusedDate
                ? "This date is covered by your cycle excuse period, so it will not be added to Qaza."
                : "Update your record so your Qaza count stays accurate."}
            </p>
          </div>

          {isExcusedDate ? (
            <Button
              className="w-full rounded-xl h-12"
              onClick={close}
            >
              Close
            </Button>
          ) : (
            <div className="flex flex-col gap-3">
              <Button
                className="w-full rounded-xl h-12"
                disabled={loading}
                onClick={() => handleAction("prayed")}
              >
                {loading ? "Saving..." : "Yes, I prayed"}
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-xl h-12"
                disabled={loading}
                onClick={() => handleAction("qaza")}
              >
                No, add to Qaza
              </Button>
            </div>
          )}
          
          <div className="text-center">
            <button 
              onClick={close}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              disabled={loading}
            >
              Dismiss
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
