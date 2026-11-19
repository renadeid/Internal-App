"use client"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { getAdminProjectMembers, saveProjectMember } from "@/lib/auth/super-admin-actions"
import { refreshOrganizationTasks } from "@/lib/auth/task-list-refresh"
import { refreshProjectInvitations } from "@/components/projects/project-invitations"
import { HistoryAccessField } from "@/components/projects/history-access-field"
import type { ProjectPermissions, ProjectHistoryAccess } from "@/lib/auth/super-admin-types"
const defaults: ProjectPermissions = { edit: false, manageMembers: false, approve: false, manageAssets: false }
export function ProjectAdminAccess({ organizationId, projectId }: { organizationId: string; projectId: string }) {
 const [data, setData] = useState<Awaited<ReturnType<typeof getAdminProjectMembers>>>(null)
 const [profileId, setProfileId] = useState("")
 const [historyAccess, setHistoryAccess] = useState<ProjectHistoryAccess>("assigned_only")
 const [flags, setFlags] = useState(defaults)
 const [taskIds, setTaskIds] = useState<string[]>([])
 const [canUpdateStatus, setCanUpdateStatus] = useState(false)
 const [message, setMessage] = useState("")
 const [pending, setPending] = useState(false)
 useEffect(() => { let active = true; getAdminProjectMembers(organizationId, projectId).then(value => { if (active) setData(value) }).catch(() => {}); return () => { active = false } }, [organizationId, projectId])
 async function save(id: string, operation: "save" | "remove" | "invite" | "cancel") {
  setPending(true); setMessage("")
  try { const result = await saveProjectMember(organizationId, projectId, id, flags, operation, historyAccess, { taskIds: operation === "invite" && historyAccess === "assigned_only" ? taskIds : [], canUpdateStatus: historyAccess === "assigned_only" && canUpdateStatus }); setMessage(result.message); if (result.ok) { refreshProjectInvitations(); setData(await getAdminProjectMembers(organizationId, projectId)); refreshOrganizationTasks() } }
  catch { setMessage("The change could not be saved.") } finally { setPending(false) }
 }
 if (!data) return null
 return <section className="grid gap-4 rounded-xl border bg-card p-5"><div><h2 className="font-semibold">Project access</h2><p className="text-sm text-muted-foreground">Super admin controls. Add members, edit permissions, or invite employees.</p></div>
 {message ? <p role="status" className="text-sm">{message}</p> : null}
 <fieldset disabled={pending || data.archived} className="grid gap-3"><label className="grid gap-1 text-sm">Member<select className="h-9 rounded-md border bg-background px-2" value={profileId} onChange={e => { setProfileId(e.target.value); setTaskIds([]); const member = data.members.find(m => m.profile_id === e.target.value); const invitation = data.invitations.find(i => i.profile_id === e.target.value); setHistoryAccess(member?.history_access ?? invitation?.history_access ?? "assigned_only"); setCanUpdateStatus(member?.can_update_assigned_status ?? invitation?.can_update_assigned_status ?? false); setTaskIds(invitation?.task_ids ?? []); setFlags(member ? { edit: member.can_edit, manageMembers: member.can_manage_members, approve: member.can_approve_deliverables, manageAssets: member.can_manage_assets } : defaults) }}><option value="">Choose a member</option>{data.people.filter(p => p.id !== data.ownerId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 <HistoryAccessField value={historyAccess} onChange={setHistoryAccess} />
 {historyAccess === "assigned_only" ? <div className="grid gap-3 rounded-lg border p-3">
  <label className="grid gap-1 text-sm">Assigned task permission<select className="h-9 rounded-lg border px-2" value={canUpdateStatus ? "status" : "view"} disabled={!profileId || data.people.find(p => p.id === profileId)?.role === "viewer"} onChange={e => setCanUpdateStatus(e.target.value === "status")}><option value="view">View only</option><option value="status">View and update task status</option></select></label>
  <p className="text-xs text-muted-foreground">Status access applies only to tasks assigned to this member. It does not allow editing details, reassigning, archiving or deleting. Organisation Viewers remain view-only.</p>
  {profileId && !data.members.some(m => m.profile_id === profileId) ? <fieldset className="grid gap-2"><legend className="mb-2 text-sm font-medium">Tasks included in the invitation</legend>
    {data.tasks.length === 0 ? <p className="text-xs text-muted-foreground">No active tasks yet. You can invite now and assign tasks after acceptance.</p> : <div className="grid max-h-60 gap-2 overflow-y-auto">{data.tasks.map(task => { const available = !task.assignee_id || task.assignee_id === profileId; return <label key={task.id} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" disabled={!available || (taskIds.length >= 100 && !taskIds.includes(task.id))} checked={taskIds.includes(task.id)} onChange={e => setTaskIds(ids => e.target.checked ? [...ids,task.id] : ids.filter(id => id !== task.id))} /><span>{task.title}{!available ? <span className="block text-xs text-muted-foreground">Assigned to another person. Change its assignee separately first.</span> : null}</span></label> })}</div>}
    <p className="text-xs text-muted-foreground">Selected tasks are assigned after acceptance. No project access is granted while the invitation is pending. Up to 100 tasks; the first 1,000 active project tasks are listed.</p>
  </fieldset> : null}
 </div> : null}
 <div className="flex flex-wrap gap-4">{([["edit", "Edit project"], ["manageMembers", "Manage members"], ["approve", "Approve deliverables"], ["manageAssets", "Manage assets"]] as const).map(([key,label]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={historyAccess === "assigned_only"} checked={historyAccess === "full_history" && flags[key]} onChange={e => setFlags({ ...flags, [key]: e.target.checked })} />{label}</label>)}</div>
 <div className="flex flex-wrap gap-2"><Button disabled={!profileId} onClick={() => save(profileId,"save")}>Save member access</Button><Button variant="outline" disabled={!profileId} onClick={() => save(profileId,"invite")}>Invite to project</Button></div>
 </fieldset>
 {data.archived ? <p className="text-sm text-muted-foreground">Restore the project to change access.</p> : null}
 <div className="grid gap-2">{data.members.map(m => <div key={m.profile_id} className="flex items-center justify-between gap-2 border-t pt-2 text-sm"><span>{data.people.find(p => p.id === m.profile_id)?.name ?? "Member"} · {m.history_access === "assigned_only" ? "Assigned tasks only" : "Full history"}{m.can_update_assigned_status ? " · Can update assigned task status" : ""}{m.profile_id === data.ownerId ? " · Owner" : ""}</span>{m.profile_id !== data.ownerId ? <Button variant="outline" disabled={pending || data.archived} onClick={() => save(m.profile_id,"remove")}>Remove</Button> : null}</div>)}</div>
 {data.invitations.map(inv => <div key={inv.id} className="flex items-center justify-between gap-2 text-sm"><span>{data.people.find(p => p.id === inv.profile_id)?.name ?? "Member"} · Invited · {inv.history_access === "assigned_only" ? "Assigned tasks only" : "Full history"}{inv.history_access === "assigned_only" ? inv.can_update_assigned_status ? " · Can update task status" : " · View only" : ""}{inv.task_ids.length ? ` · ${inv.task_ids.length} selected tasks` : ""}</span><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={pending || data.archived} onClick={() => save(inv.profile_id,"cancel")}>Cancel invitation</Button></div></div>)}
 </section>
}
