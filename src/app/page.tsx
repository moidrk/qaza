import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { HomeClient } from "@/components/HomeClient"
import { UserPreferenceHydrator } from "@/components/UserPreferenceHydrator"
import { getWeeklyConsistency } from "@/actions/prayers"
import { getUserPreferences } from "@/actions/user"
import { getUserLocalDate } from "@/lib/date-utils"
import { Suspense } from "react"

export default async function Home() {
  const session = await auth()
  
  if (!session?.user) {
    redirect("/login")
  }

  const preferencesRes = await getUserPreferences()
  const preferences = preferencesRes.success && preferencesRes.data ? preferencesRes.data : null
  const todayStr = getUserLocalDate(preferences?.timezone)
  const consistencyRes = await getWeeklyConsistency(todayStr)
  const consistency = consistencyRes.success && consistencyRes.data ? consistencyRes.data : undefined

  return (
    <main className="flex min-h-full flex-col items-center p-6 bg-background selection:bg-primary/20">
      <UserPreferenceHydrator preferences={preferences} />
      <Suspense fallback={null}>
        <HomeClient userName={session.user.name?.split(' ')[0] || 'Friend'} initialConsistency={consistency} initialConsistencyDate={todayStr} />
      </Suspense>
    </main>
  )
}
