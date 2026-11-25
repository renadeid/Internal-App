"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { Check, X } from "lucide-react"

import { Button } from "@/components/ui/button"

/** Fire this event (e.g. from the profile menu) to replay the tour. */
export const START_TOUR_EVENT = "roaya:start-tour"

type TourStep = { target: string; title: string; body: string }

const STEPS: TourStep[] = [
  {
    target: "sidebar",
    title: "Everything lives in the sidebar",
    body: "Dashboard, Projects, My tasks, Activity, Assets, the Artifact hub and the Knowledge base are always one click away.",
  },
  {
    target: "search",
    title: "Find anything in seconds",
    body: "Search projects, tasks, files and people from anywhere in Connect.",
  },
  {
    target: "create",
    title: "Start something new",
    body: "Quick create starts a project, invites your team and sets a due date, so everyone sees the same plan.",
  },
  {
    target: "tasks",
    title: "Your tasks, in one list",
    body: "Everything assigned to you, sorted by due date. Open a task to see its project and brief.",
  },
  {
    target: "notifications",
    title: "Stay in the loop",
    body: "Mentions, reviews, approvals and project invitations arrive here, so nothing gets lost in chat or email.",
  },
  {
    target: "nav-people",
    title: "Meet your team",
    body: "People & onboarding lists who does what, and holds your onboarding plan.",
  },
]

type Rect = { top: number; left: number; width: number; height: number }

const PAD = 6
const CARD_W = 340

function findTarget(target: string): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 ? el : null
}

function storageKey(userKey: string) {
  return `roaya-tour-v1:${userKey}`
}

