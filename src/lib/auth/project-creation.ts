export type ProjectDepartmentOption = {
  id: string
  name: string
}

export type ProjectOwnerOption = {
  id: string
  name: string
}

export type ProjectCreationAccess =
  | { status: "error" }
  | { status: "rejected" }
  | { status: "ready"; canCreate: false; reason: string }
  | {
      status: "ready"
      canCreate: true
      currentUserId: string
      departments: ProjectDepartmentOption[]
      owners: ProjectOwnerOption[]
    }

export type CreateProjectInput = {
  organizationId: string
  name: string
  description: string
  leadDepartmentId: string
  ownerId: string
  startsOn: string | null
  dueOn: string | null
}

export type CreateProjectResult =
  | { status: "created"; projectId: string }
  | { status: "invalid"; message: string }
  | { status: "denied" }
  | { status: "conflict" }
  | { status: "rejected" }
  | { status: "error" }
