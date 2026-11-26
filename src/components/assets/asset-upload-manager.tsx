"use client"

import Link from "next/link"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, Check, ChevronDown, ChevronUp, FileText, ImageIcon, RotateCcw, Video, X } from "lucide-react"

import { completeSharedAsset } from "@/lib/auth/shared-asset-actions"
import {
  UploadCanceledError,
  uploadToSignedUrlWithProgress,
  type PreparedAssetUpload,
} from "@/lib/asset-upload-client"
import { fileSizeLabel, sharedFileKind } from "@/lib/shared-assets"

export type AssetUploadStatus = "uploading" | "verifying" | "done" | "error" | "canceled"

export type AssetUploadTask = {
  id: string
  organizationId: string
  folderId: string | null
  projectId: string
  visibility: string
  name: string
  fileName: string
  size: number
  type: string
  previewUrl: string | null
  status: AssetUploadStatus
  loaded: number
  speed: number
  error: string
  assetId: string | null
}

export type StartAssetUpload = {
  organizationId: string
  folderId?: string | null
  projectId?: string
  visibility: string
  name: string
  file: File
  prepared: PreparedAssetUpload
}

type UploadContextValue = {
  tasks: AssetUploadTask[]
  completedCount: number
  start: (input: StartAssetUpload) => void
  cancel: (id: string) => void
  retry: (id: string) => void
  dismissAll: () => void
}

const UploadContext = createContext<UploadContextValue | null>(null)

const AUTO_CLOSE_SECONDS = 3

export function useAssetUploads() {
  const value = useContext(UploadContext)
  if (!value) throw new Error("useAssetUploads must be used inside AssetUploadProvider")
  return value
}

export function useOptionalAssetUploads() {
  return useContext(UploadContext)
}

/** Calls `onComplete` whenever any background upload finishes, so lists can refresh. */
export function useAssetUploadCompletion(onComplete: () => void) {
  const completedCount = useContext(UploadContext)?.completedCount ?? 0
  const callback = useRef(onComplete)
  useEffect(() => {
    callback.current = onComplete
  })
  const seen = useRef(completedCount)
  useEffect(() => {
    if (completedCount !== seen.current) {
      seen.current = completedCount
      callback.current()
    }
  }, [completedCount])
}

function isActive(task: AssetUploadTask) {
  return task.status === "uploading" || task.status === "verifying"
}

