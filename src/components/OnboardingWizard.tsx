"use client"

import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  BellRing,
  Check,
  CheckCircle2,
  ChevronRight,
  Compass,
  Download,
  EllipsisVertical,
  History,
  House,
  Loader2,
  Share2,
  Smartphone,
  Star,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { updatePwaInstalled, updateUserLocation } from "@/actions/user"
import { useAppStore } from "@/store"
import {
  type BrowserLocation,
  detectBrowserLocation,
  subscribeToPushNotifications,
} from "@/lib/browser-permissions"

type StepId = "daily" | "location" | "reminders" | "qaza" | "streak" | "install"
type ActionStatus = "idle" | "loading" | "success" | "error"
type MobilePlatform = "ios" | "android" | "other"
type PwaInstallContext = {
  platform: MobilePlatform
  isStandalone: boolean
}

const baseSteps: Array<{
  id: StepId
  title: string
  description: string
  icon: ReactNode
  color: string
}> = [
  {
    id: "daily",
    title: "Track Daily Prayers",
    description: "Easily log your 5 daily prayers to stay consistent and accountable with your faith.",
    icon: <CheckCircle2 className="w-16 h-16 text-primary" />,
    color: "bg-primary/10 border-primary/20",
  },
  {
    id: "qaza",
    title: "Recover Missed Qaza",
    description: "Automatically calculate and recover your past missed prayers over time.",
    icon: <History className="w-16 h-16 text-blue-500" />,
    color: "bg-blue-500/10 border-blue-500/20",
  },
  {
    id: "streak",
    title: "Build Your Streak",
    description: "Review your weekly progress and keep a steady daily rhythm.",
    icon: <Star className="w-16 h-16 text-amber-500 fill-amber-500" />,
    color: "bg-amber-500/10 border-amber-500/20",
  },
  {
    id: "location",
    title: "Set Prayer Times",
    description: "Use your location so Qaza can calculate daily prayer times for where you are.",
    icon: <Compass className="w-16 h-16 text-emerald-600" />,
    color: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    id: "reminders",
    title: "Daily Reminders",
    description: "Turn on prayer check-ins now so you do not have to find this later in settings.",
    icon: <BellRing className="w-16 h-16 text-primary" />,
    color: "bg-primary/10 border-primary/20",
  },
]

const installStep: (platform: MobilePlatform) => {
  id: StepId
  title: string
  description: string
  icon: ReactNode
  color: string
} = (platform) => ({
  id: "install",
  title: "Add Qaza to Your Phone",
  description:
    platform === "ios"
      ? "Save Qaza to your iPhone or iPad home screen so it opens like an app."
      : "Install Qaza on your Android home screen so it opens like an app.",
  icon: <Smartphone className="w-16 h-16 text-emerald-600" />,
  color: "bg-emerald-500/10 border-emerald-500/20",
})

function subscribeToOnboarding(callback: () => void) {
  window.addEventListener("storage", callback)
  return () => window.removeEventListener("storage", callback)
}

function getOnboardingSnapshot() {
  return localStorage.getItem("qazatrack_onboarded") !== "true"
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function detectPwaInstallContext(): PwaInstallContext {
  const userAgent = window.navigator.userAgent
  const isIPadOS = window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) || isIPadOS
  const isAndroid = /Android/i.test(userAgent)
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean }
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true

  return {
    platform: isIOS ? "ios" : isAndroid ? "android" : "other",
    isStandalone,
  }
}

function getInstallInstructions(platform: MobilePlatform) {
  if (platform === "ios") {
    return [
      { icon: <Share2 className="h-4 w-4" />, text: "Tap the Share button in Safari." },
      { icon: <House className="h-4 w-4" />, text: "Tap Add to Home Screen." },
      { icon: <Check className="h-4 w-4" />, text: "Tap Add. Qaza will appear on your home screen." },
    ]
  }

  return [
    { icon: <EllipsisVertical className="h-4 w-4" />, text: "Tap the browser menu." },
    { icon: <Download className="h-4 w-4" />, text: "Tap Install app or Add to Home screen." },
    { icon: <Check className="h-4 w-4" />, text: "Tap Install. Qaza will appear on your home screen." },
  ]
}

