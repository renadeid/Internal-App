"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, BriefcaseBusiness, Building2, Mail, Pencil, UserRound } from "lucide-react"
import { useOrganization } from "@/components/auth/organization-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { deleteEmployee, getEmployeeProfile, updateEmployeeDetails, uploadEmployeePhoto } from "@/lib/auth/employee-profile-actions"
import { addDepartmentMember, setOrganizationRole } from "@/lib/auth/super-admin-actions"
import type { EmployeeProfile, EmployeeProfileResult } from "@/lib/auth/employee-profile"
import type { AdminResult } from "@/lib/auth/super-admin-types"

const roles = { org_admin: "Super admin", admin: "Admin", team_lead: "Owner (Team lead)", member: "Member", viewer: "Viewer" }
const colours = ["#3D5A80", "#3c7f87", "#6B4C9A", "#b45309", "#be123c"]
const statusLabel = (value: string) => value === "todo" ? "To do" : value.replaceAll("_", " ")

export function EmployeeProfileView({ profileId }: { profileId: string }) {
 const { activeOrganization } = useOrganization()
 if (!activeOrganization) return <p className="text-sm text-muted-foreground">Select your workspace to view this employee.</p>
 return <EmployeeRecord key={activeOrganization.id + profileId} organizationId={activeOrganization.id} profileId={profileId} />
}