export function AssetUploadProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<AssetUploadTask[]>([])
  const [completedCount, setCompletedCount] = useState(0)
  const files = useRef(new Map<string, { file: File; prepared: PreparedAssetUpload; controller: AbortController; uploaded: boolean }>())

  const patch = useCallback((id: string, update: Partial<AssetUploadTask>) => {
    setTasks((rows) => rows.map((row) => (row.id === id ? { ...row, ...update } : row)))
  }, [])

  const run = useCallback(
    async (id: string) => {
      const entry = files.current.get(id)
      if (!entry) return
      const controller = new AbortController()
      entry.controller = controller
      patch(id, entry.uploaded ? { status: "verifying", error: "" } : { status: "uploading", loaded: 0, speed: 0, error: "" })
      let lastTime = performance.now()
      let lastLoaded = 0
      let speed = 0
      try {
        if (!entry.uploaded) await uploadToSignedUrlWithProgress(
          entry.prepared,
          entry.file,
          (loaded) => {
            const now = performance.now()
            const seconds = (now - lastTime) / 1000
            if (seconds >= 0.25) {
              const current = (loaded - lastLoaded) / seconds
              speed = speed ? speed * 0.7 + current * 0.3 : current
              lastTime = now
              lastLoaded = loaded
              patch(id, { loaded, speed })
            }
          },
          controller.signal
        )
        entry.uploaded = true
        patch(id, { status: "verifying", loaded: entry.file.size })
        const completed = await completeSharedAsset(entry.prepared.ticket)
        if (!completed.ok) throw new Error(completed.message)
        patch(id, { status: "done", assetId: completed.assetId })
        setCompletedCount((value) => value + 1)
      } catch (error) {
        if (error instanceof UploadCanceledError) patch(id, { status: "canceled", error: "" })
        else patch(id, { status: "error", error: error instanceof Error ? error.message : "Upload failed." })
      }
    },
    [patch]
  )

  const start = useCallback(
    (input: StartAssetUpload) => {
      const id = crypto.randomUUID()
      const kind = sharedFileKind(input.file.name)
      const type = kind?.type ?? "other"
      const previewUrl = type === "video" || type === "image" ? URL.createObjectURL(input.file) : null
      files.current.set(id, { file: input.file, prepared: input.prepared, controller: new AbortController(), uploaded: false })
      setTasks((rows) => [
        ...rows,
        {
          id,
          organizationId: input.organizationId,
          folderId: input.folderId ?? null,
          projectId: input.projectId ?? "",
          visibility: input.visibility,
          name: input.name,
          fileName: input.file.name,
          size: input.file.size,
          type,
          previewUrl,
          status: "uploading",
          loaded: 0,
          speed: 0,
          error: "",
          assetId: null,
        },
      ])
      void run(id)
    },
    [run]
  )

  const cancel = useCallback((id: string) => files.current.get(id)?.controller.abort(), [])
  const retry = useCallback((id: string) => void run(id), [run])

  const dismissAll = useCallback(() => {
    setTasks((rows) => {
      const keep = rows.filter(isActive)
      for (const row of rows) {
        if (isActive(row)) continue
        if (row.previewUrl) URL.revokeObjectURL(row.previewUrl)
        files.current.delete(row.id)
      }
      return keep
    })
  }, [])

  // Warn before closing the tab while something is still uploading.
  const active = tasks.some(isActive)
  useEffect(() => {
    if (!active) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [active])

  const value = useMemo(
    () => ({ tasks, completedCount, start, cancel, retry, dismissAll }),
    [tasks, completedCount, start, cancel, retry, dismissAll]
  )

  return (
    <UploadContext.Provider value={value}>
      {children}
      <AssetUploadTray />
    </UploadContext.Provider>
  )
}

function percent(task: AssetUploadTask) {
  if (task.status === "done" || task.status === "verifying") return 100
  return task.size ? Math.min(100, Math.round((task.loaded / task.size) * 100)) : 0
}

function timeLeft(task: AssetUploadTask) {
  if (!task.speed) return ""
  const seconds = Math.ceil((task.size - task.loaded) / task.speed)
  if (seconds <= 1) return "almost done"
  return seconds < 60 ? `${seconds} s left` : `${Math.ceil(seconds / 60)} min left`
}

function statusLine(task: AssetUploadTask) {
  switch (task.status) {
    case "uploading": {
      const left = timeLeft(task)
      return `${percent(task)}% · ${fileSizeLabel(task.loaded)} of ${fileSizeLabel(task.size)}${left ? " · " + left : ""}`
    }
    case "verifying":
      return "Checking and saving…"
    case "done":
      return "Uploaded"
    case "canceled":
      return "Canceled"
    case "error":
      return task.error || "Upload failed."
  }
}

export function UploadTypeIcon({ type, className = "size-4" }: { type: string; className?: string }) {
  const Icon = type === "image" ? ImageIcon : type === "video" ? Video : FileText
  return <Icon className={className} aria-hidden />
}

function TaskThumb({ task }: { task: AssetUploadTask }) {
  return (
    <div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[linear-gradient(135deg,var(--color-navy-500),var(--color-teal-500))] text-white">
      {task.previewUrl && task.type === "video" ? (
        <video src={task.previewUrl} muted playsInline preload="metadata" className="absolute inset-0 size-full object-cover" />
      ) : task.previewUrl && task.type === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element -- local blob preview
        <img src={task.previewUrl} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <UploadTypeIcon type={task.type} />
      )}
    </div>
  )
}

export function ProgressRing({ value, size = 28, stroke = 3.5, className = "" }: { value: number; size?: number; stroke?: number; className?: string }) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={"-rotate-90 " + className} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - value / 100)}
        className="transition-[stroke-dashoffset] duration-300 ease-out"
      />
    </svg>
  )
}

