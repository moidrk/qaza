import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { HomeClient } from "@/components/HomeClient"
import { Suspense } from "react"
import { db } from "@/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"

export default async function Home() {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect("/login")
  }

  const userId = session.user.id

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      pwaInstalled: true,
    },
  })

  return (
    <main className="flex min-h-full flex-col items-center p-6 bg-background selection:bg-primary/20">
      <Suspense fallback={null}>
        <HomeClient
          userName={session.user.name?.split(' ')[0] || 'Friend'}
          pwaInstalled={user?.pwaInstalled ?? false}
        />
      </Suspense>
    </main>
  )
}
