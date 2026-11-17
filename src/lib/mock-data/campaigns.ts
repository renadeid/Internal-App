import type { Campaign } from "@/lib/types"

export const initialCampaigns: Campaign[] = [
  {
    id: "campaign-launch",
    projectId: "spring",
    name: "Field Notes spring launch",
    description:
      "The company story, homepage, and sales kit for the April launch.",
    ownerId: "maya",
    type: "Content",
    status: "Active",
    startDate: "2026-03-02",
    endDate: "2026-04-14",
    goals: "Approve the homepage and sales kit before the public launch.",
  },
  {
    id: "campaign-harbor",
    projectId: "harbor",
    name: "Harbor Clinic story",
    description:
      "A customer film and article from clinicians using Northline in the field.",
    ownerId: "priya",
    type: "Content",
    status: "Active",
    startDate: "2026-03-09",
    endDate: "2026-04-21",
    goals: "Publish the film and article with a confirmed customer quote.",
  },
  {
    id: "campaign-demand",
    projectId: "demand",
    name: "Q2 demand program",
    description: "The follow-on program once Field Notes is in market.",
    ownerId: "leo",
    type: "Email",
    status: "Planning",
    startDate: "2026-04-01",
    endDate: "2026-06-30",
    goals: "Lock the channel mix and messaging before the quarter starts.",
  },
  {
    id: "campaign-webinar",
    projectId: "webinar",
    name: "Partner webinar series",
    description: "Partner sessions waiting on confirmed product dates.",
    ownerId: "leo",
    type: "Event",
    status: "On Hold",
    startDate: "2026-02-02",
    endDate: "2026-05-12",
    goals: "Restart the series when the launch calendar is locked.",
  },
]

export function campaignPath(id: string) {
  return `/workspaces/marketing/campaigns/${id}` as const
}
