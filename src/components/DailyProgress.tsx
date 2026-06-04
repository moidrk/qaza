"use client"

import { motion } from "framer-motion"

interface DailyProgressProps {
  completed: number;
  total: number;
  isExcused?: boolean;
}

export function DailyProgress({ completed, total, isExcused = false }: DailyProgressProps) {
  const percentage = isExcused ? 100 : total > 0 ? (completed / total) * 100 : 0
  const isDone = !isExcused && completed > 0 && completed === total
  const radius = 24
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference
  const progressColor = isExcused ? "text-sky-500" : "text-primary"

  return (
    <div
      className="relative flex items-center justify-center w-16 h-16"
      aria-label={isExcused ? "Excused cycle day" : `${completed} of ${total} prayers completed`}
    >
      {/* Pop effect ring when completed */}
      {isDone && (
        <motion.div
          className="absolute inset-0 border-[4px] border-primary rounded-full"
          initial={{ opacity: 1, scale: 0.8 }}
          animate={{ opacity: 0, scale: 1.4 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      )}

      {/* Background track */}
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={radius}
          stroke="currentColor"
          strokeWidth="6"
          fill="transparent"
          className="text-primary/10"
        />
        {/* Progress ring */}
        <motion.circle
          cx="32"
          cy="32"
          r={radius}
          stroke="currentColor"
          strokeWidth="6"
          fill="transparent"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ type: "spring", stiffness: 60, damping: 15 }}
          className={progressColor}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-xs font-bold text-foreground">
        {isExcused ? "EX" : `${completed}/${total}`}
      </div>
    </div>
  )
}
