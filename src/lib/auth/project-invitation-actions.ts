"use server"
import { getAccessibleOrganizations } from "@/lib/auth/current-organizations"
import { createClient } from "@/lib/supabase/server"
import type { ProjectInvitationsResult } from "@/lib/auth/super-admin-types"

// No caller-supplied recipient or organization: derive both from the signed-in user.
export async function getMyProjectInvitations(): Promise<ProjectInvitationsResult> {
 try {
  const client = await createClient()
  const identity = await client.auth.getUser()
  if (identity.error || !identity.data.user) return { status: "error" }
  const access = await getAccessibleOrganizations()
  if (access.status !== "ready") return { status: "error" }
  const results = await Promise.all(access.organizations.map(async organization => {
   const result = await client.rpc("my_project_invitations", { target_organization: organization.id })
   if (result.error || !result.data) throw new Error("Invitations unavailable")
   const details = await client.rpc("my_project_task_invitations", { target_organization: organization.id })
   if (details.error) throw new Error("Invitation task options unavailable")
   return result.data.map(invitation => ({
    id: invitation.id, projectId: invitation.project_id, projectName: invitation.project_name,
    organizationId: organization.id, organizationName: organization.name, historyAccess: invitation.history_access,
    ...(details.data?.find(item => item.id === invitation.id) ? { canUpdateStatus: details.data.find(item => item.id === invitation.id)!.can_update_assigned_status, taskTitles: details.data.find(item => item.id === invitation.id)!.task_titles } : {}),
   }))
  }))
  return { status: "ready", invitations: results.flat() }
 } catch { return { status: "error" } }
}
