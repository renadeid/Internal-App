"use client"

import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowUp, RotateCcw, Sparkles, X } from "lucide-react"

import { START_TOUR_EVENT } from "@/components/onboarding/spotlight-tour"
import { Button } from "@/components/ui/button"

/** Fire this event to open the assistant from anywhere. */
export const OPEN_ASSISTANT_EVENT = "roaya:open-assistant"

type Msg = { role: "user" | "assistant"; content: string; error?: boolean }

const STORAGE_KEY = "roaya-ask-connect-v1"

const SUGGESTIONS = [
  "What should I do first?",
  "How do I create a project?",
  "How do I give someone project access?",
  "Where do I find shared files?",
]

function greeting(firstName: string): Msg {
  return {
    role: "assistant",
    content: `Hi${firstName ? ` ${firstName}` : ""}, I am Ask Connect.\nAsk me how to do anything in Roaya Connect, or pick a question below.`,
  }
}

/** Turn "(/projects)" style paths in a reply into links. */
function renderText(text: string, onNavigate: () => void) {
  const parts = text.split(/(\(\/[a-z0-9/_-]*\))/gi)
  return parts.map((part, i) => {
    const m = part.match(/^\((\/[a-z0-9/_-]*)\)$/i)
    if (!m) return <Fragment key={i}>{part}</Fragment>
    return (
      <Link key={i} href={m[1]} onClick={onNavigate} className="font-medium text-primary underline underline-offset-2">
        ({m[1]})
      </Link>
    )
  })
}

export function AskConnect({ firstName }: { firstName: string }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null") as Msg[] | null
        if (Array.isArray(saved) && saved.length) return saved
      } catch {
        /* ignore */
      }
    }
    return [greeting(firstName)]
  })
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)

  // Keep the conversation for this browser tab.
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)))
    } catch {
      /* ignore */
    }
  }, [messages])

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(OPEN_ASSISTANT_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, onOpen)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    window.setTimeout(() => launcherRef.current?.focus(), 0)
  }, [])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, close])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, loading, open])

  const send = async (text: string) => {
    const question = text.trim()
    if (!question || loading) return
    const next: Msg[] = [...messages, { role: "user", content: question }]
    setMessages(next)
    setInput("")
    setLoading(true)
    try {
      const history = next
        .filter((m) => !m.error)
        .slice(1) // drop the local greeting
        .slice(-12)
        .map(({ role, content }) => ({ role, content }))
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history }),
      })
      const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string }
      if (res.ok && data.reply) {
        setMessages((m) => [...m, { role: "assistant", content: data.reply as string }])
      } else {
        const content =
          data.error === "not_configured"
            ? "Ask Connect is not switched on yet: an admin needs to add the AI key to the app's settings. Meanwhile, the Knowledge base (/knowledge) has step-by-step guides."
            : data.error === "busy"
              ? "Ask Connect is very busy right now. Please try again in a minute."
              : data.error === "unauthorized"
              ? "Your session has ended. Please sign in again."
              : "Sorry, I could not answer that just now. Please try again in a moment."
        setMessages((m) => [...m, { role: "assistant", content, error: true }])
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Sorry, I could not reach the assistant. Check your connection and try again.", error: true },
      ])
    } finally {
      setLoading(false)
    }
  }

  const startOver = () => {
    setMessages([greeting(firstName)])
    setInput("")
  }

  const replayTour = () => {
    setOpen(false)
    window.dispatchEvent(new Event(START_TOUR_EVENT))
  }

  const asked = new Set(messages.filter((m) => m.role === "user").map((m) => m.content))
  const suggestions = SUGGESTIONS.filter((s) => !asked.has(s))

  return (
    <>
      {!open ? (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => setOpen(true)}
          className="fixed right-5 bottom-5 z-[60] flex h-12 items-center gap-2 rounded-full bg-[linear-gradient(90deg,#344d6e,var(--color-navy-500),var(--color-teal-500))] px-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgb(61_90_128/0.45)] transition-transform hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Sparkles className="size-4" aria-hidden="true" />
          Ask Connect
        </button>
      ) : null}

      {open ? (
        <aside
          role="dialog"
          aria-label="Ask Connect assistant"
          className="roaya-assistant-panel fixed inset-y-0 right-0 z-[70] flex w-full flex-col border-l border-border bg-background text-foreground shadow-[-24px_0_60px_rgb(15_27_42/0.18)] sm:w-[420px]"
        >
          <header className="flex items-center gap-3 border-b border-border px-5 py-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--color-navy-500),var(--color-teal-500),#6b4c9a)] text-white">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <span className="flex flex-1 flex-col">
              <strong className="text-[15px]">Ask Connect</strong>
              <span className="text-xs text-muted-foreground">Your guide to Roaya Connect</span>
            </span>
            <Button variant="ghost" size="icon" aria-label="Start a new conversation" title="Start over" onClick={startOver}>
              <RotateCcw />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Close assistant" onClick={close}>
              <X />
            </Button>
          </header>

          <div ref={logRef} className="flex flex-1 flex-col gap-3 overflow-y-auto bg-muted/40 p-5" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-md bg-[var(--color-navy-500)] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line text-white"
                      : `max-w-[85%] rounded-2xl rounded-bl-md border px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line ${m.error ? "border-amber-300 bg-amber-50 text-amber-950" : "border-border bg-background"}`
                  }
                >
                  {m.role === "assistant" ? renderText(m.content, () => setOpen(false)) : m.content}
                </div>
              </div>
            ))}
            {loading ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-border bg-background px-3.5 py-3" aria-label="Ask Connect is typing">
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.2s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.1s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 border-t border-border px-5 pt-3.5 pb-5">
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={loading}
                  onClick={() => void send(s)}
                  className="min-h-8 rounded-full border border-border bg-background px-3 text-[13px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
              <button
                type="button"
                onClick={replayTour}
                className="min-h-8 rounded-full border border-dashed border-border px-3 text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Replay the welcome tour
              </button>
            </div>
            <form
              className="flex items-end gap-2 rounded-xl border border-input bg-background p-1.5 pl-3 focus-within:ring-3 focus-within:ring-ring/50"
              onSubmit={(e) => {
                e.preventDefault()
                void send(input)
              }}
            >
              <label htmlFor="ask-connect-input" className="sr-only">
                Ask a question about Roaya Connect
              </label>
              <textarea
                id="ask-connect-input"
                ref={inputRef}
                rows={1}
                value={input}
                maxLength={2000}
                placeholder="Ask anything about Connect…"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    void send(input)
                  }
                }}
                className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
              <Button type="submit" size="icon-lg" aria-label="Send" disabled={loading || !input.trim()}>
                <ArrowUp />
              </Button>
            </form>
            <p className="text-[11px] text-muted-foreground">Ask Connect can make mistakes. Check important steps in the Knowledge base.</p>
          </div>
        </aside>
      ) : null}
    </>
  )
}
