"use client"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, Eye, EyeOff, WandSparkles } from "lucide-react"
import { generatePassword } from "@/lib/generate-password"
import { useOrganization } from "@/components/auth/organization-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addDepartmentMember, createDepartment, createOrganizationUser, getAdminSnapshot, setOrganizationRole } from "@/lib/auth/super-admin-actions"
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
 const [operation, setOperation] = useState("create-user")
 const [search, setSearch] = useState("")
 const [email, setEmail] = useState("")
 const [emailCopyStatus, setEmailCopyStatus] = useState<"" | "copying" | "copied" | "error">("")
 const emailVersion = useRef(0)
 const [name, setName] = useState("")
 const [password, setPassword] = useState("")
 const [showPassword, setShowPassword] = useState(false)
 const [copyStatus, setCopyStatus] = useState<"" | "copying" | "copied" | "error">("")
 const passwordVersion = useRef(0)
 const [departmentName, setDepartmentName] = useState("")
 const [departmentId, setDepartmentId] = useState("")
 const [profileId, setProfileId] = useState("")
 useEffect(() => {
  let active = true
  getAdminSnapshot(organizationId).then(value => { if (active) { setSnapshot(value); setLoading(false) } }).catch(error => { if (active) { setMessage(error instanceof Error ? error.message : "Unable to load access settings."); setLoading(false) } })
  return () => { active = false }
 }, [organizationId])
 function changePassword(value: string) {
  passwordVersion.current += 1
  setPassword(value)
  setCopyStatus("")
 }
 async function copyEmail() {
  if (!email.trim() || pending || emailCopyStatus === "copying") return
  const version = emailVersion.current
  setEmailCopyStatus("copying")
  try {
   await navigator.clipboard.writeText(email.trim())
   if (emailVersion.current === version) setEmailCopyStatus("copied")
  } catch {
   if (emailVersion.current === version) setEmailCopyStatus("error")
  }
 }
 async function copyPassword() {
  if (!password || pending || copyStatus === "copying") return
  const version = passwordVersion.current
  setCopyStatus("copying")
  try {
   await navigator.clipboard.writeText(password)
   if (passwordVersion.current === version) setCopyStatus("copied")
  } catch {
   if (passwordVersion.current === version) setCopyStatus("error")
  }
 }
 async function run(action: () => Promise<AdminResult>) {
  setPending(true); setMessage("")
  try {
   const result = await action(); setMessage(result.message)
   if (result.ok) { refreshProjectInvitations(); refreshOrganizationProjects(); changePassword(""); setShowPassword(false); setSnapshot(await getAdminSnapshot(organizationId)); router.refresh() }
  } catch { setMessage("The request failed. Please try again.") }
  finally { setPending(false) }
 }
 if (loading) return <p role="status">Loading access settings…</p>
 if (!snapshot) return <section className="grid gap-2 rounded-xl border bg-card p-5"><h2 className="font-semibold">Organization access unavailable</h2><p role="alert" className="text-sm">{message || "Organization access could not be loaded."}</p></section>
 return <section className="roaya-glass grid gap-6 p-5 sm:p-7">
  <div><h2 className="font-semibold">{snapshot?.isAdmin ? "Super admin" : snapshot?.role === "admin" ? "Admin" : "Project invitations"}</h2><p className="text-sm text-muted-foreground">{snapshot?.isAdmin ? "Manage users, departments, and organization access. Create projects from the Projects page." : snapshot?.role === "admin" ? "View and edit existing organization work. Adding, deleting, archiving and permission changes are unavailable." : "Accept an invitation to join a project."}</p></div>
  {message ? <p role="status" className="text-sm">{message}</p> : null}
  <p className="text-sm text-muted-foreground">{inbox.loading ? "Checking project invitations…" : inbox.error ? "Use Refresh invitations above to retry loading invitations." : inbox.invitations.length ? "Your pending invitations are shown above. Accept an invitation to open its project." : "No pending project invitations."}</p>
  {snapshot?.isAdmin ? <>

   <form className="overflow-hidden rounded-2xl border border-border bg-background/60" onSubmit={e => {
    e.preventDefault()
    if (pending) return
    void run(() => operation === "create-user" ? createOrganizationUser(organizationId, name, email, password)
     : operation === "create-department" ? createDepartment(organizationId, departmentName)
     : addDepartmentMember(organizationId, departmentId, profileId))
   }}>
    <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
     <div className="space-y-2"><h3 className="font-semibold">Manage your organization</h3><p className="text-sm leading-6 text-muted-foreground">Choose an action, complete the details, then confirm below.</p></div>
     <div className="grid max-w-xl gap-5">
      <label className="grid gap-2 text-sm font-medium">What would you like to do?
       <select className="h-11 w-full min-w-0 rounded-xl border bg-card px-3 font-normal" disabled={pending} value={operation} onChange={e => { setOperation(e.target.value); setMessage(""); changePassword(""); setShowPassword(false) }}>
        <option value="create-user">Create a new user</option><option value="create-department">Create a department</option><option value="department-member">Add a member to a department</option>
       </select>
      </label>
      <fieldset key={operation} disabled={pending} className="grid min-w-0 gap-4 border-t border-border pt-5">
       <legend className="sr-only">Action details</legend>
       {operation === "create-user" ? <>
        <label className="grid gap-2 text-sm">Full name<Input className="h-11" required value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>
        <div className="grid gap-2">
         <label htmlFor="new-user-email" className="text-sm">Email address</label>
         <div className="relative">
          <Input id="new-user-email" className="h-11 pe-12" type="email" required value={email} onChange={e => { emailVersion.current += 1; setEmail(e.target.value); setEmailCopyStatus("") }} autoComplete="off" />
          <button type="button" className="absolute inset-y-0 end-1 my-auto inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50" disabled={pending || !email.trim() || emailCopyStatus === "copying"} aria-label="Copy email" title="Copy email" aria-controls="new-user-email" onClick={() => void copyEmail()}>{emailCopyStatus === "copied" ? <Check className="size-4 text-teal-700" aria-hidden /> : <Copy className="size-4" aria-hidden />}</button>
         </div>
         <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{emailCopyStatus === "copied" ? "Email copied." : emailCopyStatus === "error" ? "Could not copy. Select the email and copy it manually." : emailCopyStatus === "copying" ? "Copying…" : ""}</p>
        </div>
        <div className="grid gap-2">
         <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="initial-user-password" className="text-sm">Initial password</label>
          <Button type="button" variant="outline" className="gap-2" disabled={pending} onClick={() => { changePassword(generatePassword()); setShowPassword(false) }}><WandSparkles className="size-4" aria-hidden />Generate</Button>
         </div>
         <div className="relative">
          <Input id="initial-user-password" className="h-11 pe-24" type={showPassword ? "text" : "password"} minLength={12} required value={password} onChange={e => changePassword(e.target.value)} autoComplete="new-password" spellCheck={false} autoCapitalize="none" aria-describedby="initial-password-help" />
          <button type="button" className="absolute inset-y-0 end-11 my-auto inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50" disabled={pending || !password || copyStatus === "copying"} aria-label="Copy password" title="Copy password" aria-controls="initial-user-password" onClick={() => void copyPassword()}>{copyStatus === "copied" ? <Check className="size-4 text-teal-700" aria-hidden /> : <Copy className="size-4" aria-hidden />}</button>
          <button type="button" className="absolute inset-y-0 end-1 my-auto inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50" disabled={pending} aria-label={showPassword ? "Hide password" : "Show password"} aria-controls="initial-user-password" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}</button>
         </div>
        </div>
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{copyStatus === "copied" ? "Password copied." : copyStatus === "error" ? "Could not copy. Show the password and copy it manually." : copyStatus === "copying" ? "Copying…" : ""}</p>
        <p id="initial-password-help" className="text-xs leading-5 text-muted-foreground">Use at least 12 characters. Share sign-in details securely with the new employee.</p>
       </> : operation === "create-department" ? <label className="grid gap-2 text-sm">Department name<Input className="h-11" required value={departmentName} onChange={e => setDepartmentName(e.target.value)} /></label> : <>
        <label className="grid gap-2 text-sm">Department<select required className="h-11 w-full min-w-0 rounded-xl border bg-card px-3" value={departmentId} onChange={e => setDepartmentId(e.target.value)}><option value="">Choose department</option>{snapshot.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label className="grid gap-2 text-sm">Member<select required className="h-11 w-full min-w-0 rounded-xl border bg-card px-3" value={profileId} onChange={e => setProfileId(e.target.value)}><option value="">Choose member</option>{snapshot.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        {!snapshot.departments.length ? <p className="text-sm text-muted-foreground">Create a department first to add members to it.</p> : !snapshot.members.length ? <p className="text-sm text-muted-foreground">Add an organization member first.</p> : null}
       </>}
      </fieldset>
     </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border bg-muted/40 px-5 py-4 sm:px-7">
     <p className="text-xs leading-5 text-muted-foreground">Changes apply to the selected organization.</p>
     <Button type="submit" className="h-10 min-w-36" disabled={pending || (operation === "department-member" && (!snapshot.departments.length || !snapshot.members.length))}>{pending ? "Saving…" : operation === "create-user" ? "Create user" : operation === "create-department" ? "Create department" : "Add to department"}</Button>
    </div>
   </form>

   <div className="mt-2 grid gap-4">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="font-semibold">Members & roles <span className="ms-2 text-sm font-normal text-muted-foreground">{snapshot.members.length}</span></h3><p className="mt-1 text-sm text-muted-foreground">Review your team and manage organization permissions.</p></div><Input className="h-10 w-full sm:w-64" type="search" aria-label="Search organization members" placeholder="Search name or email…" value={search} onChange={e => setSearch(e.target.value)} /></div>
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
     {snapshot.members.filter(m => (m.name + " " + m.email).toLowerCase().includes(search.trim().toLowerCase())).map(m => <div key={m.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"><div className="min-w-0"><p className="text-sm font-medium">{m.name}</p><p className="mt-1 break-all text-xs text-muted-foreground">{m.email}</p></div><label className="grid w-full gap-1.5 text-xs text-muted-foreground sm:w-48">Organization role<select aria-label={"Role for " + m.name} disabled={pending} className="h-10 w-full rounded-xl border bg-background px-3 text-sm text-foreground" value={m.role} onChange={e => { if (!pending) void run(() => setOrganizationRole(organizationId, m.id, e.target.value)) }}><option value="org_admin">Super admin</option><option value="admin">Admin</option><option value="team_lead">Owner (Team lead)</option><option value="member">Member</option><option value="viewer">Viewer</option></select></label></div>)}
     {!snapshot.members.some(m => (m.name + " " + m.email).toLowerCase().includes(search.trim().toLowerCase())) ? <p className="p-6 text-center text-sm text-muted-foreground">{search ? "No members match your search." : "No organization members yet."}</p> : null}
    </div>
   </div>
  </> : null}
 </section>
}
