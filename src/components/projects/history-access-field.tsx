"use client"
import type { ProjectHistoryAccess } from "@/lib/auth/super-admin-types"
export function HistoryAccessField({ value, onChange, disabled = false }: { value: ProjectHistoryAccess; onChange: (value: ProjectHistoryAccess) => void; disabled?: boolean }) {
 return <label className="grid gap-2 text-sm">Project history visibility
  <select className="h-9 rounded-md border bg-background px-2" value={value} disabled={disabled} onChange={e => onChange(e.target.value as ProjectHistoryAccess)}>
   <option value="full_history">Full project history</option>
   <option value="assigned_only">Assigned tasks only</option>
  </select>
  <span className="text-xs text-muted-foreground">Full history includes all project work. Assigned tasks only shows tasks assigned to this member and hides other work, project activity, and private project files. No access is granted before a member is added or accepts an invitation.</span>
 </label>
}
