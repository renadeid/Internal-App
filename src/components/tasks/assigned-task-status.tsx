"use client"
import { useState } from "react"
import { taskStatusLabel, taskStatusValues, type OrganizationTask, type TaskStatusValue } from "@/lib/auth/organization-tasks"
import { setOrganizationTaskStatus } from "@/lib/auth/task-creation-actions"
import { refreshOrganizationTasks } from "@/lib/auth/task-list-refresh"
import { useOrganization } from "@/components/auth/organization-provider"

export function AssignedTaskStatus({ task }: { task: OrganizationTask }) {
 const { activeOrganization } = useOrganization()
 const [pending, setPending] = useState(false)
 const [message, setMessage] = useState("")
 async function change(status: TaskStatusValue) {
  if (!activeOrganization || pending || status === task.status) return
  setPending(true); setMessage("")
  try {
   const result = await setOrganizationTaskStatus({ organizationId: activeOrganization.id, projectId: task.projectId, taskId: task.id, status })
   if (result.status === "updated") refreshOrganizationTasks()
   else setMessage(result.status === "invalid" ? result.message : "Status could not be saved. Refresh to check your access.")
  } catch { setMessage("Status could not be saved.") }
  setPending(false)
 }
 return <div className="grid gap-1"><select aria-label={`Status for ${task.title}`} value={task.status} disabled={pending||task.status==="in_review"||task.status==="done"} className="h-8 max-w-40 rounded-lg border bg-card px-2 text-xs" onChange={event => { if (taskStatusValues.some(status => status === event.target.value)) void change(event.target.value as TaskStatusValue) }}>{taskStatusValues.filter(status=>status==="todo"||status==="in_progress"||status===task.status).map(status => <option key={status} value={status}>{taskStatusLabel(status)}</option>)}</select>{pending ? <span role="status" className="text-xs">Saving…</span> : null}{message ? <span role="alert" className="max-w-48 text-xs text-destructive">{message}</span> : null}</div>
}
