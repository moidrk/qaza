import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Card } from "@/components/ui/card"
import { PushToggle } from "@/components/PushToggle"
import { ResetDataButton } from "@/components/ResetDataButton"
import { TimeFormatToggle } from "@/components/TimeFormatToggle"
import { ThemeToggle } from "@/components/ThemeToggle"
import { TimingSettings } from "@/components/TimingSettings"
import { PacingSettings } from "@/components/PacingSettings"
import { CycleSettings } from "@/components/CycleSettings"
import { LogoutButton } from "@/components/LogoutButton"

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <main className="flex min-h-full flex-col items-center p-6 bg-background">
      <header className="w-full max-w-md py-6 mb-4 border-b border-border/50 text-center">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account and preferences.</p>
      </header>

      <section className="w-full max-w-md space-y-4">
        {/* Main Settings Card */}
        <Card className="border-border/60 shadow-sm overflow-hidden p-6 flex flex-col gap-8">
          
          {/* Notifications */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Notifications</h2>
            <PushToggle />
          </div>

          {/* Preferences */}
          <div className="space-y-8">
            <div>
              <h2 className="text-lg font-semibold mb-4">Appearance</h2>
              <ThemeToggle />
            </div>
            
            <div>
              <h2 className="text-lg font-semibold mb-4">Time Format</h2>
              <TimeFormatToggle />
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-4">Prayer Timings & Jurisprudence</h2>
              <TimingSettings />
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-4">Daily Catch-up Target</h2>
              <PacingSettings />
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-4">Cycle Excuse Periods</h2>
              <CycleSettings />
            </div>
          </div>

          {/* Account Profile */}
          <div>
            <h2 className="text-lg font-semibold mb-1">Account Profile</h2>
            <p className="text-sm text-muted-foreground">Logged in as {session.user.email}</p>
          </div>

          {/* Danger Zone */}
          <div className="-mx-6 -mb-6 p-6 bg-destructive/5 mt-2">
            <h2 className="text-lg font-semibold text-destructive mb-1">Danger Zone</h2>
            <p className="text-sm text-destructive/80 mb-4">Permanent destructive actions.</p>
            <ResetDataButton />
          </div>
        </Card>

        {/* Separate Log Out Button */}
        <div className="pt-4">
          <LogoutButton />
        </div>
      </section>
    </main>
  )
}
