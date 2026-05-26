import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getQazaStats } from "@/actions/prayers"
import { getUserPreferences } from "@/actions/user"
import { QazaClient } from "@/components/QazaClient"
import { UserPreferenceHydrator } from "@/components/UserPreferenceHydrator"

export default async function QazaPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const [statsRes, preferencesRes] = await Promise.all([
    getQazaStats(),
    getUserPreferences(),
  ])
  const preferences = preferencesRes.success && preferencesRes.data ? preferencesRes.data : null
  const stats = statsRes.success && statsRes.data ? statsRes.data : {
    backlog: { Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0 },
    donut: { totalMissed: 0, totalCovered: 0, remaining: 0 },
    weeklyMissed: 0,
    todayCompletedCount: 0
  }

  return (
    <main className="flex min-h-full flex-col items-center p-6 bg-background">
      <UserPreferenceHydrator preferences={preferences} />
      <header className="w-full max-w-md py-6 mb-4 border-b border-border/50 text-center">
        <h1 className="text-2xl font-bold text-foreground">Qaza</h1>
        <p className="text-muted-foreground text-sm mt-1">Don&apos;t rush. Let&apos;s catch up one prayer at a time.</p>
      </header>

      <section className="w-full max-w-md space-y-4">
        <QazaClient stats={stats} />
      </section>
    </main>
  )
}
