import type { OrganizationPerson } from "./organization-people"
import type { OrganizationProject } from "./organization-projects"
import type { OrganizationTask } from "./organization-tasks"

export type EmployeeProfile = {
  person: OrganizationPerson
  jobTitle: string
  joinedAt: string
  departments: { id: string; name: string }[]
  availableDepartments: { id: string; name: string }[]
  projects: OrganizationProject[]
  tasks: OrganizationTask[]
  workUnavailable: boolean
  transferRecipients?: OrganizationPerson[]
  canManage: boolean
  isSelf: boolean
}
export type EmployeeProfileResult = { status: "ready"; profile: EmployeeProfile } | { status: "missing" | "error" }