function AssetUploadTray() {
  const { tasks, cancel, retry, dismissAll } = useAssetUploads()
  const [collapsed, setCollapsed] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)

  const activeCount = tasks.filter(isActive).length
  const failedCount = tasks.filter((task) => task.status === "error").length
  const allFinished = tasks.length > 0 && activeCount === 0
  const autoClose = allFinished && failedCount === 0

  // Close the tray by itself a few seconds after every upload finished without errors.
  useEffect(() => {
    if (!autoClose) return
    let seconds = AUTO_CLOSE_SECONDS
    const tick = window.setInterval(() => {
      seconds -= 1
      if (seconds <= 0) {
        window.clearInterval(tick)
        setCountdown(null)
        dismissAll()
      } else setCountdown(seconds)
    }, 1000)
    const first = window.setTimeout(() => setCountdown(AUTO_CLOSE_SECONDS), 0)
    return () => {
      window.clearInterval(tick)
      window.clearTimeout(first)
      setCountdown(null)
    }
  }, [autoClose, dismissAll])

  if (!tasks.length) return null

  const total = tasks.reduce((sum, task) => sum + task.size, 0)
  const sent = tasks.reduce((sum, task) => sum + (task.status === "uploading" ? task.loaded : isActive(task) || task.status === "done" ? task.size : 0), 0)
  const overall = total ? Math.round((sent / total) * 100) : 0

  const title = activeCount
    ? `Uploading ${activeCount} ${activeCount === 1 ? "file" : "files"} · ${overall}%`
    : failedCount
      ? `${failedCount} ${failedCount === 1 ? "upload" : "uploads"} need attention`
      : `${tasks.length} ${tasks.length === 1 ? "upload" : "uploads"} complete`

  return (
    <section
      aria-label="File uploads"
      className="roaya-upload-tray fixed right-5 bottom-20 z-[55] w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-border bg-background shadow-[0_18px_40px_-12px_rgb(22_33_58/0.35)]"
    >
      <header className="flex items-center gap-2 bg-[var(--color-navy-700,#26395a)] px-4 py-3 text-white">
        {activeCount ? <ProgressRing value={overall} size={20} stroke={3} className="shrink-0 text-[var(--color-teal-300,#9fd8df)]" /> : failedCount ? <AlertCircle className="size-4 shrink-0" aria-hidden /> : <Check className="size-4 shrink-0" aria-hidden />}
        <p role="status" aria-live="polite" className="min-w-0 flex-1 truncate text-sm font-semibold">
          {title}
          {countdown ? <span className="ms-1 font-normal opacity-80">· closing in {countdown}</span> : null}
        </p>
        <button
          type="button"
          className="rounded-md p-1 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
          aria-label={collapsed ? "Expand uploads" : "Collapse uploads"}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
        </button>
        {allFinished ? (
          <button type="button" className="rounded-md p-1 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white" aria-label="Close uploads" onClick={dismissAll}>
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </header>
      {collapsed ? null : (
        <ul className="max-h-72 divide-y divide-border overflow-y-auto">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center gap-3 px-4 py-3">
              <TaskThumb task={task} />
              <div className="min-w-0 flex-1">
                {task.status === "done" && task.assetId ? (
                  <Link href={"/assets/" + task.assetId} className="block truncate text-sm font-medium hover:text-primary">
                    {task.name}
                  </Link>
                ) : (
                  <p className="truncate text-sm font-medium">{task.name}</p>
                )}
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={
                      "roaya-upload-bar h-full rounded-full transition-[width] duration-300 ease-out " +
                      (task.status === "error" ? "bg-destructive" : task.status === "canceled" ? "bg-muted-foreground/40" : task.status === "done" ? "bg-emerald-600" : "bg-[linear-gradient(90deg,var(--color-navy-500),var(--color-teal-500))]") +
                      (isActive(task) ? " is-active" : "")
                    }
                    style={{ width: (task.status === "canceled" ? percent(task) : task.status === "error" ? 100 : percent(task)) + "%" }}
                  />
                </div>
                <p className={"mt-1 truncate text-xs " + (task.status === "error" ? "text-destructive" : task.status === "done" ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")} title={statusLine(task)}>
                  {statusLine(task)}
                </p>
              </div>
              {task.status === "uploading" ? (
                <button type="button" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={"Cancel upload of " + task.name} title="Cancel" onClick={() => cancel(task.id)}>
                  <X className="size-4" aria-hidden />
                </button>
              ) : task.status === "error" || task.status === "canceled" ? (
                <button type="button" className="rounded-md p-1.5 text-primary hover:bg-muted" aria-label={"Retry upload of " + task.name} title="Retry" onClick={() => retry(task.id)}>
                  <RotateCcw className="size-4" aria-hidden />
                </button>
              ) : task.status === "done" ? (
                <span className="flex size-6 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <Check className="size-3.5" aria-hidden />
                </span>
              ) : (
                <span className="size-4 animate-spin rounded-full border-2 border-muted border-t-primary" aria-hidden />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Cards shown at the top of the Assets grid for uploads that are still running, or finished but not yet in the reloaded list. */
export function PendingAssetCards({
  organizationId,
  folderId,
  knownAssetIds,
}: {
  organizationId: string
  folderId: string | null
  knownAssetIds: Set<string>
}) {
  const { tasks, cancel, retry } = useAssetUploads()
  const visible = tasks.filter(
    (task) =>
      task.organizationId === organizationId &&
      (folderId === null || task.folderId === folderId) &&
      task.status !== "canceled" &&
      !(task.assetId && knownAssetIds.has(task.assetId))
  )
  return visible.map((task) => (
    <li key={task.id} className="roaya-glass roaya-upload-card flex flex-col p-5" aria-busy={isActive(task)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="relative flex h-24 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[linear-gradient(135deg,var(--color-navy-500),var(--color-teal-500))] text-white">
          {task.previewUrl && task.type === "video" ? (
            <video src={task.previewUrl} muted playsInline preload="metadata" className="absolute inset-0 size-full object-cover" />
          ) : task.previewUrl && task.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview
            <img src={task.previewUrl} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <UploadTypeIcon type={task.type} className="size-7" />
          )}
          <div className={"absolute inset-0 flex items-center justify-center bg-[rgb(15_25_45/0.45)] transition-opacity duration-500 " + (task.status === "done" ? "opacity-0" : "opacity-100")}>
            {task.status === "error" ? (
              <AlertCircle className="size-8" aria-hidden />
            ) : (
              <div className="relative flex items-center justify-center">
                <ProgressRing value={percent(task)} size={46} stroke={4} className="text-white" />
                <span className="absolute text-[11px] font-bold">{task.status === "verifying" ? <Check className="size-4" aria-hidden /> : percent(task) + "%"}</span>
              </div>
            )}
          </div>
        </div>
        <span className={"rounded-full px-2.5 py-1 text-[11px] font-semibold " + (task.status === "error" ? "bg-destructive/10 text-destructive" : task.status === "done" ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400" : "bg-primary/10 text-primary")}>
          {task.status === "error" ? "Failed" : task.status === "done" ? "New" : task.status === "verifying" ? "Saving" : "Uploading"}
        </span>
      </div>
      <p className="truncate text-base font-semibold">{task.name}</p>
      <p className={"mt-2 text-sm leading-6 " + (task.status === "error" ? "text-destructive" : "text-muted-foreground")}>{statusLine(task)}</p>
      <p className="mt-4 text-xs text-muted-foreground">
        {task.type.charAt(0).toUpperCase() + task.type.slice(1)} · {fileSizeLabel(task.size)}
      </p>
      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        {task.status === "uploading" ? (
          <button type="button" className="text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => cancel(task.id)}>
            Cancel upload
          </button>
        ) : task.status === "error" ? (
          <button type="button" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary" onClick={() => retry(task.id)}>
            <RotateCcw className="size-4" aria-hidden /> Retry
          </button>
        ) : null}
      </div>
    </li>
  ))
}
