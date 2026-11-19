import type {
  CampaignStatus,
  DeliverableStatus,
  Department,
  Priority,
  ProjectStatus,
  TaskStatus,
} from "@/lib/types"

export const surfaceClass =
  "roaya-glass rounded-2xl border border-border bg-card"

export const departmentClass: Record<Department, string> = {
  Marketing: "bg-navy-500/10 text-navy-600",
  Design: "bg-purple-500/10 text-purple-600",
  Product: "bg-slate-100 text-slate-700",
  People: "bg-emerald-50 text-emerald-800",
  Engineering: "bg-amber-50 text-amber-800",
}

export const projectStatusClass: Record<ProjectStatus, string> = {
  Planning: "bg-slate-100 text-slate-700",
  "In progress": "bg-navy-500/10 text-navy-600",
  "In review": "bg-purple-500/10 text-purple-600",
  "On hold": "bg-amber-50 text-amber-800",
}

export const campaignStatusClass: Record<CampaignStatus, string> = {
  Planning: "bg-slate-100 text-slate-700",
  Active: "bg-navy-500/10 text-navy-600",
  "On Hold": "bg-amber-50 text-amber-800",
  Completed: "bg-emerald-50 text-emerald-800",
}

export const deliverableStatusClass: Record<DeliverableStatus, string> = {
  Draft: "bg-slate-100 text-slate-700",
  "In Progress": "bg-navy-500/10 text-navy-600",
  Submitted: "bg-purple-500/10 text-purple-600",
  "Changes Requested": "bg-amber-50 text-amber-800",
  Approved: "bg-emerald-50 text-emerald-800",
}

export const taskStatusClass: Record<TaskStatus, string> = {
  "To do": "bg-slate-100 text-slate-700",
  "In progress": "bg-navy-500/10 text-navy-600",
  "In review": "bg-purple-500/10 text-purple-600",
  Done: "bg-emerald-50 text-emerald-800",
}

export const priorityClass: Record<Priority, string> = {
  Low: "text-slate-500",
  Medium: "text-navy-600",
  High: "text-amber-700",
  Urgent: "text-red-700",
}

export function isActiveProject(status: ProjectStatus) {
  return status !== "On hold"
}
