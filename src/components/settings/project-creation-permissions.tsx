"use client"

import { useEffect, useState } from "react"
import { useOrganization } from "@/components/auth/organization-provider"
import { getProjectCreationPermissions, setProjectCreationPermission } from "@/lib/auth/project-creation-permissions"
import { refreshOrganizationProjects } from "@/lib/auth/project-list-refresh"
import { Button } from "@/components/ui/button"
import { ShieldCheck, SlidersHorizontal } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MemberDirectory } from "./member-directory"

type Snapshot = Awaited<ReturnType<typeof getProjectCreationPermissions>>

export function ProjectCreationPermissions() {
  const { activeOrganization } = useOrganization()
  if (!activeOrganization || !["org_admin", "team_lead"].includes(activeOrganization.role ?? "")) return null
  return <Permissions key={activeOrganization.id} organizationId={activeOrganization.id} />
}

function Permissions({ organizationId }: { organizationId: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [open, setOpen] = useState(false)
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
  const members = snapshot?.status === "ready" ? snapshot.members : []
  const allowed = members.filter(member => member.canCreate).length
  return <section className="roaya-glass overflow-hidden rounded-2xl">
    <div className="flex flex-wrap items-center justify-between gap-5 p-5 sm:p-7">
      <div className="flex min-w-0 items-start gap-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"><ShieldCheck className="size-5" aria-hidden /></span><div><h2 className="font-semibold">Project creation permissions</h2><p className="mt-1 max-w-lg text-sm leading-6 text-muted-foreground">Choose which Members can create projects without changing their role.</p>{snapshot?.status === "ready" ? <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">{allowed}</span> allowed <span aria-hidden className="mx-2">·</span>{members.length - allowed} not allowed</p> : null}</div></div>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}><SlidersHorizontal className="size-4" aria-hidden />Manage access</Button>
    </div>
    <Dialog open={open} onOpenChange={value => { if (!pending) setOpen(value) }}>
      <DialogContent showCloseButton={!pending} className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Project creation permissions</DialogTitle><DialogDescription>Grant or revoke Create project for individual Members. Only Team leads and Super admins can manage this access.</DialogDescription></DialogHeader>
        {message ? <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm">{message}</p> : null}
        {!snapshot ? <p role="status" className="text-sm text-muted-foreground">Loading permissions…</p> : snapshot.status === "error" ? <div className="grid justify-items-start gap-3"><p role="alert" className="text-sm">Permissions could not be loaded.</p><Button variant="outline" onClick={() => { void getProjectCreationPermissions(organizationId).then(setSnapshot).catch(() => setSnapshot({ status: "error" })) }}>Retry</Button></div> : <MemberDirectory members={members} label="project creation permissions" filters={[{id:"allowed",label:"Allowed to create",matches:member=>member.canCreate},{id:"not-allowed",label:"Not allowed",matches:member=>!member.canCreate}]} renderActions={member => <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium"><span className={member.canCreate ? "text-teal-700 dark:text-teal-300" : "text-muted-foreground"}>{member.canCreate ? "Allowed" : "Not allowed"}</span><input type="checkbox" role="switch" className="relative h-6 w-10 cursor-pointer appearance-none rounded-full bg-slate-300 transition-colors before:absolute before:start-1 before:top-1 before:size-4 before:rounded-full before:bg-white before:shadow-sm before:transition-transform checked:bg-teal-600 checked:before:translate-x-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none" checked={member.canCreate} disabled={pending} onChange={event => { void save(member.id, event.target.checked) }} aria-label={"Allow " + member.name + " to create projects"} /></label>} />}
        <div className="flex justify-end"><Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>Done</Button></div>
      </DialogContent>
    </Dialog>
  </section>
}
