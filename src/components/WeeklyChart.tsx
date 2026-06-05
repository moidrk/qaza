"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

type ConsistencyDatum = {
  name: string
  prayers: number
  requiredCount?: number
  isExcused?: boolean
}

interface WeeklyChartProps {
  data: ConsistencyDatum[]
}

export function WeeklyChart({ data }: WeeklyChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <XAxis
          dataKey="name"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}`}
        />
        <Tooltip
          cursor={{ fill: 'transparent' }}
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload
              return (
                <div className="bg-popover text-popover-foreground border border-border shadow-md rounded-xl p-3">
                  <p className="font-semibold text-sm mb-1">{data.name}</p>
                  {data.isExcused ? (
                    <p className="text-sm text-primary">Excused</p>
                  ) : (
                    <p className="text-sm text-primary">{data.prayers} / {data.requiredCount || 5} prayed</p>
                  )}
                </div>
              )
            }
            return null
          }}
        />
        <Bar
          dataKey="prayers"
          radius={[4, 4, 0, 0]}
          className="fill-primary"
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
