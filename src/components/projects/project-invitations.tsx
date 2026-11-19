"use client"
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useOrganization } from "@/components/auth/organization-provider"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { getMyProjectInvitations } from "@/lib/auth/project-invitation-actions"
import { respondToProjectInvitation } from "@/lib/auth/super-admin-actions"
import { refreshOrganizationProjects } from "@/lib/auth/project-list-refresh"
import type { ProjectInvitation } from "@/lib/auth/super-admin-types"

type InvitationContext = {
 invitations: ProjectInvitation[]; loading: boolean; error: boolean; message: string; pendingId: string | null;
 refresh: () => Promise<void>; respond: (invitation: ProjectInvitation, accept: boolean) => Promise<void>
}
const Context = createContext<InvitationContext | null>(null)
export function ProjectInvitationsProvider({ children }: { children: React.ReactNode }) {
 const router = useRouter()
 const { selectOrganization } = useOrganization()
 const [invitations, setInvitations] = useState<ProjectInvitation[]>([])
 const [loading, setLoading] = useState(true)
 const [error, setError] = useState(false)
 const [message, setMessage] = useState("")
 const [pendingId, setPendingId] = useState<string | null>(null)
 const generation = useRef(0)
 const responding = useRef(false)
 const refresh = useCallback(async () => {
  const request = ++generation.current
  try {
   const result = await getMyProjectInvitations()
   if (request !== generation.current) return
   setError(result.status !== "ready")
   if (result.status === "ready") {
    const requested = new URLSearchParams(window.location.search).get("invitation")
    setInvitations([...result.invitations].sort((left, right) => Number(right.id === requested) - Number(left.id === requested)))
   }
  } catch { if (request === generation.current) setError(true) }
  finally { if (request === generation.current) setLoading(false) }
 }, [])
 const invalidateRequests = useCallback(() => { generation.current++ }, [])
 useEffect(() => {
  let active = true
  const refreshVisible = () => { if (active && document.visibilityState === "visible") void refresh() }
  queueMicrotask(refreshVisible)
  const timer = window.setInterval(refreshVisible, 15000)
  window.addEventListener("focus", refreshVisible)
  document.addEventListener("visibilitychange", refreshVisible)
  const unsubscribe = subscribeInvitationRefresh(refreshVisible)
  return () => { active = false; invalidateRequests(); window.clearInterval(timer); window.removeEventListener("focus", refreshVisible); document.removeEventListener("visibilitychange", refreshVisible); unsubscribe() }
 }, [refresh, invalidateRequests])
 const respond = useCallback(async (invitation: ProjectInvitation, accept: boolean) => {
  if (responding.current) return
  responding.current = true
  setPendingId(invitation.id); setMessage("")
  try {
   const result = await respondToProjectInvitation(invitation.organizationId, invitation.id, accept)
   setMessage(result.message)
   if (result.ok) {
    generation.current++
    setInvitations(current => current.filter(item => item.id !== invitation.id))
    if (accept) selectOrganization(invitation.organizationId)
    refreshOrganizationProjects()
    await refresh()
    if (accept) router.push("/projects/" + invitation.projectId)
    router.refresh()
   } else { await refresh() }
  } catch { setMessage("The invitation could not be updated. Please try again.") }
  finally { responding.current = false; setPendingId(null) }
 }, [refresh, router, selectOrganization])
 return <Context.Provider value={{ invitations, loading, error, message, pendingId, refresh, respond }}>{children}</Context.Provider>
}
export function useProjectInvitations() {
 const context = useContext(Context)
 if (!context) throw new Error("Project invitations require the workspace provider.")
 return context
}
const invitationRefreshListeners = new Set<() => void>()
export function refreshProjectInvitations() { invitationRefreshListeners.forEach(listener => listener()) }
function subscribeInvitationRefresh(listener: () => void) { invitationRefreshListeners.add(listener); return () => { invitationRefreshListeners.delete(listener) } }

export function ProjectInvitationsBanner() {
 const { invitations, loading, error, message, pendingId, refresh, respond } = useProjectInvitations()
 const [expanded, setExpanded] = useState(false)
 if (loading || (!error && !message && invitations.length === 0)) return null
 return <section id="project-invitations" aria-label="Project invitations" className="mb-6 grid gap-3 rounded-xl border border-primary/30 bg-card p-4 shadow-sm">
  <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Project invitations{invitations.length ? " (" + invitations.length + ")" : ""}</h2><Button type="button" variant="outline" onClick={() => void refresh()}>Refresh invitations</Button></div>
  {error ? <p role="alert" className="text-sm text-destructive">Invitations could not be loaded. Refresh to try again.</p> : null}
  {message ? <p role="status" className="text-sm">{message}</p> : null}
  {(expanded ? invitations : invitations.slice(0,3)).map(invitation => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><h3 className="text-sm font-semibold">{invitation.projectName}</h3><p className="text-xs text-muted-foreground">{invitation.organizationName} · {invitation.historyAccess === "assigned_only" ? "Assigned tasks only" : "Full project history"}</p><p className="mt-1 text-xs text-muted-foreground">{invitation.historyAccess === "assigned_only" ? invitation.canUpdateStatus ? "You can view and update the status of tasks assigned to you." : "View-only access to tasks assigned to you." : "Full project history."} Accept this invitation to access the project.</p>{invitation.taskTitles?.length ? <ul className="mt-2 list-inside list-disc text-xs">{invitation.taskTitles.map((title,index) => <li key={index}>{title}</li>)}</ul> : null}</div><div className="flex gap-2"><Button type="button" disabled={pendingId !== null} onClick={() => void respond(invitation,true)}>Accept invitation</Button><Button type="button" variant="outline" disabled={pendingId !== null} onClick={() => void respond(invitation,false)}>Decline</Button></div></div>)}
  {invitations.length > 3 ? <button type="button" className="text-left text-sm text-primary underline" onClick={() => setExpanded(value => !value)}>{expanded ? "Show fewer invitations" : "Show all invitations"}</button> : null}
 </section>
}

export function ProjectInvitationNotificationItems() {
 const { invitations, loading, error, refresh } = useProjectInvitations()
 return <div className="grid gap-2 px-2 py-2"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">Project invitations ({invitations.length})</p><button type="button" className="text-xs text-primary underline" onClick={() => void refresh()}>Refresh</button></div>
 {loading ? <p className="text-xs text-muted-foreground">Checking invitations…</p> : error ? <p className="text-xs text-destructive">Invitations could not be loaded.</p> : invitations.length === 0 ? <p className="text-xs text-muted-foreground">No pending project invitations.</p> : invitations.slice(0,5).map(item => <DropdownMenuItem className="items-start rounded-md border p-2" key={item.id} render={<Link href="/projects#project-invitations" />}><span className="grid gap-1"><span>{item.projectName}</span><span className="text-xs text-muted-foreground">{item.organizationName} · Open invitation</span></span></DropdownMenuItem>)}
 </div>
}