function EmployeeRecord({ organizationId, profileId }: { organizationId: string; profileId: string }) {
 const [result, setResult] = useState<EmployeeProfileResult | null>(null)
 const [editing, setEditing] = useState(false)
 const [pending, setPending] = useState(false)
 const [message, setMessage] = useState("")
 const [section, setSection] = useState<"overview" | "projects" | "tasks">("overview")
 const router = useRouter()
 useEffect(() => {
  let active = true
  getEmployeeProfile(organizationId, profileId).then(value => { if (active) setResult(value) }).catch(() => { if (active) setResult({ status: "error" }) })
  return () => { active = false }
 }, [organizationId, profileId])
 async function save(action: () => Promise<AdminResult>) {
  if (pending) return
  setPending(true); setMessage("")
  try {
   const response = await action()
   setMessage(response.message)
   if (response.ok) { setResult(await getEmployeeProfile(organizationId, profileId)); setEditing(false); router.refresh() }
  } catch { setMessage("The change could not be saved. Try again.") }
  finally { setPending(false) }
 }
 const back = <Link href="/people" className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" aria-hidden />People & onboarding</Link>
 if (!result) return <div className="grid gap-6">{back}<p role="status">Loading employee profile…</p></div>
 if (result.status !== "ready") return <div className="grid gap-6">{back}<div className="roaya-glass p-8"><h1 className="text-xl font-semibold">{result.status === "missing" ? "Employee unavailable" : "Profile could not be loaded"}</h1><p className="mt-2 text-sm text-muted-foreground">{result.status === "missing" ? "This employee is not available in your workspace." : "Please refresh the page to try again."}</p></div></div>
 const profile = result.profile
 const { person } = profile
 const tabs: ("overview" | "projects" | "tasks")[] = profile.canViewWork ? ["overview", "projects", "tasks"] : ["overview"]
 const visibleSection = profile.canViewWork ? section : "overview"
 const overdue = profile.tasks.filter(task => task.status !== "done" && task.dueOn && task.dueOn < new Date().toISOString().slice(0,10)).length
 return <div className="grid gap-6">
  {back}
  <section className="roaya-glass overflow-hidden">
   <div className="h-20 bg-gradient-to-r from-navy-800 via-navy-600 to-teal-600" />
   <div className="px-5 pb-6 sm:px-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
     <Avatar className="-mt-9 size-20 ring-4 ring-white">{person.avatarUrl ? <AvatarImage src={person.avatarUrl} alt={person.name} /> : null}<AvatarFallback className="text-2xl font-semibold text-white" style={{backgroundColor:person.avatarColor}}>{person.initials}</AvatarFallback></Avatar>
     {profile.canManage ? <Button type="button" variant="outline" className="gap-2" disabled={pending} onClick={() => setEditing(value => !value)}><Pencil className="size-4" aria-hidden />{editing ? "Close editor" : "Edit employee"}</Button> : null}
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{person.name}</h1><Badge variant="secondary">{roles[person.role]}</Badge></div>
    <p className="mt-2 text-sm text-muted-foreground">{profile.jobTitle || "Job title not set"}</p>
    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground"><span className="inline-flex min-w-0 items-center gap-2"><Mail className="size-4 shrink-0" aria-hidden /><span className="break-all">{person.email}</span></span><span className="inline-flex items-center gap-2"><Building2 className="size-4" aria-hidden />{profile.departments.map(department => department.name).join(", ") || "No department assigned"}</span></div>
   </div>
  </section>
  {message ? <p role="status" className="rounded-xl border border-border bg-card p-4 text-sm">{message}</p> : null}
  {editing && profile.canManage ? <EmployeeEditor key={person.name + profile.jobTitle + person.role} profile={profile} organizationId={organizationId} pending={pending} save={save} /> : null}
  <div className="flex gap-1 overflow-x-auto border-b border-border" role="tablist" aria-label="Employee information">{tabs.map(tab => <button key={tab} id={"employee-tab-"+tab} type="button" role="tab" tabIndex={visibleSection===tab ? 0 : -1} onKeyDown={event => { const index = tabs.indexOf(tab); const target = event.key === "ArrowRight" ? tabs[(index+1)%tabs.length] : event.key === "ArrowLeft" ? tabs[(index+tabs.length-1)%tabs.length] : event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[tabs.length-1] : null; if (target) { event.preventDefault(); setSection(target); document.getElementById("employee-tab-"+target)?.focus() } }} aria-selected={visibleSection===tab} aria-controls="employee-panel" onClick={() => setSection(tab)} className={"shrink-0 border-b-2 px-5 py-3 text-sm font-medium capitalize " + (visibleSection===tab ? "border-teal-600 text-navy-600" : "border-transparent text-muted-foreground hover:text-foreground")}>{tab}</button>)}</div>
  <div id="employee-panel" role="tabpanel" aria-labelledby={"employee-tab-"+visibleSection} className="grid gap-5">
   {profile.canViewWork && profile.workUnavailable ? <p role="status" className="text-sm text-muted-foreground">Some work details could not be loaded. Refresh to retry.</p> : null}
   {visibleSection === "overview" ? <>
    {profile.canViewWork ? <section className="roaya-glass grid gap-6 p-6 sm:grid-cols-3"><div><p className="text-sm text-muted-foreground">Active projects</p><p className="mt-2 text-3xl font-semibold">{profile.projects.length}</p></div><div><p className="text-sm text-muted-foreground">Assigned tasks</p><p className="mt-2 text-3xl font-semibold">{profile.tasks.length}</p></div><div><p className="text-sm text-muted-foreground">Overdue tasks</p><p className="mt-2 text-3xl font-semibold">{overdue}</p></div></section> : null}
    <section className="roaya-glass p-6"><h2 className="inline-flex items-center gap-2 font-semibold"><UserRound className="size-4 text-primary" aria-hidden />Employee details</h2><dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Job title</dt><dd className="mt-1">{profile.jobTitle || "Not set"}</dd></div><div><dt className="text-muted-foreground">Organization role</dt><dd className="mt-1">{roles[person.role]}</dd></div><div><dt className="text-muted-foreground">Departments</dt><dd className="mt-1">{profile.departments.map(d => d.name).join(", ") || "Not assigned"}</dd></div><div><dt className="text-muted-foreground">Joined workspace</dt><dd className="mt-1">{new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"Africa/Cairo"}).format(new Date(profile.joinedAt))}</dd></div></dl></section>
   </> : visibleSection === "projects" ? <section className="roaya-glass divide-y divide-border">{profile.projects.length ? profile.projects.map(project => <Link key={project.id} href={"/projects/"+project.id} className="flex flex-wrap items-center justify-between gap-3 p-5 hover:bg-muted/50"><span className="inline-flex items-center gap-3 text-sm font-medium"><BriefcaseBusiness className="size-4 text-primary" aria-hidden />{project.name}</span><Badge variant="secondary" className="capitalize">{statusLabel(project.status)}</Badge></Link>) : <p className="p-6 text-sm text-muted-foreground">No active projects are visible for this employee.</p>}</section> : <section className="roaya-glass divide-y divide-border">{profile.tasks.length ? profile.tasks.map(task => <Link key={task.id} href={"/projects/"+task.projectId} className="flex flex-wrap items-center justify-between gap-4 p-5 hover:bg-muted/50"><div><p className="text-sm font-medium">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{task.projectName || "Project"}{task.dueOn ? " · Due " + task.dueOn : ""}</p></div><Badge variant="secondary" className="capitalize">{statusLabel(task.status)}</Badge></Link>) : <p className="p-6 text-sm text-muted-foreground">No assigned tasks are visible for this employee.</p>}</section>}
   {profile.canViewWork ? <p className="text-xs leading-5 text-muted-foreground">Projects, tasks and counts include only work you have permission to view. Projects shown are owned by or assigned to this employee.</p> : null}
  </div>
  {profile.canManage ? <EmployeeDeletion profile={profile} organizationId={organizationId} disabled={pending} /> : null}
 </div>
}

