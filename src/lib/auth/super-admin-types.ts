export const projectAccessModes = ["members", "department", "organization", "custom", "invitation"] as const
export type ProjectAccessMode = typeof projectAccessModes[number]
export type ProjectPermissions = { edit: boolean; manageMembers: boolean; approve: boolean; manageAssets: boolean }
export type AdminMember = { id: string; name: string; email: string; role: "org_admin" | "admin" | "team_lead" | "member" | "viewer" }
export type AdminSnapshot = { role: AdminMember["role"]; isAdmin: boolean; members: AdminMember[]; departments: { id: string; name: string }[]; invitations: { id: string; project_id: string; project_name: string; history_access: ProjectHistoryAccess }[] }
export type AdminResult = { ok: boolean; message: string }

export type ProjectHistoryAccess = "full_history" | "assigned_only"

export type ProjectInvitation = {
 id: string; projectId: string; projectName: string; organizationId: string; organizationName: string; historyAccess: ProjectHistoryAccess
 canUpdateStatus?: boolean; taskTitles?: string[]
}
export type ProjectInvitationsResult = { status: "ready"; invitations: ProjectInvitation[] } | { status: "error" }

