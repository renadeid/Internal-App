import type {
  CampaignStatus,
  DeliverableStatus,
  Department,
  Priority,
  ProjectStatus,
  TaskStatus,
} from "@/lib/types"

export const surfaceClass =
  "rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]"

export const departmentClass: Record<Department, string> = {
  Marketing: "bg-[#2563EB]/10 text-[#1D4ED8]",
  Design: "bg-[#8B5CF6]/10 text-[#6D28D9]",
  Product: "bg-slate-100 text-slate-700",
  People: "bg-emerald-50 text-emerald-800",
  Engineering: "bg-amber-50 text-amber-800",
}

export const projectStatusClass: Record<ProjectStatus, string> = {
  Planning: "bg-slate-100 text-slate-700",
  "In progress": "bg-[#2563EB]/10 text-[#1D4ED8]",
  "In review": "bg-[#8B5CF6]/10 text-[#6D28D9]",
  "On hold": "bg-amber-50 text-amber-800",
}

export const campaignStatusClass: Record<CampaignStatus, string> = {
  Planning: "bg-slate-100 text-slate-700",
  Active: "bg-[#2563EB]/10 text-[#1D4ED8]",
  "On Hold": "bg-amber-50 text-amber-800",
  Completed: "bg-emerald-50 text-emerald-800",
}

export const deliverableStatusClass: Record<DeliverableStatus, string> = {
  Draft: "bg-slate-100 text-slate-700",
  "In Progress": "bg-[#2563EB]/10 text-[#1D4ED8]",
  Submitted: "bg-[#8B5CF6]/10 text-[#6D28D9]",
  "Changes Requested": "bg-amber-50 text-amber-800",
  Approved: "bg-emerald-50 text-emerald-800",
}

export const taskStatusClass: Record<TaskStatus, string> = {
  "To do": "bg-slate-100 text-slate-700",
  "In progress": "bg-[#2563EB]/10 text-[#1D4ED8]",
  "In review": "bg-[#8B5CF6]/10 text-[#6D28D9]",
  Done: "bg-emerald-50 text-emerald-800",
}

export const priorityClass: Record<Priority, string> = {
  Low: "text-slate-500",
  Medium: "text-[#1D4ED8]",
  High: "text-amber-700",
  Urgent: "text-red-700",
}

export function isActiveProject(status: ProjectStatus) {
  return status !== "On hold"
}
