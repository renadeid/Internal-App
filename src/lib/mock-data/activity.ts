import type { ActivityItem, NotificationItem } from "@/lib/types"

export const activity: ActivityItem[] = [
  {
    id: "act-interview",
    actorId: "priya",
    summary: "shared the Harbor Clinic interview cut",
    context: "Assets Library",
    timeLabel: "2 hours ago",
    href: "/workspaces/marketing/campaigns/campaign-harbor",
    projectId: "harbor",
    campaignId: "campaign-harbor",
  },
  {
    id: "act-onepager",
    actorId: "amira",
    summary: "requested a review of the sales one-pager",
    context: "My Tasks",
    timeLabel: "3 hours ago",
    href: "/workspaces/marketing/campaigns/campaign-launch",
    projectId: "spring",
    campaignId: "campaign-launch",
  },
  {
    id: "act-brand",
    actorId: "jonah",
    summary: "left comments on the Field Notes brand system",
    context: "Projects",
    timeLabel: "5 hours ago",
    href: "/projects/brand",
    projectId: "brand",
  },
  {
    id: "act-demand",
    actorId: "leo",
    summary: "moved Q2 demand program into planning",
    context: "Projects",
    timeLabel: "Yesterday",
    href: "/workspaces/marketing/campaigns/campaign-demand",
    projectId: "demand",
    campaignId: "campaign-demand",
  },
  {
    id: "act-checklist",
    actorId: "sam",
    summary: "added the week-one checklist",
    context: "Artifact Hub",
    timeLabel: "Yesterday",
    href: "/projects/onboarding",
    projectId: "onboarding",
  },
  {
    id: "act-launch",
    actorId: "maya",
    summary: "updated progress on the spring product launch",
    context: "Projects",
    timeLabel: "Yesterday",
    href: "/workspaces/marketing/campaigns/campaign-launch",
    projectId: "spring",
    campaignId: "campaign-launch",
  },
  {
    id: "act-screens",
    actorId: "nolan",
    summary: "uploaded the product UI screens",
    context: "Assets Library",
    timeLabel: "Monday",
    href: "/projects/spring",
    projectId: "spring",
  },
]

export const initialNotifications: NotificationItem[] = activity
  .slice(0, 4)
  .map((item) => ({
    id: item.id,
    title: item.summary,
    detail: item.context,
    timeLabel: item.timeLabel,
    href: item.href,
    read: false,
  }))
