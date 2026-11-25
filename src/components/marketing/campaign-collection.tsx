"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowUpRight, CalendarDays, CheckCircle2, CirclePause, FolderKanban, Megaphone, Radio, Search, Sparkles, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { campaignStatusLabel, campaignStatusValues, campaignTypeLabel, campaignTypeValues, type OrganizationCampaign } from "@/lib/auth/organization-campaigns"
import { dateRange } from "@/lib/dates"
import { compareCampaigns } from "@/lib/campaign-sort"

const stages = {
  planning: { icon: Sparkles, tone: "text-violet-600 dark:text-violet-300", bar: "bg-violet-500" },
  active: { icon: Radio, tone: "text-teal-700 dark:text-teal-300", bar: "bg-teal-500" },
  on_hold: { icon: CirclePause, tone: "text-amber-700 dark:text-amber-300", bar: "bg-amber-500" },
  completed: { icon: CheckCircle2, tone: "text-primary", bar: "bg-primary" },
}
const selectClass = "h-11 min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring"

export function CampaignCollection({ campaigns, showProject, showArchived, canCreate, onCreate }: {
  campaigns: OrganizationCampaign[]
  showProject: boolean
  showArchived: boolean
  canCreate: boolean
  onCreate: () => void
}) {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [type, setType] = useState("all")
  const [project, setProject] = useState("all")
  const [sort, setSort] = useState("ending")
  const current = campaigns.filter(campaign => !campaign.archivedAt)
  const available = showArchived ? campaigns : current
  const projects = [...new Map(campaigns.map(campaign => [campaign.projectId, { id: campaign.projectId, name: campaign.projectName ?? "Project unavailable" }])).values()].sort((a, b) => a.name.localeCompare(b.name))
  const needle = query.trim().toLowerCase()
  const filtered = available.filter(campaign =>
    (status === "all" || campaign.status === status) &&
    (type === "all" || campaign.type === type) &&
    (project === "all" || campaign.projectId === project) &&
    (!needle || [campaign.name, campaign.description, campaign.ownerName, campaign.projectName].join(" ").toLowerCase().includes(needle))
  ).sort((a, b) => compareCampaigns(a, b, sort))
  const hasFilters = Boolean(needle || status !== "all" || type !== "all" || project !== "all")
  function clearFilters() { setQuery(""); setStatus("all"); setType("all"); setProject("all") }

  return <div className="grid gap-6">
    {showProject ? <section aria-label="Current campaign stages" className="roaya-glass grid grid-cols-2 overflow-hidden rounded-2xl border border-border lg:grid-cols-4">
      {campaignStatusValues.map(stage => {
        const count = current.filter(campaign => campaign.status === stage).length
        const { icon: Icon, tone, bar } = stages[stage]
        return <button key={stage} type="button" aria-pressed={status === stage} onClick={() => setStatus(status === stage ? "all" : stage)} className={"min-w-0 border-b border-border p-5 text-start transition-colors hover:bg-muted/70 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-ring sm:p-6 lg:border-b-0 lg:border-e lg:last:border-e-0 " + (status === stage ? "bg-muted/80 ring-1 ring-inset ring-ring" : "")}>
          <div className={"mb-4 flex items-center gap-2 text-sm font-medium " + tone}><Icon className="size-4" aria-hidden />{campaignStatusLabel(stage)}</div>
          <div className="flex items-baseline gap-2"><span className="text-3xl font-semibold tabular-nums tracking-tight">{count}</span><span className="text-xs text-muted-foreground">{count === 1 ? "campaign" : "campaigns"}</span></div>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-muted"><div className={"h-full rounded-full " + bar} style={{ width: `${current.length ? count / current.length * 100 : 0}%` }} /></div>
        </button>
      })}
    </section> : null}

    <section className="roaya-glass overflow-hidden rounded-2xl border border-border" aria-label="Campaign directory">
      <div className="grid gap-4 border-b border-border p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Campaign directory</h3><p className="mt-1 text-xs text-muted-foreground">{showArchived ? "Current and archived campaigns" : "Current campaigns"} available to you</p></div><Button variant={status === "all" ? "secondary" : "outline"} size="sm" onClick={() => setStatus("all")} aria-pressed={status === "all"}>All campaigns <span className="ms-1 tabular-nums">{available.length}</span></Button></div>
        <div className="flex flex-col gap-3 xl:flex-row"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute start-3 top-3.5 size-4 text-muted-foreground" aria-hidden /><Input type="search" aria-label="Search campaigns" placeholder="Search campaigns, owners or projects…" value={query} onChange={event => setQuery(event.target.value)} className="h-11 ps-9" /></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:flex">
          {!showProject ? <select aria-label="Filter campaigns by status" className={selectClass} value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option>{campaignStatusValues.map(value => <option key={value} value={value}>{campaignStatusLabel(value)}</option>)}</select> : null}
          <select aria-label="Filter campaigns by type" className={selectClass} value={type} onChange={event => setType(event.target.value)}><option value="all">All channels</option>{campaignTypeValues.map(value => <option key={value} value={value}>{campaignTypeLabel(value)}</option>)}</select>
          {showProject ? <select aria-label="Filter campaigns by project" className={selectClass} value={project} onChange={event => setProject(event.target.value)}><option value="all">All projects</option>{projects.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select> : null}
          <select aria-label="Sort campaigns" className={selectClass} value={sort} onChange={event => setSort(event.target.value)}><option value="ending">End date (earliest first)</option><option value="starting">Start date (earliest first)</option><option value="name">Name A–Z</option></select>
        </div></div>
      </div>
      <div className="flex items-center justify-between gap-3 px-5 py-3 text-xs text-muted-foreground"><p role="status">{filtered.length} {filtered.length === 1 ? "campaign" : "campaigns"}{hasFilters ? " matching your filters" : ""}</p>{hasFilters ? <button className="font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring" onClick={clearFilters}>Clear filters</button> : null}</div>
      {filtered.length ? <ul className="grid gap-4 px-4 pb-5 sm:px-5 lg:grid-cols-2">{filtered.map(campaign => <CampaignCard key={campaign.id} campaign={campaign} showProject={showProject} />)}</ul> : <div className="grid justify-items-center gap-3 px-6 py-14 text-center sm:py-20"><span className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground"><Megaphone className="size-6" aria-hidden /></span><h3 className="mt-2 text-lg font-semibold">{hasFilters ? "No campaigns match these filters" : current.length === 0 && campaigns.length > 0 && !showArchived ? "Your current campaigns are clear" : "Your next campaign starts here"}</h3><p className="max-w-md text-sm leading-6 text-muted-foreground">{hasFilters ? "Try another search, channel or project to find the campaign you need." : campaigns.length > 0 && !showArchived ? "Show archived campaigns to revisit past work, or start a new campaign." : canCreate ? "Create a campaign, connect it to a project, and give your team a clear owner and schedule." : "Campaigns shared with your account will appear here. Ask your project lead to add you to the relevant project or campaign."}</p>{hasFilters ? <Button variant="outline" onClick={clearFilters}>Clear filters</Button> : canCreate ? <Button className="mt-2" onClick={onCreate}>Create campaign</Button> : <Link href="/projects" className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">Explore your projects<ArrowUpRight className="size-4" aria-hidden /></Link>}</div>}
    </section>
  </div>
}

