"use server"

import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { readSupabasePublicEnv } from "@/lib/supabase/public-env"
import { projectSlugFromName } from "@/lib/auth/project-slug"
import type { AdminResult, AdminSnapshot, ProjectHistoryAccess } from "@/lib/auth/super-admin-types"

async function adminClient(organizationId: string) {
  const client = await createClient()
  const { data } = await client.auth.getUser()
  if (!data.user) throw new Error("Sign in to continue.")
  const membership = await client.from("organization_memberships").select("role")
    .eq("organization_id", organizationId).eq("profile_id", data.user.id).maybeSingle()
  if (membership.error || membership.data?.role !== "org_admin") throw new Error("Super admin permission is required.")
  return client
}
function failure(error: unknown): AdminResult {
  return { ok: false, message: error instanceof Error ? error.message : "The change could not be saved." }
}
export async function getAdminSnapshot(organizationId: string): Promise<AdminSnapshot | null> {
  const client = await createClient()
  const { data } = await client.auth.getUser()
  if (!data.user) return null
  const membership = await client.from("organization_memberships").select("role")
    .eq("organization_id", organizationId).eq("profile_id", data.user.id).maybeSingle()
  if (membership.error || !membership.data) return null
  const invites = await client.rpc("my_project_invitations", { target_organization: organizationId })
  if (invites.error) throw new Error("Admin setup is unavailable. Apply the super-admin database migration.")
  const isAdmin = membership.data.role === "org_admin"
  if (!isAdmin) return { role: membership.data.role, isAdmin, members: [], departments: [], invitations: invites.data ?? [] }
  const [members, departments] = await Promise.all([
    client.from("organization_memberships").select("profile_id, role").eq("organization_id", organizationId),
    client.from("departments").select("id, name").eq("organization_id", organizationId).order("name"),
  ])
  if (members.error || departments.error) throw new Error("Organization details could not be loaded.")
  const ids = (members.data ?? []).map(m => m.profile_id)
  const profiles = ids.length ? await client.from("profiles").select("id, full_name, email").in("id", ids) : { data: [], error: null }
  if (profiles.error) throw new Error("Members could not be loaded.")
  return { role: membership.data.role, isAdmin, departments: departments.data ?? [], invitations: invites.data ?? [], members: (members.data ?? []).map(m => {
    const profile = profiles.data?.find(p => p.id === m.profile_id)
    return { id: m.profile_id, role: m.role, name: profile?.full_name || profile?.email || "Member", email: profile?.email ?? "" }
  }) }
}
export async function addOrganizationMember(organizationId: string, email: string): Promise<AdminResult> {
  try {
    const client = await adminClient(organizationId)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return { ok: false, message: "Enter a valid email." }
    const result = await client.rpc("admin_add_member", { target_organization: organizationId, member_email: email.trim() })
    if (result.error) return { ok: false, message: result.error.code === "22023" ? "No account found. Create the user first." : "Member could not be added." }
    return { ok: true, message: "Member added." }
  } catch (error) { return failure(error) }
}
export async function createOrganizationUser(organizationId: string, name: string, email: string, password: string): Promise<AdminResult> {
  try {
    const client = await adminClient(organizationId)
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || password.length < 12) return { ok: false, message: "Enter a name, valid email, and a password of at least 12 characters." }
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    const { url } = readSupabasePublicEnv()
    if (!key || !url) return { ok: false, message: "User creation requires SUPABASE_SERVICE_ROLE_KEY in the server environment." }
    // Privileged Auth is used only after verifying the caller through their session.
    const authAdmin = createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    const created = await authAdmin.auth.admin.createUser({ email: email.trim(), password, email_confirm: true, user_metadata: { full_name: name.trim() } })
    if (created.error || !created.data.user) return { ok: false, message: "User could not be created. Check whether this email already has an account or the password meets Auth requirements." }
    const added = await client.from("organization_memberships").insert({ organization_id: organizationId, profile_id: created.data.user.id, role: "member" })
    if (added.error) {
      // Keep the newly created account: deleting it could race with a successful login.
      return { ok: false, message: "Account created, but organization membership failed. Use Add existing member with this email to finish setup." }
    }
    return { ok: true, message: "User created. They can sign in with their email and the password you provided." }
  } catch (error) { return failure(error) }
}
export async function setOrganizationRole(organizationId: string, profileId: string, role: string): Promise<AdminResult> {
  try {
    const client = await adminClient(organizationId)
    if (role !== "org_admin" && role !== "admin" && role !== "team_lead" && role !== "member" && role !== "viewer") return { ok: false, message: "Choose a valid role." }
    const result = await client.from("organization_memberships").update({ role }).eq("organization_id", organizationId).eq("profile_id", profileId).select("profile_id")
    if (result.error || result.data?.length !== 1) return { ok: false, message: "Role could not be changed. The organization must retain a Super admin." }
    return { ok: true, message: "Role updated." }
  } catch (error) { return failure(error) }
}
export async function createDepartment(organizationId: string, name: string): Promise<AdminResult> {
  try {
    const client = await adminClient(organizationId)
    const slug = projectSlugFromName(name.trim())
    if (!name.trim() || !slug) return { ok: false, message: "Enter a department name containing a letter or number." }
    const result = await client.from("departments").insert({ organization_id: organizationId, name: name.trim(), slug })
    return result.error ? { ok: false, message: "Department could not be created. Check for an existing department with this name." } : { ok: true, message: "Department created." }
  } catch (error) { return failure(error) }
}
export async function addDepartmentMember(organizationId: string, departmentId: string, profileId: string): Promise<AdminResult> {
  try {
    const client = await adminClient(organizationId)
    const result = await client.from("department_memberships").upsert({ organization_id: organizationId, department_id: departmentId, profile_id: profileId, role: "member" }, { onConflict: "department_id,profile_id", ignoreDuplicates: true })
    return result.error ? { ok: false, message: "Department member could not be added." } : { ok: true, message: "Department member added." }
  } catch (error) { return failure(error) }
}
export async function respondToProjectInvitation(organizationId: string, invitationId: string, accept: boolean): Promise<AdminResult> {
  try {
    const client = await createClient()
    const { data } = await client.auth.getUser()
    if (!data.user) return { ok: false, message: "Sign in to continue." }
    const invitation = await client.from("project_invitations").select("id").eq("organization_id", organizationId).eq("id", invitationId).eq("profile_id", data.user.id).maybeSingle()
    if (invitation.error || !invitation.data) return { ok: false, message: "Invitation unavailable." }
    const result = accept ? await client.rpc("accept_project_invitation", { invitation_id: invitationId }) : await client.from("project_invitations").delete().eq("id", invitationId).eq("profile_id", data.user.id)
    return result.error ? { ok: false, message: "Invitation could not be updated." } : { ok: true, message: accept ? "Invitation accepted. The project is available in Projects." : "Invitation declined." }
  } catch (error) { return failure(error) }
}

