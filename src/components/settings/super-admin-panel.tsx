"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useOrganization } from "@/components/auth/organization-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addDepartmentMember, addOrganizationMember, createDepartment, createOrganizationUser, getAdminSnapshot, setOrganizationRole } from "@/lib/auth/super-admin-actions"
import { refreshProjectInvitations, useProjectInvitations } from "@/components/projects/project-invitations"
import { refreshOrganizationProjects } from "@/lib/auth/project-list-refresh"
import type { AdminResult, AdminSnapshot } from "@/lib/auth/super-admin-types"

export function SuperAdminPanel() {
 const { activeOrganization } = useOrganization()
 return activeOrganization ? <OrganizationAdmin key={activeOrganization.id} organizationId={activeOrganization.id} /> : <p className="text-sm text-muted-foreground">Select an organization to manage access.</p>
}
function OrganizationAdmin({ organizationId }: { organizationId: string }) {
 const router = useRouter()
 const inbox = useProjectInvitations()
 const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null)
 const [message, setMessage] = useState("")
 const [pending, setPending] = useState(false)
 const [loading, setLoading] = useState(true)
 const [email, setEmail] = useState("")
 const [name, setName] = useState("")
 const [password, setPassword] = useState("")
 const [existingEmail, setExistingEmail] = useState("")
 const [departmentName, setDepartmentName] = useState("")
 const [departmentId, setDepartmentId] = useState("")
 const [profileId, setProfileId] = useState("")
 useEffect(() => {
  let active = true
  getAdminSnapshot(organizationId).then(value => { if (active) { setSnapshot(value); setLoading(false) } }).catch(error => { if (active) { setMessage(error instanceof Error ? error.message : "Unable to load access settings."); setLoading(false) } })
  return () => { active = false }
 }, [organizationId])
 async function run(action: () => Promise<AdminResult>) {
  setPending(true); setMessage("")
  try {
   const result = await action(); setMessage(result.message)
   if (result.ok) { refreshProjectInvitations(); refreshOrganizationProjects(); setPassword(""); setSnapshot(await getAdminSnapshot(organizationId)); router.refresh() }
  } catch { setMessage("The request failed. Please try again.") }
  finally { setPending(false) }
 }
 if (loading) return <p role="status">Loading access settings…</p>
 if (!snapshot) return <section className="grid gap-2 rounded-xl border bg-card p-5"><h2 className="font-semibold">Organization access unavailable</h2><p role="alert" className="text-sm">{message || "Organization access could not be loaded."}</p></section>
 return <section className="grid gap-5 rounded-xl border bg-card p-5">
  <div><h2 className="font-semibold">{snapshot?.isAdmin ? "Super admin" : snapshot?.role === "admin" ? "Admin" : "Project invitations"}</h2><p className="text-sm text-muted-foreground">{snapshot?.isAdmin ? "Manage users, departments, and organization access. Create projects from the Projects page." : snapshot?.role === "admin" ? "View and edit existing organization work. Adding, deleting, archiving and permission changes are unavailable." : "Accept an invitation to join a project."}</p></div>
  {message ? <p role="status" className="text-sm">{message}</p> : null}
  <p className="text-sm text-muted-foreground">{inbox.loading ? "Checking project invitations…" : inbox.error ? "Use Refresh invitations above to retry loading invitations." : inbox.invitations.length ? "Your pending invitations are shown above. Accept an invitation to open its project." : "No pending project invitations."}</p>
  {snapshot?.isAdmin ? <>
   <div className="grid gap-5 lg:grid-cols-2">
    <form className="grid content-start gap-3 rounded-lg border p-4" onSubmit={e => { e.preventDefault(); void run(() => createOrganizationUser(organizationId, name, email, password)) }}>
     <h3 className="text-sm font-semibold">Create user</h3>
     <label className="grid gap-1 text-sm">Full name<Input required value={name} onChange={e => setName(e.target.value)} disabled={pending} /></label>
     <label className="grid gap-1 text-sm">Email<Input type="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={pending} autoComplete="off" /></label>
     <label className="grid gap-1 text-sm">Initial password<Input type="password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)} disabled={pending} autoComplete="new-password" /></label>
     <p className="text-xs text-muted-foreground">Use at least 12 characters. Share sign-in details securely with the new employee.</p>
     <Button type="submit" disabled={pending}>Create user</Button>
    </form>
    <div className="grid content-start gap-4">
     <form className="grid gap-3 rounded-lg border p-4" onSubmit={e => { e.preventDefault(); void run(() => addOrganizationMember(organizationId, existingEmail)) }}><h3 className="text-sm font-semibold">Add existing member</h3><label className="grid gap-1 text-sm">Account email<Input type="email" required value={existingEmail} onChange={e => setExistingEmail(e.target.value)} disabled={pending} /></label><Button type="submit" disabled={pending}>Add member</Button></form>
     <form className="grid gap-3 rounded-lg border p-4" onSubmit={e => { e.preventDefault(); void run(() => createDepartment(organizationId, departmentName)) }}><h3 className="text-sm font-semibold">Create department</h3><label className="grid gap-1 text-sm">Department name<Input required value={departmentName} onChange={e => setDepartmentName(e.target.value)} disabled={pending} /></label><Button type="submit" disabled={pending}>Create department</Button></form>
    </div>
   </div>
   <form className="flex flex-wrap items-end gap-3 rounded-lg border p-4" onSubmit={e => { e.preventDefault(); void run(() => addDepartmentMember(organizationId, departmentId, profileId)) }}>
    <label className="grid gap-1 text-sm">Department<select required disabled={pending} className="h-9 rounded-md border bg-background px-2" value={departmentId} onChange={e => setDepartmentId(e.target.value)}><option value="">Choose department</option>{snapshot.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
    <label className="grid gap-1 text-sm">Member<select required disabled={pending} className="h-9 rounded-md border bg-background px-2" value={profileId} onChange={e => setProfileId(e.target.value)}><option value="">Choose member</option>{snapshot.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><Button type="submit" disabled={pending}>Add to department</Button>
   </form>
   <div className="grid gap-2"><h3 className="text-sm font-semibold">Organization members</h3>{snapshot.members.map(m => <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"><div><p className="text-sm font-medium">{m.name}</p><p className="text-xs text-muted-foreground">{m.email}</p></div><label className="grid gap-1 text-xs">Organization role<select aria-label={"Role for " + m.name} disabled={pending} className="h-9 rounded-md border bg-background px-2 text-sm" value={m.role} onChange={e => run(() => setOrganizationRole(organizationId, m.id, e.target.value))}><option value="org_admin">Super admin</option><option value="admin">Admin</option><option value="team_lead">Owner (Team lead)</option><option value="member">Member</option><option value="viewer">Viewer</option></select></label></div>)}</div>
  </> : null}
 </section>
}