function EmployeeEditor({profile,organizationId,pending,save}: {profile:EmployeeProfile;organizationId:string;pending:boolean;save:(action:()=>Promise<AdminResult>)=>Promise<void>}) {
 const [name,setName]=useState(profile.person.name)
 const [jobTitle,setJobTitle]=useState(profile.jobTitle)
 const [colour,setColour]=useState(profile.person.avatarColor)
 const [role,setRole]=useState(profile.person.role)
 const [department,setDepartment]=useState("")
 const available=profile.availableDepartments.filter(d=>!profile.departments.some(assigned=>assigned.id===d.id))
 return <section className="roaya-glass grid divide-y divide-border">
  <EmployeePhotoUpload profile={profile} organizationId={organizationId} pending={pending} save={save} />
  <form className="grid gap-5 p-6" onSubmit={e=>{e.preventDefault();void save(()=>updateEmployeeDetails(organizationId,profile.person.profileId,{name,jobTitle,avatarColor:colour}))}}><h2 className="font-semibold">Edit employee details</h2><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm">Full name<Input className="h-11" required maxLength={120} disabled={pending} value={name} onChange={e=>setName(e.target.value)}/></label><label className="grid gap-2 text-sm">Job title<Input className="h-11" maxLength={120} disabled={pending} value={jobTitle} onChange={e=>setJobTitle(e.target.value)}/></label></div><fieldset disabled={pending}><legend className="mb-3 text-sm">Avatar colour</legend><div className="flex gap-3">{[...new Set([profile.person.avatarColor,...colours])].map(c=><button key={c} type="button" aria-label={"Avatar colour "+c} aria-pressed={colour===c} onClick={()=>setColour(c)} className={"size-8 rounded-full border-2 "+(colour===c?"border-foreground ring-2 ring-ring ring-offset-2":"border-transparent")} style={{backgroundColor:c}}/>)}</div></fieldset><Button type="submit" className="w-fit" disabled={pending}>{pending?"Saving…":"Save details"}</Button></form>
  <form className="grid gap-4 p-6 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={e=>{e.preventDefault();void save(()=>setOrganizationRole(organizationId,profile.person.profileId,role))}}><label className="grid gap-2 text-sm">Organization role<select className="h-11 rounded-xl border bg-card px-3" disabled={pending} value={role} onChange={e=>setRole(e.target.value as typeof role)}>{Object.entries(roles).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><Button type="submit" disabled={pending || role===profile.person.role}>Save role</Button></form>
  <form className="grid gap-4 p-6 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={e=>{e.preventDefault();void save(()=>addDepartmentMember(organizationId,department,profile.person.profileId))}}><label className="grid gap-2 text-sm">Add to department<select className="h-11 rounded-xl border bg-card px-3" disabled={pending || !available.length} required value={department} onChange={e=>setDepartment(e.target.value)}><option value="">{available.length?"Choose department":"No additional departments available"}</option>{available.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><Button type="submit" disabled={pending || !department}>Add to department</Button></form>
 </section>
}

function EmployeePhotoUpload({profile,organizationId,pending,save}: {profile:EmployeeProfile;organizationId:string;pending:boolean;save:(action:()=>Promise<AdminResult>)=>Promise<void>}) {
 const [file,setFile]=useState<File|null>(null)
 const [preview,setPreview]=useState("")
 const [error,setError]=useState("")
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview])
 return <form className="grid gap-5 p-6" onSubmit={event=>{event.preventDefault();if(!file)return;const data=new FormData();data.set("photo",file);void save(()=>uploadEmployeePhoto(organizationId,profile.person.profileId,data))}}>
  <div><h2 className="font-semibold">Profile photo</h2><p className="mt-1 text-sm text-muted-foreground">Choose a JPG, PNG or WebP image up to 2 MB. Your photo will be cropped to a square.</p></div>
  <div className="flex flex-wrap items-center gap-5">
   <Avatar className="size-20">{preview || profile.person.avatarUrl ? <AvatarImage src={preview || profile.person.avatarUrl} alt="Profile photo preview" /> : null}<AvatarFallback className="text-xl text-white" style={{backgroundColor:profile.person.avatarColor}}>{profile.person.initials}</AvatarFallback></Avatar>
   <div className="grid min-w-0 flex-1 gap-2"><label htmlFor="employee-photo" className="text-sm font-medium">Choose photo</label><input id="employee-photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={pending} className="w-full min-w-0 text-sm file:me-3 file:rounded-lg file:border file:border-border file:bg-muted file:px-3 file:py-2 file:font-medium" onChange={event=>{const chosen=event.target.files?.[0];setError("");setFile(null);setPreview("");if(!chosen)return;if(!["image/jpeg","image/png","image/webp"].includes(chosen.type)||chosen.size>2*1024*1024||!chosen.size){setError("Choose a JPG, PNG or WebP image up to 2 MB.");event.target.value="";return}setFile(chosen);setPreview(URL.createObjectURL(chosen))}} /></div>
  </div>
  {error?<p role="alert" className="text-sm text-destructive">{error}</p>:null}
  <Button type="submit" disabled={pending||!file} className="w-fit">{pending?"Uploading…":"Upload photo"}</Button>
 </form>
}