export async function getAdminProjectMembers(organizationId: string, projectId: string) {
  try {
    const client = await adminClient(organizationId)
    const [project, members, invitations, tasks] = await Promise.all([
      client.from("projects").select("owner_id, archived_at").eq("organization_id", organizationId).eq("id", projectId).maybeSingle(),
      client.from("project_members").select("profile_id, role, history_access, can_update_assigned_status, can_edit, can_manage_members, can_approve_deliverables, can_manage_assets").eq("organization_id", organizationId).eq("project_id", projectId),
      client.from("project_invitations").select("id, profile_id, history_access, can_update_assigned_status, task_ids").eq("organization_id", organizationId).eq("project_id", projectId),
      client.from("tasks").select("id, title, assignee_id").eq("organization_id", organizationId).eq("project_id", projectId).is("archived_at", null).order("title").limit(1000),
    ])
    if (project.error || !project.data || members.error || invitations.error || tasks.error) return null
    const snapshot = await getAdminSnapshot(organizationId)
    if (!snapshot?.isAdmin) return null
    return { ownerId: project.data.owner_id, archived: Boolean(project.data.archived_at), members: members.data ?? [], invitations: invitations.data ?? [], people: snapshot.members, tasks: tasks.data ?? [] }
  } catch { return null }
}
export async function saveProjectMember(organizationId: string, projectId: string, profileId: string, permissions: { edit: boolean; manageMembers: boolean; approve: boolean; manageAssets: boolean }, operation: "save" | "remove" | "invite" | "cancel", historyAccess: ProjectHistoryAccess = "assigned_only", taskOptions?: { taskIds: string[]; canUpdateStatus: boolean }): Promise<AdminResult> {
  try {
    const client = await adminClient(organizationId)
    if (historyAccess !== "full_history" && historyAccess !== "assigned_only") return { ok: false, message: "Choose a valid history visibility option." }
    if (taskOptions && (!Array.isArray(taskOptions.taskIds) || taskOptions.taskIds.length > 100 || taskOptions.taskIds.some(id => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) || typeof taskOptions.canUpdateStatus !== "boolean")) return { ok: false, message: "Choose up to 100 valid tasks." }
    if (taskOptions && historyAccess !== "assigned_only" && (taskOptions.taskIds.length || taskOptions.canUpdateStatus)) return { ok: false, message: "Task options require Assigned tasks only." }
    const project = await client.from("projects").select("owner_id, archived_at").eq("organization_id", organizationId).eq("id", projectId).maybeSingle()
    if (project.error || !project.data || project.data.archived_at) return { ok: false, message: "Choose an active project in this organization." }
    const member = await client.from("organization_memberships").select("role").eq("organization_id", organizationId).eq("profile_id", profileId).maybeSingle()
    if (member.error || !member.data) return { ok: false, message: "Choose a member of this organization." }
    if (project.data.owner_id === profileId) return { ok: false, message: "Change the project owner before changing their membership." }
    if (operation === "invite") {
      const existing = await client.from("project_members").select("profile_id").eq("organization_id", organizationId).eq("project_id", projectId).eq("profile_id", profileId).maybeSingle()
      if (existing.error) return { ok: false, message: "Project membership could not be checked." }
      if (existing.data) return { ok: false, message: "This member already has project access. Use Save member access to change their permissions." }
      const result = taskOptions ? await client.rpc("admin_invite_project_tasks", { target_organization: organizationId, target_project: projectId, target_profile: profileId, target_history_access: historyAccess, selected_tasks: taskOptions.taskIds, allow_status_update: taskOptions.canUpdateStatus }) : await client.rpc("admin_invite_project_member", { target_organization: organizationId, target_project: projectId, target_profile: profileId, target_history_access: historyAccess })
      if (result.error) return { ok: false, message: "Invitation could not be sent. Check that tasks are active and unassigned or assigned to this person, and that the person does not already have project access." }
      return { ok: true, message: "Project invitation sent in the app." }
    }
    if (operation === "cancel") {
      const result = await client.from("project_invitations").delete().eq("organization_id", organizationId).eq("project_id", projectId).eq("profile_id", profileId)
      return result.error ? { ok: false, message: "Invitation could not be cancelled." } : { ok: true, message: "Invitation cancelled." }
    }
    if (operation === "remove") {
      const result = await client.from("project_members").delete().eq("organization_id", organizationId).eq("project_id", projectId).eq("profile_id", profileId)
      return result.error ? { ok: false, message: "Membership could not be removed." } : { ok: true, message: "Project membership removed. Super admins retain organization access." }
    }
    if (operation !== "save") return { ok: false, message: "Invalid operation." }
    const existing = await client.from("project_members").select("profile_id")
      .eq("organization_id", organizationId).eq("project_id", projectId).eq("profile_id", profileId).maybeSingle()
    if (existing.error) return { ok: false, message: "Project membership could not be checked." }
    const values = {
      ...(taskOptions ? { can_update_assigned_status: historyAccess === "assigned_only" && taskOptions.canUpdateStatus && member.data.role !== "viewer" } : {}),
      history_access: historyAccess,
      role: member.data.role === "viewer" ? "viewer" as const : "project_member" as const,
      can_edit: permissions.edit === true, can_manage_members: permissions.manageMembers === true,
      can_approve_deliverables: permissions.approve === true, can_manage_assets: permissions.manageAssets === true,
    }
    // Column grants intentionally forbid changing tenant and membership identity fields.
    if (existing.data) {
      const result = await client.from("project_members").update(values)
        .eq("organization_id", organizationId).eq("project_id", projectId).eq("profile_id", profileId).select("profile_id")
      return result.error || result.data?.length !== 1 ? { ok: false, message: "Project access could not be saved." } : { ok: true, message: "Project access saved." }
    }
    const result = await client.from("project_members").insert({ ...values, organization_id: organizationId, project_id: projectId, profile_id: profileId })
    return result.error ? { ok: false, message: "Project access could not be saved." } : { ok: true, message: "Project access saved." }
  } catch (error) { return failure(error) }
}