export function OnboardingWizard({ pwaInstalled = false }: { pwaInstalled?: boolean }) {
  const shouldShowOnboarding = useSyncExternalStore(subscribeToOnboarding, getOnboardingSnapshot, () => false)
  const userLocation = useAppStore((state) => state.userLocation)
  const setUserLocation = useAppStore((state) => state.setUserLocation)
  const [dismissed, setDismissed] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [detectedLocation, setDetectedLocation] = useState<BrowserLocation | null>(null)
  const [locationStatus, setLocationStatus] = useState<ActionStatus>("idle")
  const [reminderStatus, setReminderStatus] = useState<ActionStatus>("idle")
  const [pwaStatus, setPwaStatus] = useState<ActionStatus>("idle")
  const [pwaContext, setPwaContext] = useState<PwaInstallContext>(() =>
    typeof window === "undefined" ? { platform: "other", isStandalone: false } : detectPwaInstallContext()
  )
  const shouldShowInstallStep = pwaContext.platform !== "other" && !pwaContext.isStandalone && !pwaInstalled
  const steps = useMemo(
    () => (shouldShowInstallStep ? [...baseSteps, installStep(pwaContext.platform)] : baseSteps),
    [pwaContext.platform, shouldShowInstallStep]
  )
  const isOpen = shouldShowOnboarding && !dismissed
  const safeCurrentStep = Math.min(currentStep, steps.length - 1)
  const step = steps[safeCurrentStep]
  const isSetupStep = step.id === "location" || step.id === "reminders"
  const isInstallStep = step.id === "install"

  useEffect(() => {
    if (pwaContext.isStandalone && !pwaInstalled) {
      updatePwaInstalled(true).catch((error) => {
        console.error("Failed to save installed PWA status", error)
      })
    }

    const handleAppInstalled = () => {
      setPwaContext((current) => ({
        platform: current.platform,
        isStandalone: true,
      }))
    }

    window.addEventListener("appinstalled", handleAppInstalled)
    return () => window.removeEventListener("appinstalled", handleAppInstalled)
  }, [pwaContext.isStandalone, pwaInstalled])

  const handleNext = () => {
    if (safeCurrentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1)
    } else {
      finishOnboarding()
    }
  }

  const finishOnboarding = () => {
    localStorage.setItem("qazatrack_onboarded", "true")
    setDismissed(true)
  }

  const autoAdvance = (fromStep: number) => {
    window.setTimeout(() => {
      setCurrentStep((current) => {
        if (current !== fromStep) {
          return current
        }

        if (current < steps.length - 1) {
          return current + 1
        }

        localStorage.setItem("qazatrack_onboarded", "true")
        setDismissed(true)
        return current
      })
    }, 450)
  }

  const handleDetectLocation = async () => {
    const stepIndex = safeCurrentStep
    setLocationStatus("loading")

    try {
      const location = await detectBrowserLocation()
      const result = await updateUserLocation(location.lat, location.lng, location.timezone)

      if (!result.success) {
        throw new Error(result.error || "Failed to save location.")
      }

      setDetectedLocation(location)
      setUserLocation({ lat: location.lat, lng: location.lng })
      setLocationStatus("success")
      toast.success("Location saved for prayer times.")
      autoAdvance(stepIndex)
    } catch (error) {
      console.error("Onboarding location setup failed", error)
      setLocationStatus("error")
      toast.error(getErrorMessage(error, "Failed to detect location. Please check permissions."))
    }
  }

  const handleEnableReminders = async () => {
    const stepIndex = safeCurrentStep
    setReminderStatus("loading")

    try {
      const subscriptionLocation =
        detectedLocation ??
        (userLocation
          ? {
              lat: userLocation.lat,
              lng: userLocation.lng,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }
          : undefined)

      await subscribeToPushNotifications(subscriptionLocation)
      setReminderStatus("success")
      toast.success("Daily reminders enabled.")
      autoAdvance(stepIndex)
    } catch (error) {
      console.error("Onboarding reminder setup failed", error)
      setReminderStatus("error")
      toast.error(getErrorMessage(error, "Failed to enable reminders."))
    }
  }

  const handlePwaInstallChoice = async (installed: boolean) => {
    setPwaStatus("loading")

    try {
      const result = await updatePwaInstalled(installed)

      if (!result.success) {
        throw new Error(result.error || "Failed to save install status.")
      }

      localStorage.setItem("qazatrack_pwa_installed", installed ? "true" : "false")
      setPwaStatus("success")
      finishOnboarding()
    } catch (error) {
      console.error("Onboarding PWA install status failed", error)
      setPwaStatus("error")
      toast.error(getErrorMessage(error, "Failed to save install status."))
    }
  }

  const renderStepAction = () => {
    if (step.id === "location") {
      return (
        <div className="mt-5 w-full">
          <Button
            onClick={handleDetectLocation}
            disabled={locationStatus === "loading" || locationStatus === "success"}
            variant={locationStatus === "success" ? "outline" : "default"}
            className="h-10 w-full rounded-xl font-semibold"
          >
            {locationStatus === "loading" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Detecting Location
              </>
            ) : locationStatus === "success" ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Location Saved
              </>
            ) : (
              <>
                <Compass className="mr-2 h-4 w-4" />
                Detect My Location
              </>
            )}
          </Button>
        </div>
      )
    }

    if (step.id === "reminders") {
      return (
        <div className="mt-5 w-full">
          <Button
            onClick={handleEnableReminders}
            disabled={reminderStatus === "loading" || reminderStatus === "success"}
            variant={reminderStatus === "success" ? "outline" : "default"}
            className="h-10 w-full rounded-xl font-semibold"
          >
            {reminderStatus === "loading" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enabling Reminders
              </>
            ) : reminderStatus === "success" ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Reminders Enabled
              </>
            ) : (
              <>
                <BellRing className="mr-2 h-4 w-4" />
                Enable Daily Reminders
              </>
            )}
          </Button>
        </div>
      )
    }

    if (step.id === "install") {
      return (
        <div className="mt-5 w-full space-y-2 text-left">
          {getInstallInstructions(pwaContext.platform).map((item, index) => (
            <div
              key={item.text}
              className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                {item.icon}
              </div>
              <p className="pt-0.5 text-sm leading-5 text-foreground">
                <span className="font-semibold">{index + 1}.</span> {item.text}
              </p>
            </div>
          ))}
        </div>
      )
    }

    return null
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-black/40 p-3 backdrop-blur-sm sm:p-6"
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-sm flex-col overflow-y-auto rounded-3xl bg-card shadow-2xl"
          >
            <button
              onClick={finishOnboarding}
              className="absolute right-3 top-3 z-10 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted"
              aria-label="Close onboarding"
            >
              <X size={20} />
            </button>

            <div className="flex min-h-[290px] flex-col items-center px-6 pb-5 pt-10 text-center sm:min-h-[310px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex w-full flex-col items-center"
                >
                  <div className={`mb-5 flex h-24 w-24 items-center justify-center rounded-full border-2 ${step.color}`}>
                    <div className="scale-75">{step.icon}</div>
                  </div>
                  <h2 className="mb-2 text-xl font-bold leading-tight">{step.title}</h2>
                  <p className="max-w-[17rem] text-sm leading-6 text-muted-foreground">{step.description}</p>
                  {renderStepAction()}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex flex-col gap-4 px-6 pb-6">
              <div className="flex justify-center gap-2">
                {steps.map((item, index) => (
                  <div
                    key={item.id}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      index === safeCurrentStep ? "w-8 bg-primary" : "w-2 bg-primary/20"
                    }`}
                  />
                ))}
              </div>

              {isInstallStep ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => handlePwaInstallChoice(true)}
                    disabled={pwaStatus === "loading"}
                    className="h-11 rounded-xl text-base font-semibold"
                  >
                    {pwaStatus === "loading" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Done!
                  </Button>
                  <Button
                    onClick={() => handlePwaInstallChoice(false)}
                    disabled={pwaStatus === "loading"}
                    variant="outline"
                    className="h-11 rounded-xl text-base font-semibold"
                  >
                    Will Do Later
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleNext}
                  variant={isSetupStep ? "ghost" : "default"}
                  className="h-11 w-full rounded-xl text-base font-semibold"
                >
                  {isSetupStep ? "Skip for now" : safeCurrentStep === steps.length - 1 ? "Start My Journey" : "Continue"}
                  {!isSetupStep && safeCurrentStep < steps.length - 1 && <ChevronRight className="ml-2 h-5 w-5" />}
                </Button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
