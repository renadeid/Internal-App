"use client"

import { useEffect, useState } from "react"
import { useOrganization } from "@/components/auth/organization-provider"
import { getProjectCreationPermissions, setProjectCreationPermission } from "@/lib/auth/project-creation-permissions"
import { refreshOrganizationProjects } from "@/lib/auth/project-list-refresh"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Snapshot = Awaited<ReturnType<typeof getProjectCreationPermissions>>

export function ProjectCreationPermissions() {
  const { activeOrganization } = useOrganization()
  if (!activeOrganization || !["org_admin", "team_lead"].includes(activeOrganization.role ?? "")) return null
  return <Permissions key={activeOrganization.id} organizationId={activeOrganization.id} />
}

function Permissions({ organizationId }: { organizationId: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [query, setQuery] = useState("")
  const [message, setMessage] = useState("")
  const [pending, setPending] = useState(false)
  useEffect(() => {
    let active = true
    getProjectCreationPermissions(organizationId).then(value => { if (active) setSnapshot(value) }).catch(() => { if (active) setSnapshot({ status: "error" }) })
    return () => { active = false }
  }, [organizationId])
  async function save(profileId: string, allowed: boolean) {
    if (pending) return
    setPending(true); setMessage("")
    try {
      const response = await setProjectCreationPermission(organizationId, profileId, allowed)
      setMessage(response.message)
      if (response.ok) { setSnapshot(await getProjectCreationPermissions(organizationId)); refreshOrganizationProjects() }
    } catch { setMessage("Permission could not be saved. Try again.") }
    finally { setPending(false) }
  }
  if (snapshot?.status === "denied") return null
  return <section className="roaya-glass grid gap-5 rounded-2xl p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-semibold">Project creation permissions</h2><p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">Allow individual Members to create projects. Team leads and Super admins can grant or revoke this permission without changing someone’s role.</p></div><Input type="search" aria-label="Search project creation permissions" placeholder="Search members…" value={query} onChange={event => setQuery(event.target.value)} className="h-11 w-full sm:w-64" /></div>
    {message ? <p role="status" className="text-sm">{message}</p> : null}
    {!snapshot ? <p role="status" className="text-sm text-muted-foreground">Loading permissions…</p> : snapshot.status === "error" ? <div className="grid justify-items-start gap-3"><p role="alert" className="text-sm">Project creation permissions could not be loaded.</p><Button variant="outline" onClick={() => { void getProjectCreationPermissions(organizationId).then(setSnapshot).catch(() => setSnapshot({ status: "error" })) }}>Retry</Button></div> : <div className="divide-y divide-border rounded-xl border border-border">{snapshot.members.filter(member => (member.name + " " + member.email).toLowerCase().includes(query.trim().toLowerCase())).map(member => <div key={member.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"><div className="min-w-0"><p className="text-sm font-medium">{member.name}</p><p className="mt-1 break-all text-xs text-muted-foreground">{member.email}</p></div><label className="inline-flex items-center gap-3 text-sm"><input type="checkbox" className="size-4 accent-teal-700" checked={member.canCreate} disabled={pending} onChange={event => { void save(member.id, event.target.checked) }} aria-label={"Allow " + member.name + " to create projects"} />Create project</label></div>)}{!snapshot.members.some(member => (member.name + " " + member.email).toLowerCase().includes(query.trim().toLowerCase())) ? <p className="p-5 text-sm text-muted-foreground">{snapshot.members.length ? "No members match your search." : "No Members are available in this workspace."}</p> : null}</div>}
  </section>
}