function EmployeeDeletion({profile,organizationId,disabled}:{profile:EmployeeProfile;organizationId:string;disabled:boolean}) {
 const router=useRouter()
 const [open,setOpen]=useState(false)
 const [confirmation,setConfirmation]=useState("")
 const [deleting,setDeleting]=useState(false)
 const [feedback,setFeedback]=useState("")
 const [deleted,setDeleted]=useState(false)
 const [transferMode,setTransferMode]=useState("self")
 const [recipient,setRecipient]=useState("")
 async function remove() {
  if(deleting || deleted)return
  setDeleting(true);setFeedback("")
  try {const result=await deleteEmployee(organizationId,profile.person.profileId,confirmation,transferMode==="employee"?recipient:undefined);setFeedback(result.message);if(result.ok)setDeleted(true)}
  catch {setFeedback("The request failed. Try again.")}
  finally {setDeleting(false)}
 }
 function close(){if(deleting)return;if(deleted){router.replace("/people");router.refresh()}setOpen(false);setConfirmation("");setFeedback("")}
 return <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-destructive/25 bg-destructive/5 p-6">
  <div><h2 className="font-semibold text-destructive">Delete employee</h2><p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">{profile.isSelf?"You cannot delete your own account.":"Permanently remove this employee's account and workspace memberships. This cannot be undone."}</p></div>
  <Button type="button" variant="destructive" disabled={disabled || profile.isSelf} onClick={()=>setOpen(true)}>Delete employee</Button>
  <Dialog open={open} onOpenChange={value=>{if(!value)close()}}>
   <DialogContent showCloseButton={!deleting} className="sm:max-w-lg">
    <DialogHeader><DialogTitle>{deleted?"Employee deleted":"Permanently delete employee?"}</DialogTitle><DialogDescription>{deleted?"The account has been removed.":"You are deleting the account for "+profile.person.name+". This action cannot be undone."}</DialogDescription></DialogHeader>
    {deleted?<><p role="status" className="text-sm">{feedback}</p><Button type="button" onClick={close}>Back to employees</Button></>:<form className="grid gap-4" onSubmit={event=>{event.preventDefault();void remove()}}>
     <p className="text-sm leading-6 text-muted-foreground">Their account and memberships will be removed. Projects, campaigns, assets and assigned tasks will be transferred to the person you choose. Work will be preserved. Historical authorship may still prevent permanent account deletion.</p>
     <p className="break-all text-sm font-medium">{profile.person.email}</p>
     <fieldset disabled={deleting} className="grid gap-3"><legend className="mb-2 text-sm font-medium">Transfer ownership and assigned tasks to</legend><label className="flex items-center gap-2 text-sm"><input type="radio" name="transfer-recipient" checked={transferMode==="self"} onChange={()=>setTransferMode("self")}/>Me (current Super admin) — default</label><label className="flex items-center gap-2 text-sm"><input type="radio" name="transfer-recipient" checked={transferMode==="employee"} onChange={()=>setTransferMode("employee")}/>Another employee</label>{transferMode==="employee"?<label className="grid gap-2 text-sm">Employee<select required value={recipient} onChange={e=>setRecipient(e.target.value)} className="h-11 rounded-xl border border-border bg-card px-3"><option value="">Choose employee</option>{(profile.transferRecipients??[]).map(p=><option key={p.profileId} value={p.profileId}>{p.name} — {p.email}</option>)}</select><span className="text-xs text-muted-foreground">They must already have full access to the affected projects.</span></label>:null}</fieldset>
     <label className="grid gap-2 text-sm">Type the employee’s email to confirm<Input type="email" required disabled={deleting} autoComplete="off" value={confirmation} onChange={event=>setConfirmation(event.target.value)} /></label>
     {feedback?<p role="alert" className="text-sm text-destructive">{feedback}</p>:null}
     <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" disabled={deleting} onClick={close}>Cancel</Button><Button type="submit" variant="destructive" disabled={deleting || (transferMode==="employee"&&!recipient) || confirmation.trim().toLowerCase()!==profile.person.email.trim().toLowerCase()}>{deleting?"Deleting…":"Permanently delete employee"}</Button></div>
    </form>}
   </DialogContent>
  </Dialog>
 </section>
}
