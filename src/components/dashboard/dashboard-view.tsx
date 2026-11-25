"use client"
import Link from "next/link"
import {FileSearch,FolderKanban,Images,ListTodo,RefreshCw} from "lucide-react"
import {KpiCard} from "./kpi-card"
import {QuickAccess} from "./quick-access"
import {SectionHeading} from "./section-heading"
import {useCurrentIdentity} from "@/components/auth/current-identity-provider"
import {useLiveWorkspace} from "@/components/workspace/live-workspace-provider"
import {LiveActivityList} from "@/components/activity/activity-feed"
import {Button} from "@/components/ui/button"
import {Badge} from "@/components/ui/badge"
export function DashboardView(){
 const identity=useCurrentIdentity();const {result,refresh}=useLiveWorkspace();const firstName=identity.name.split(/\s+/)[0]||identity.name
 if(!result)return <p role="status">Loading your workspace…</p>
 if(result.status!=="ready")return <div className="roaya-glass grid gap-4 p-6"><h1 className="text-xl font-semibold">Dashboard unavailable</h1><p>We could not load your workspace data. Please try again.</p><Button className="w-fit" onClick={refresh}>Retry</Button></div>
 const organizationWide=result.role==="org_admin"||result.role==="admin";const tasks=result.tasks.filter(t=>organizationWide||t.assigneeId===result.userId);const openTasks=tasks.filter(t=>t.status!=="done");const reviews=tasks.filter(t=>t.status==="in_review")
 return <div className="grid gap-8"><header className="flex items-start justify-between gap-4"><div><h1 className="roaya-page-title">Welcome back, {firstName}</h1><p className="mt-2 text-sm text-muted-foreground">{organizationWide?"Your organization at a glance.":"Your projects, assigned work and shared resources."} All information reflects your access.</p></div><Button variant="outline" size="icon" aria-label="Refresh dashboard" onClick={refresh}><RefreshCw className="size-4"/></Button></header>
 <section aria-label="Workspace summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><KpiCard label="Projects" value={result.projects.length} hint="Projects you can access" href="/projects" icon={FolderKanban}/><KpiCard label={organizationWide?"Open tasks":"My open tasks"} value={openTasks.length} hint={organizationWide?"Open tasks in your organization":"Tasks assigned to you"} href="/tasks" icon={ListTodo}/><KpiCard label="In review" value={reviews.length} hint="Tasks awaiting review" href="/tasks" icon={FileSearch} accent="violet"/><KpiCard label="Shared assets" value={result.assets.length} hint="Assets available to you" href="/assets" icon={Images}/></section>
 <QuickAccess/>
 <div className="grid gap-8 lg:grid-cols-5"><section className="lg:col-span-3" data-tour="tasks"><SectionHeading title={organizationWide?"Open tasks":"My tasks"} href="/tasks" action="View all"/><div className="roaya-glass p-5">{openTasks.length?<ul className="divide-y divide-border">{openTasks.slice(0,5).map(t=><li key={t.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><Link href={"/projects/"+t.projectId} className="text-sm font-medium hover:text-primary">{t.title}</Link><p className="mt-1 text-xs text-muted-foreground">{t.projectName}{t.dueOn?" · Due "+t.dueOn:""}</p></div><Badge variant="secondary">{t.status.replaceAll("_"," ")}</Badge></li>)}</ul>:<p className="py-5 text-sm text-muted-foreground">No open tasks{organizationWide?"":" assigned to you"} yet.</p>}</div></section>
 <section className="lg:col-span-2"><SectionHeading title="Recent activity" href="/activity" action="View all"/><div className="roaya-glass p-5"><LiveActivityList limit={5}/></div></section></div>
 <section><SectionHeading title="Projects" href="/projects" action="View all"/>{result.projects.length?<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{result.projects.slice(0,6).map(p=><Link key={p.id} href={"/projects/"+p.id} className="roaya-glass grid gap-3 p-5 hover:border-primary/30"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold">{p.name}</h3><Badge variant="secondary">{p.status.replaceAll("_"," ")}</Badge></div><p className="line-clamp-2 text-sm text-muted-foreground">{p.description||"No description yet."}</p><p className="text-xs text-muted-foreground">{p.leadDepartment||"Organization project"}{p.dueOn?" · Due "+p.dueOn:""}</p></Link>)}</div>:<div className="roaya-glass p-6 text-sm text-muted-foreground">No projects are available to your account yet. Accepted project invitations will appear here.</div>}</section></div>
}
