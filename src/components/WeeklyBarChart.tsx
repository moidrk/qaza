"use client"

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

type ConsistencyDatum = {
  name: string
  prayers: number
  requiredCount: number
}

export function WeeklyBarChart({ data }: { data: ConsistencyDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={250}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} domain={[0, data.length > 0 ? Math.max(...data.map((d) => d.requiredCount)) : 5]} />
        <Tooltip cursor={{ fill: "var(--primary)", opacity: 0.1 }} contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
        <Bar dataKey="prayers" fill="var(--primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