function CampaignCard({ campaign, showProject }: { campaign: OrganizationCampaign; showProject: boolean }) {
  const { icon: Icon, tone } = stages[campaign.status]
  return <li className="flex min-w-0 flex-col rounded-xl border border-border bg-background/70 p-5 transition-colors hover:border-primary/40">
    <div className="flex flex-wrap items-center justify-between gap-2"><span className={"inline-flex items-center gap-1.5 text-xs font-medium " + tone}><Icon className="size-3.5" aria-hidden />{campaignStatusLabel(campaign.status)}</span><div className="flex flex-wrap gap-2"><Badge variant="secondary">{campaignTypeLabel(campaign.type)}</Badge>{campaign.archivedAt ? <Badge variant="outline">Archived</Badge> : null}</div></div>
    <h4 className="mt-4 break-words text-lg font-semibold tracking-tight"><Link href={`/workspaces/marketing/campaigns/${campaign.id}`} className="inline-flex items-start gap-2 rounded-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-ring">{campaign.name}<ArrowUpRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden /></Link></h4>
    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{campaign.description || "Open this campaign to view its brief and planned work."}</p>
    <dl className="mt-5 grid gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
      {showProject ? <div className="flex min-w-0 items-center gap-2"><dt className="shrink-0"><FolderKanban className="size-3.5" aria-hidden /><span className="sr-only">Project</span></dt><dd className="truncate"><Link href={`/projects/${campaign.projectId}`} className="hover:text-primary hover:underline">{campaign.projectName ?? "Project unavailable"}</Link></dd></div> : null}
      <div className="flex items-center gap-2"><dt><UserRound className="size-3.5" aria-hidden /><span className="sr-only">Owner</span></dt><dd>{campaign.ownerName ?? "Owner unavailable"}</dd></div>
      <div className="flex items-start gap-2"><dt><CalendarDays className="size-3.5" aria-hidden /><span className="sr-only">Schedule</span></dt><dd>{dateRange(campaign.startsOn, campaign.endsOn)}</dd></div>
    </dl>
  </li>
}
