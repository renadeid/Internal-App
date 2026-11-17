import type { Project } from "@/lib/types"

export const initialProjects: Project[] = [
  {
    id: "spring",
    name: "Spring product launch",
    description:
      "Homepage, sales narrative, and enablement for the Field Notes launch.",
    department: "Marketing",
    departments: ["Marketing", "Design", "Product", "Engineering"],
    status: "In review",
    progress: 72,
    ownerId: "maya",
    memberIds: ["maya", "jonah", "amira", "nolan"],
    team: [
      { memberId: "maya", projectRole: "Owner" },
      { memberId: "jonah", projectRole: "Design" },
      { memberId: "amira", projectRole: "Product marketing" },
      { memberId: "nolan", projectRole: "Engineering" },
    ],
    updatedLabel: "Updated yesterday",
    startLabel: "Mar 2",
    deadlineLabel: "Apr 14",
  },
  {
    id: "brand",
    name: "Field Notes brand system",
    description:
      "Wordmark, color, and photography direction for the spring campaign.",
    department: "Design",
    departments: ["Design", "Marketing"],
    status: "In progress",
    progress: 54,
    ownerId: "jonah",
    memberIds: ["jonah", "maya", "priya"],
    team: [
      { memberId: "jonah", projectRole: "Owner" },
      { memberId: "maya", projectRole: "Marketing" },
      { memberId: "priya", projectRole: "Content" },
    ],
    updatedLabel: "Updated today",
    startLabel: "Feb 16",
    deadlineLabel: "Apr 7",
  },
  {
    id: "harbor",
    name: "Harbor Clinic story",
    description:
      "Customer film and written story from the Harbor Clinic field team.",
    department: "Marketing",
    departments: ["Marketing", "Design", "Product"],
    status: "In progress",
    progress: 81,
    ownerId: "priya",
    memberIds: ["priya", "amira", "jonah"],
    team: [
      { memberId: "priya", projectRole: "Owner" },
      { memberId: "amira", projectRole: "Product marketing" },
      { memberId: "jonah", projectRole: "Design" },
    ],
    updatedLabel: "Updated today",
    startLabel: "Mar 9",
    deadlineLabel: "Apr 21",
  },
  {
    id: "demand",
    name: "Q2 demand program",
    description:
      "Channel mix and messaging for the quarter after the Field Notes launch.",
    department: "Marketing",
    departments: ["Marketing", "Product"],
    status: "Planning",
    progress: 18,
    ownerId: "leo",
    memberIds: ["leo", "maya", "amira"],
    team: [
      { memberId: "leo", projectRole: "Owner" },
      { memberId: "maya", projectRole: "Campaigns" },
      { memberId: "amira", projectRole: "Product" },
    ],
    updatedLabel: "Updated yesterday",
    startLabel: "Apr 1",
    deadlineLabel: "Jun 30",
  },
  {
    id: "onboarding",
    name: "New hire workspace kit",
    description:
      "Week-one checklist, walkthrough, and links for people joining Northline.",
    department: "People",
    departments: ["People", "Marketing"],
    status: "In progress",
    progress: 46,
    ownerId: "sam",
    memberIds: ["sam", "maya"],
    team: [
      { memberId: "sam", projectRole: "Owner" },
      { memberId: "maya", projectRole: "Marketing" },
    ],
    updatedLabel: "Updated Monday",
    startLabel: "Mar 23",
    deadlineLabel: "Apr 28",
  },
  {
    id: "webinar",
    name: "Partner webinar series",
    description:
      "Three partner sessions paused until product confirms the spring dates.",
    department: "Marketing",
    departments: ["Marketing"],
    status: "On hold",
    progress: 33,
    ownerId: "leo",
    memberIds: ["leo", "priya"],
    team: [
      { memberId: "leo", projectRole: "Owner" },
      { memberId: "priya", projectRole: "Content" },
    ],
    updatedLabel: "Paused last week",
    startLabel: "Feb 2",
    deadlineLabel: "May 12",
  },
]

export function getProjectName(projects: Project[], projectId: string) {
  return projects.find((project) => project.id === projectId)?.name ?? "Workspace"
}
