import type { Task } from "@/lib/types"

export const tasks: Task[] = [
  {
    id: "task-homepage",
    title: "Approve the Field Notes homepage",
    description: "Review the homepage copy before it goes to design.",
    projectId: "spring",
    campaignId: "campaign-launch",
    assigneeId: "maya",
    priority: "High",
    status: "In review",
    dueLabel: "Tomorrow",
  },
  {
    id: "task-brand",
    title: "Comment on the brand system",
    description: "Leave notes on the wordmark and color direction.",
    projectId: "brand",
    assigneeId: "maya",
    priority: "Medium",
    status: "In progress",
    dueLabel: "Today",
  },
  {
    id: "task-quote",
    title: "Confirm the Harbor Clinic quote",
    description: "Check the customer quote before the article is published.",
    projectId: "harbor",
    campaignId: "campaign-harbor",
    assigneeId: "maya",
    priority: "High",
    status: "To do",
    dueLabel: "Friday",
  },
  {
    id: "task-channels",
    title: "Outline the Q2 channel mix",
    description: "Draft where the follow-on program will run.",
    projectId: "demand",
    campaignId: "campaign-demand",
    assigneeId: "maya",
    priority: "Medium",
    status: "To do",
    dueLabel: "Next Monday",
  },
  {
    id: "task-onepager",
    title: "Review the sales one-pager",
    description: "Check the sales leave-behind against the launch narrative.",
    projectId: "spring",
    campaignId: "campaign-launch",
    assigneeId: "amira",
    priority: "High",
    status: "In review",
    dueLabel: "Tomorrow",
  },
  {
    id: "task-photos",
    title: "Choose the launch photography",
    description: "Pick the set that matches the brand direction.",
    projectId: "brand",
    assigneeId: "jonah",
    priority: "Medium",
    status: "In review",
    dueLabel: "Friday",
  },
  {
    id: "task-cut",
    title: "Cut the Harbor Clinic interview",
    description: "Finish the field interview for the customer film.",
    projectId: "harbor",
    campaignId: "campaign-harbor",
    assigneeId: "priya",
    priority: "Medium",
    status: "In progress",
    dueLabel: "Friday",
  },
  {
    id: "task-checklist",
    title: "Draft the week-one checklist",
    description: "Write the first-week path for new hires.",
    projectId: "onboarding",
    assigneeId: "sam",
    priority: "Low",
    status: "In progress",
    dueLabel: "Next Monday",
  },
  {
    id: "task-webinar",
    title: "Hold the webinar outline",
    description: "Pause the session outline until dates are confirmed.",
    projectId: "webinar",
    campaignId: "campaign-webinar",
    assigneeId: "leo",
    priority: "Low",
    status: "Done",
    dueLabel: "Last week",
  },
  {
    id: "task-checklist-launch",
    title: "Publish the launch checklist",
    description: "Share the launch checklist with the campaign team.",
    projectId: "spring",
    campaignId: "campaign-launch",
    assigneeId: "maya",
    priority: "Low",
    status: "Done",
    dueLabel: "Yesterday",
  },
]

export function dueText(label: string) {
  if (!label || label === "Not set") return "No due date"
  if (label === "Today" || label === "Tomorrow" || label === "Yesterday") {
    return `Due ${label.toLowerCase()}`
  }
  return `Due ${label}`
}

export function isDueSoon(label: string) {
  return label === "Today" || label === "Tomorrow"
}