export function SpotlightTour({ userKey, firstName }: { userKey: string; firstName: string }) {
  const pathname = usePathname()
  // phase: "off" | "intro" | "step" | "done"
  const [phase, setPhase] = useState<"off" | "intro" | "step" | "done">("off")
  const [steps, setSteps] = useState<TourStep[]>([])
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const skipRef = useRef<() => void>(() => {})
  const startRef = useRef<HTMLButtonElement>(null)

  const markSeen = () => {
    try {
      localStorage.setItem(storageKey(userKey), new Date().toISOString())
    } catch {
      /* storage may be unavailable; the tour simply shows again */
    }
  }

  const open = useCallback(() => {
    setIndex(0)
    setRect(null)
    setPhase("intro")
  }, [])

  // First visit to the dashboard: show the welcome card once per user.
  useEffect(() => {
    if (pathname !== "/") return
    let seen = false
    try {
      seen = Boolean(localStorage.getItem(storageKey(userKey)))
    } catch {
      seen = true
    }
    if (seen) return
    const id = window.setTimeout(open, 600)
    return () => window.clearTimeout(id)
  }, [pathname, userKey, open])

  // Replay from anywhere (profile menu).
  useEffect(() => {
    const onStart = () => open()
    window.addEventListener(START_TOUR_EVENT, onStart)
    return () => window.removeEventListener(START_TOUR_EVENT, onStart)
  }, [open])

  const begin = () => {
    const available = STEPS.filter((s) => findTarget(s.target))
    if (!available.length) {
      finish()
      return
    }
    setSteps(available)
    setIndex(0)
    setPhase("step")
  }

  function finish() {
    markSeen()
    setPhase("done")
  }

  function skip() {
    markSeen()
    setPhase("off")
  }

  const step = phase === "step" ? steps[index] : undefined

  // Measure the current target, and keep it measured while the page scrolls or resizes.
  useLayoutEffect(() => {
    if (!step) return
    const el = findTarget(step.target)
    if (!el) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    el.scrollIntoView({ block: "center", inline: "nearest", behavior: reduce ? "auto" : "smooth" })
    const measure = () => {
      const r = el.getBoundingClientRect()
      setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 })
    }
    measure()
    const t = window.setTimeout(measure, 350)
    window.addEventListener("resize", measure)
    window.addEventListener("scroll", measure, true)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener("resize", measure)
      window.removeEventListener("scroll", measure, true)
    }
  }, [step])

  useEffect(() => {
    skipRef.current = skip
  })

  // Focus the primary action and support the keyboard while the tour is open.
  useEffect(() => {
    if (phase === "intro") startRef.current?.focus()
    if (phase === "step") nextRef.current?.focus()
    if (phase !== "intro" && phase !== "step") return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skipRef.current()
      if (phase !== "step") return
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, steps.length - 1))
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0))
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [phase, index, steps.length])

  // The "done" toast hides on its own.
  useEffect(() => {
    if (phase !== "done") return
    const id = window.setTimeout(() => setPhase("off"), 6000)
    return () => window.clearTimeout(id)
  }, [phase])

  if (phase === "off") return null

  if (phase === "intro") {
    return (
      <div className="roaya-tour-backdrop fixed inset-0 z-[80] flex items-center justify-center bg-[#0b1220]/60 p-4 backdrop-blur-[3px]">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="roaya-tour-title"
          className="roaya-tour-pop w-full max-w-[520px] rounded-3xl bg-background p-8 text-foreground ring-1 ring-border shadow-2xl"
        >
          <span
            aria-hidden="true"
            className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--color-navy-500),var(--color-teal-500),#6b4c9a)]"
          >
            <span className="block h-7 w-9 overflow-hidden">
              <Image src="/branding/roaya-logo.png" alt="" width={1348} height={371} unoptimized className="h-7 w-auto max-w-none brightness-0 invert" />
            </span>
          </span>
          <h2 id="roaya-tour-title" className="text-3xl font-extrabold tracking-tight">
            Welcome to Roaya Connect{firstName ? `, ${firstName}` : ""}.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Take a one-minute tour of the places you will use every day. You can replay it any time from your profile menu.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button ref={startRef} size="lg" onClick={begin}>
              Start the tour
            </Button>
            <Button size="lg" variant="outline" onClick={skip}>
              I will explore myself
            </Button>
          </div>
        </section>
      </div>
    )
  }

  if (phase === "done") {
    return (
      <div
        role="status"
        className="roaya-tour-pop fixed right-6 bottom-6 z-[80] flex w-[min(360px,calc(100vw-3rem))] gap-3.5 rounded-2xl bg-[#0f1b2a] p-5 text-slate-100 shadow-2xl"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-teal-500)] text-[#0f1b2a]">
          <Check className="size-5" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <strong className="text-[15px]">You are all set</strong>
          <span className="text-[13px] text-slate-300">Replay the tour any time from your profile menu.</span>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={() => setPhase("off")}
          className="ml-auto self-start rounded-md p-1 text-slate-300 hover:text-white"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    )
  }

  if (!step) return null

  // Place the card below the target when there is room, otherwise above it; keep it on screen.
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280
  const vh = typeof window !== "undefined" ? window.innerHeight : 800
  const cardW = Math.min(CARD_W, vw - 32)
  let cardTop = 24
  let cardLeft = 16
  if (rect) {
    const below = rect.top + rect.height + 12
    const roomBelow = vh - below
    const beside = rect.height > vh * 0.45
    if (beside) {
      const right = rect.left + rect.width + 16
      cardLeft = right + cardW < vw - 16 ? right : Math.max(16, rect.left - cardW - 16)
      cardTop = Math.min(Math.max(16, rect.top + 24), vh - 260)
    } else {
      cardTop = roomBelow > 240 ? below : Math.max(16, rect.top - 12 - 230)
      cardLeft = Math.min(Math.max(16, rect.left), vw - cardW - 16)
    }
  }
  const last = index === steps.length - 1

  return (
    <div className="fixed inset-0 z-[80]" aria-live="polite">
      {rect ? (
        <div
          aria-hidden="true"
          className="roaya-tour-spot pointer-events-none fixed rounded-[14px] outline-2 outline-offset-2 outline-[var(--color-teal-500)]"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      ) : (
        <div aria-hidden="true" className="fixed inset-0 bg-[#0b1220]/60" />
      )}
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="roaya-tour-step-title"
        aria-describedby="roaya-tour-step-body"
        className="roaya-tour-card fixed flex flex-col gap-3 rounded-2xl bg-background p-5 text-foreground shadow-2xl ring-1 ring-border"
        style={{ top: cardTop, left: cardLeft, width: cardW }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold tracking-wider text-primary uppercase">
            Step {index + 1} of {steps.length}
          </span>
          <button type="button" onClick={skip} className="min-h-8 text-[13px] text-muted-foreground hover:text-foreground">
            Skip tour
          </button>
        </div>
        <h2 id="roaya-tour-step-title" className="text-lg font-bold tracking-tight">
          {step.title}
        </h2>
        <p id="roaya-tour-step-body" className="text-sm leading-relaxed text-muted-foreground">
          {step.body}
        </p>
        <div className="flex items-center justify-between pt-1">
          <span className="flex gap-1.5" aria-hidden="true">
            {steps.map((s, k) => (
              <span
                key={s.target}
                className="h-1.5 rounded-full transition-all"
                style={{ width: k === index ? 18 : 6, background: k <= index ? "var(--color-navy-500)" : "var(--color-navy-200, #cbd5e1)" }}
              />
            ))}
          </span>
          <span className="flex gap-2">
            <Button variant="outline" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
              Back
            </Button>
            <Button ref={nextRef} onClick={() => (last ? finish() : setIndex((i) => i + 1))}>
              {last ? "Finish" : "Next"}
            </Button>
          </span>
        </div>
      </section>
    </div>
  )
}
