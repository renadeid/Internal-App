"use client"

import { useState, type ReactNode } from "react"
import { ChevronLeft, ChevronRight, Search, UsersRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Member = { id: string; name: string; email: string }

export function MemberDirectory<T extends Member>({ members, label, renderActions, filters = [] }: {
  members: T[]
  label: string
  renderActions: (member: T) => ReactNode
  filters?: { id: string; label: string; matches: (member: T) => boolean }[]
}) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(6)
  const needle = query.trim().toLowerCase()
  const selected = filters.find(option => option.id === filter)
  const matching = members.filter(member => (!needle || (member.name + " " + member.email).toLowerCase().includes(needle)) && (!selected || selected.matches(member)))
  const pages = Math.max(1, Math.ceil(matching.length / pageSize))
  const currentPage = Math.min(page, pages)
  const offset = (currentPage - 1) * pageSize
  const visible = matching.slice(offset, offset + pageSize)
  return <div className="overflow-hidden rounded-xl border border-border bg-background/50">
    <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row">
      <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute start-3 top-3.5 size-4 text-muted-foreground" aria-hidden /><Input className="h-11 ps-9" type="search" aria-label={"Search " + label} placeholder="Search name or email…" value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} /></div>
      {filters.length ? <select aria-label={"Filter " + label} className="h-11 rounded-xl border border-border bg-card px-3 text-sm" value={filter} onChange={event => { setFilter(event.target.value); setPage(1) }}><option value="all">All members</option>{filters.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select> : null}
    </div>
    {visible.length ? <ul aria-label={label} className="divide-y divide-border">{visible.map(member => <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div className="flex min-w-0 flex-1 items-center gap-3"><span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">{member.name.split(/\s+/).slice(0,2).map(word => word[0]).join("").toUpperCase()}</span><div className="min-w-0"><p className="truncate text-sm font-medium" title={member.name}>{member.name}</p><p className="truncate text-xs text-muted-foreground" title={member.email}>{member.email}</p></div></div><div className="shrink-0">{renderActions(member)}</div></li>)}</ul> : <div className="grid justify-items-center gap-2 px-5 py-10 text-center"><UsersRound className="size-7 text-muted-foreground" aria-hidden /><p className="text-sm font-medium">{members.length ? "No members match your filters" : "No members available"}</p>{members.length ? <Button size="sm" variant="outline" onClick={() => { setQuery(""); setFilter("all"); setPage(1) }}>Clear filters</Button> : null}</div>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/30 px-4 py-3">
      <p role="status" className="text-xs text-muted-foreground">{matching.length ? `${offset + 1}–${offset + visible.length} of ${matching.length} members` : "0 members"}</p>
      <div className="flex flex-wrap items-center gap-2"><select aria-label={"Members per page in " + label} value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1) }} className="h-8 rounded-lg border border-border bg-card px-2 text-xs">{[6,12,24].map(size => <option key={size} value={size}>{size} / page</option>)}</select><Button size="icon" variant="outline" className="size-8" aria-label={"Previous page in " + label} disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="size-4" aria-hidden /></Button><span className="min-w-10 text-center text-xs tabular-nums">{currentPage} / {pages}</span><Button size="icon" variant="outline" className="size-8" aria-label={"Next page in " + label} disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}><ChevronRight className="size-4" aria-hidden /></Button></div>
    </div>
  </div>
}
