import type { Database } from "@/lib/supabase/database"

export type ProjectStatusValue = Database["public"]["Enums"]["project_status"]

export type OrganizationProject = {
  historyAccess?: "full_history" | "assigned_only"
  id: string
  name: string
  description: string
  status: ProjectStatusValue
  leadDepartmentId: string
  leadDepartment: string | null
  ownerId: string
  ownerName: string | null
  startsOn: string | null
  dueOn: string | null
  archivedAt: string | null
  updatedOn: string
}

export type UpdateProjectInput = {
  organizationId: string
  projectId: string
  name: string
  description: string
  status: ProjectStatusValue
  leadDepartmentId: string
  ownerId: string
  startsOn: string | null
  dueOn: string | null
}

export type UpdateProjectResult =
  | { status: "updated" }
  | { status: "invalid"; message: string }
  | { status: "denied" }
  | { status: "unavailable" }
  | { status: "rejected" }
  | { status: "error" }

export type ArchiveProjectInput = {
  organizationId: string
  projectId: string
  archived: boolean
}

export type ArchiveProjectResult =
  | { status: "updated" }
  | { status: "invalid"; message: string }
  | { status: "denied" }
  | { status: "unavailable" }
  | { status: "rejected" }
  | { status: "error" }

export type ProjectEditAccess =
  | { status: "error" }
  | { status: "rejected" }
  | { status: "ready"; canEdit: false }
  | {
      status: "ready"
      canEdit: true
      canArchive: boolean
      canDelete?: boolean
      departments: { id: string; name: string }[]
      owners: { id: string; name: string }[]
    }

export type OrganizationProjectsResult =
  | { status: "ready"; projects: OrganizationProject[] }
  | { status: "error" }
  | { status: "rejected" }

export type OrganizationProjectResult =
  | { status: "ready"; project: OrganizationProject }
  | { status: "sample" }
  | { status: "missing" }
  | { status: "error" }
  | { status: "rejected" }
