"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { Search } from "lucide-react"

import { useLiveWorkspace } from "@/components/workspace/live-workspace-provider"
import { mainNav, utilityNav, workspaceNav } from "@/components/layout/navigation"


import { Input } from "@/components/ui/input"
import type { AppHref } from "@/lib/types"
import { cn } from "@/lib/utils"

type SearchResult = {
  id: string
  group: string
  label: string
  detail: string
  href: AppHref
}

const pages = [...mainNav, ...workspaceNav, ...utilityNav]

export function SearchField() {
  const { result: live } = useLiveWorkspace()
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const results = useMemo(
    () => buildResults(query, live?.status==="ready"?live.projects:[], live?.status==="ready"?live.tasks:[], live?.status==="ready"?live.campaigns:[], live?.status==="ready"?live.assets:[]),
    [live, query]
  )

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  return (
    <div ref={containerRef} className="relative min-w-0">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Search projects, tasks, and pages"
        placeholder="Search"
        className="h-9 bg-background pl-8"
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false)
          }
          if (event.key === "Enter" && results[0]) {
            event.preventDefault()
            const href = results[0].href
            setOpen(false)
            setQuery("")
            router.push(href)
          }
        }}
      />
      {open ? (
        <div
          id={listId}
          role="region"
          aria-label="Search results"
          className="absolute top-[calc(100%+0.5rem)] right-0 left-0 z-40 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
        >
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No matches for “{query.trim()}”.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto p-1.5">
              {results.map((result, index) => {
                const previous = results[index - 1]
                const showGroup = !previous || previous.group !== result.group
                return (
                  <li key={result.id}>
                    {showGroup ? (
                      <p className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                        {result.group}
                      </p>
                    ) : null}
                    <Link
                      href={result.href}
                      className={cn(
                        "flex flex-col rounded-lg px-2 py-2 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                      )}
                      onClick={() => {
                        setOpen(false)
                        setQuery("")
                      }}
                    >
                      <span className="text-sm font-medium text-foreground">
                        {result.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {result.detail}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}

function buildResults(
  query: string,
  projects: { id: string; name: string; leadDepartment: string|null; description: string }[],
  tasks: { id: string; title: string; status: string }[],
  campaigns: { id: string; name: string; status: string; type: string }[],
  assets: { id: string; name: string; type: string; archivedAt?: string|null }[]
): SearchResult[] {
  const normalized = query.trim().toLowerCase()
  const pageResults: SearchResult[] = pages
    .filter((page) => !normalized || page.label.toLowerCase().includes(normalized))
    .map((page) => ({
      id: `page-${page.href}`,
      group: normalized ? "Pages" : "Jump to",
      label: page.label,
      detail: "Page",
      href: page.href,
    }))

  if (!normalized) return pageResults.slice(0, 6)

  const projectResults: SearchResult[] = projects
    .filter((project) =>
      `${project.name} ${project.leadDepartment??""} ${project.description}`
        .toLowerCase()
        .includes(normalized)
    )
    .slice(0, 5)
    .map((project) => ({
      id: `project-${project.id}`,
      group: "Projects",
      label: project.name,
      detail: project.leadDepartment||"Project",
      href: `/projects/${project.id}`,
    }))

  const campaignResults: SearchResult[] = campaigns
    .filter((campaign) =>
      `${campaign.name} ${campaign.type} ${campaign.status}`
        .toLowerCase()
        .includes(normalized)
    )
    .slice(0, 4)
    .map((campaign) => ({
      id: `campaign-${campaign.id}`,
      group: "Campaigns",
      label: campaign.name,
      detail: campaign.status,
      href: `/workspaces/marketing/campaigns/${campaign.id}`,
    }))

  const assetResults: SearchResult[] = assets
    .filter(
      (asset) => !asset.archivedAt && asset.name.toLowerCase().includes(normalized)
    )
    .slice(0, 4)
    .map((asset) => ({
      id: `asset-${asset.id}`,
      group: "Assets",
      label: asset.name,
      detail: asset.type,
      href: `/assets/${asset.id}`,
    }))

  const taskResults: SearchResult[] = tasks
    .filter((task) => task.title.toLowerCase().includes(normalized))
    .slice(0, 5)
    .map((task) => ({
      id: `task-${task.id}`,
      group: "Tasks",
      label: task.title,
      detail: task.status,
      href: "/tasks",
    }))

  return [
    ...pageResults.slice(0, 4),
    ...projectResults,
    ...campaignResults,
    ...assetResults,
    ...taskResults,
  ]
}
