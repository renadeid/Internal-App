"use client"
import type { ProjectAccessMode, ProjectPermissions } from "@/lib/auth/super-admin-types"
const labels: Record<ProjectAccessMode, string> = { members: "Selected members only", department: "Lead department", organization: "All organization employees", custom: "Custom permissions", invitation: "By invitation" }
export function ProjectAccessFields({ members, mode, onModeChange, selected, onSelectedChange, permissions, onPermissionsChange, disabled, restricted = false }: {
 members: { id: string; name: string }[]; mode: ProjectAccessMode; onModeChange: (mode: ProjectAccessMode) => void;
 selected: string[]; onSelectedChange: (ids: string[]) => void; permissions: ProjectPermissions; onPermissionsChange: (permissions: ProjectPermissions) => void; disabled: boolean; restricted?: boolean
}) {
 return <fieldset disabled={disabled} className="grid gap-3 rounded-lg border p-3">
  <legend className="px-1 text-sm font-medium">Project access</legend>
  <label className="grid gap-2 text-sm">Who should have access?
   <select className="h-9 rounded-md border bg-background px-2" value={mode} onChange={e => onModeChange(e.target.value as ProjectAccessMode)}>
    {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
   </select>
  </label>
  <p className="text-xs text-muted-foreground">The owner and Super admins always retain access. Department and organization selections include current employees at creation time.</p>
  {["members", "custom", "invitation"].includes(mode) ? <div className="max-h-36 space-y-2 overflow-y-auto" aria-label="Project members">
   {members.map(m => <label key={m.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(m.id)} onChange={e => onSelectedChange(e.target.checked ? [...selected, m.id] : selected.filter(id => id !== m.id))} />{m.name}</label>)}
  </div> : null}
  {mode === "invitation" ? <p className="text-xs text-muted-foreground">Selected members receive invitations in Settings. Access starts when they accept.</p> : null}
  {mode === "custom" && !restricted ? <div className="grid gap-2">{([ ["edit", "Edit project details"], ["manageMembers", "Manage project members"], ["approve", "Approve deliverables"], ["manageAssets", "Manage assets"] ] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={permissions[key]} onChange={e => onPermissionsChange({ ...permissions, [key]: e.target.checked })} />{label}</label>)}<p className="text-xs text-muted-foreground">These permissions apply to selected members. Organization viewers remain read-only. Project members can work on tasks.</p></div> : null}
 </fieldset>
}
