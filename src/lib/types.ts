export const departments = [
  "Marketing",
  "Design",
  "Product",
  "People",
  "Engineering",
] as const

export type Department = (typeof departments)[number]

export const projectStatuses = [
  "Planning",
  "In progress",
  "In review",
  "On hold",
] as const

export type ProjectStatus = (typeof projectStatuses)[number]

export const taskStatuses = ["To do", "In progress", "In review", "Done"] as const

export type TaskStatus = (typeof taskStatuses)[number]

export const priorities = ["Low", "Medium", "High", "Urgent"] as const

export type Priority = (typeof priorities)[number]

export const campaignTypes = [
  "Social Media",
  "Email",
  "Paid Ads",
  "Content",
  "Event",
  "Other",
] as const

export type CampaignType = (typeof campaignTypes)[number]

export const campaignStatuses = [
  "Planning",
  "Active",
  "On Hold",
  "Completed",
] as const

export type CampaignStatus = (typeof campaignStatuses)[number]

export const deliverableTypes = [
  "Design",
  "Video",
  "Copy",
  "Document",
  "Presentation",
  "Other",
] as const

export type DeliverableType = (typeof deliverableTypes)[number]

export const deliverableStatuses = [
  "Draft",
  "In Progress",
  "Submitted",
  "Changes Requested",
  "Approved",
] as const

export type DeliverableStatus = (typeof deliverableStatuses)[number]

export type AppRoute =
  | "/"
  | "/projects"
  | "/tasks"
  | "/requests"
  | "/activity"
  | "/assets"
  | "/artifacts"
  | "/knowledge"
  | "/workspaces/marketing"
  | "/people"
  | "/settings"

export const assetTypes = [
  "Image",
  "Video",
  "Document",
  "Presentation",
  "Design",
  "External Link",
  "Other",
] as const

export type AssetType = (typeof assetTypes)[number]

export const assetVisibilities = [
  "Company",
  "Project Members",
  "Restricted",
] as const

export type AssetVisibility = (typeof assetVisibilities)[number]

export type ProjectHref = `/projects/${string}`

export type CampaignHref = `/workspaces/marketing/campaigns/${string}`

export type AssetHref = `/assets/${string}`

export type AppHref = AppRoute | ProjectHref | CampaignHref | AssetHref

export type TeamMember = {
  id: string
  name: string
  role: string
  department: Department
  initials: string
  email: string
  color: string
}

export type ProjectAssignment = {
  memberId: string
  projectRole: string
}

export type Project = {
  id: string
  name: string
  description: string
  department: Department
  departments: Department[]
  status: ProjectStatus
  progress: number
  ownerId: string
  memberIds: string[]
  team: ProjectAssignment[]
  updatedLabel: string
  startLabel: string
  deadlineLabel: string
}

export type NewProjectInput = {
  name: string
  description: string
  ownerId: string
  department: Department
}

export type ProjectUpdate = {
  name: string
  description: string
  ownerId: string
  department: Department
  departments: Department[]
  status: ProjectStatus
  progress: number
  startLabel: string
  deadlineLabel: string
}

export type Task = {
  id: string
  title: string
  description: string
  projectId: string
  campaignId?: string
  assigneeId: string
  priority: Priority
  status: TaskStatus
  dueLabel: string
  dueDate?: string
}

export type ActivityItem = {
  id: string
  actorId: string
  summary: string
  context: string
  timeLabel: string
  href: AppHref
  projectId?: string
  campaignId?: string
}

export type NotificationItem = {
  id: string
  title: string
  detail: string
  timeLabel: string
  href: AppHref
  read: boolean
}

export type Asset = {
  id: string
  name: string
  description: string
  type: AssetType
  kind: string
  url?: string
  href?: string
  tags: string[]
  ownerId: string
  projectId?: string
  campaignId?: string
  visibility: AssetVisibility
  collection: string
  archived: boolean
  createdAt: string
  updatedAt: string
  updatedLabel: string
}

export type AssetInput = {
  name: string
  description: string
  type: AssetType
  url: string
  tags: string[]
  ownerId: string
  projectId: string
  campaignId: string
  visibility: AssetVisibility
  collection: string
}

export type AssetComment = {
  id: string
  assetId: string
  authorId: string
  body: string
  createdAt: string
  resolved: boolean
}

export type AssetVersion = {
  id: string
  assetId: string
  number: number
  label: string
  date: string
  authorId: string
  notes: string
}

export type Artifact = {
  id: string
  name: string
  kind: string
  projectId: string
  ownerId: string
  updatedLabel: string
}

export type Campaign = {
  id: string
  projectId: string
  name: string
  description: string
  ownerId: string
  type: CampaignType
  status: CampaignStatus
  startDate: string
  endDate: string
  goals: string
}

export type CampaignInput = {
  name: string
  description: string
  projectId: string
  ownerId: string
  type: CampaignType
  status: CampaignStatus
  startDate: string
  endDate: string
  goals: string
}

export type Deliverable = {
  id: string
  campaignId: string
  projectId: string
  title: string
  type: DeliverableType
  creatorId: string
  status: DeliverableStatus
  dueDate: string
  assetId?: string
}

export type DeliverableInput = {
  title: string
  type: DeliverableType
  creatorId: string
  dueDate: string
  assetId?: string
}

export type TaskInput = {
  title: string
  description: string
  assigneeId: string
  priority: Priority
  status: TaskStatus
  dueDate: string
}

export type Milestone = {
  id: string
  projectId: string
  name: string
  dueLabel: string
  complete: boolean
}

export type Article = {
  id: string
  title: string
  summary: string
  body: string
}
