"use server"

import { createClient as createAdminClient } from "@supabase/supabase-js"
import { getAccessibleOrganizations } from "./current-organizations"
import { getOrganizationPeople } from "./get-organization-people"
import { getOrganizationProjects } from "./get-organization-projects"
import { getOrganizationTasks } from "./get-organization-tasks"
import type { EmployeeProfileResult } from "./employee-profile"
import type { AdminResult } from "./super-admin-types"
import { createClient } from "@/lib/supabase/server"
import { readSupabasePublicEnv } from "@/lib/supabase/public-env"
import { employeePhotoAdmin, employeePhotoBucket, employeePhotoPath } from "@/lib/employee-photos"
import { normalizeEmployeePhoto } from "@/lib/normalize-employee-photo"

async function employeeContext(organizationId: string, profileId: string) {
  const access = await getAccessibleOrganizations()
  if (access.status !== "ready" || !access.organizations.some(org => org.id === organizationId)) return null
  const client = await createClient()
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) return null
  const [actor, target] = await Promise.all([
    client.from("organization_memberships").select("role").eq("organization_id", organizationId).eq("profile_id", data.user.id).maybeSingle(),
    client.from("organization_memberships").select("created_at, role").eq("organization_id", organizationId).eq("profile_id", profileId).maybeSingle(),
  ])
  if (actor.error || target.error || !actor.data || !target.data) return null
  return { client, actorId: data.user.id, canManage: actor.data.role === "org_admin", canViewWork: actor.data.role === "org_admin" || actor.data.role === "team_lead", targetRole: target.data.role, joinedAt: target.data.created_at }
}

export async function getEmployeeProfile(organizationId: string, profileId: string): Promise<EmployeeProfileResult> {
  try {
    const context = await employeeContext(organizationId, profileId)
    if (!context) return { status: "missing" }
    const { client } = context
    const [people, details, departments, memberships, projects, tasks, projectMembers] = await Promise.all([
      getOrganizationPeople(organizationId),
      client.from("profiles").select("job_title").eq("id", profileId).maybeSingle(),
      client.from("departments").select("id, name").eq("organization_id", organizationId).order("name"),
      client.from("department_memberships").select("department_id").eq("organization_id", organizationId).eq("profile_id", profileId),
      context.canViewWork ? getOrganizationProjects(organizationId) : Promise.resolve({ status: "ready" as const, projects: [] }),
      context.canViewWork ? getOrganizationTasks(organizationId, "everyone") : Promise.resolve({ status: "ready" as const, tasks: [] }),
      context.canViewWork ? client.from("project_members").select("project_id").eq("organization_id", organizationId).eq("profile_id", profileId) : Promise.resolve({ data: [], error: null }),
    ])
    if (people.status !== "ready" || details.error || departments.error || memberships.error) return { status: "error" }
    const person = people.people.find(person => person.profileId === profileId)
    if (!person) return { status: "missing" }
    const departmentIds = new Set(memberships.data.map(member => member.department_id))
    const projectIds = new Set((projectMembers.data ?? []).map(member => member.project_id))
    const assignedTasks = tasks.status === "ready" ? tasks.tasks.filter(task => task.assigneeId === profileId) : []
    assignedTasks.forEach(task => projectIds.add(task.projectId))
    return { status: "ready", profile: {
      person, jobTitle: details.data?.job_title ?? "", joinedAt: context.joinedAt,
      departments: departments.data.filter(department => departmentIds.has(department.id)),
      availableDepartments: context.canManage ? departments.data : [],
      transferRecipients: context.canManage ? people.people.filter(p=>p.profileId!==profileId&&p.role!=="viewer") : [],
      projects: projects.status === "ready" ? projects.projects.filter(project => !project.archivedAt && (projectIds.has(project.id) || project.ownerId === profileId)) : [],
      tasks: assignedTasks, workUnavailable: projects.status !== "ready" || tasks.status !== "ready" || Boolean(projectMembers.error),
      canManage: context.canManage,
      canViewWork: context.canViewWork,
      isSelf: context.actorId === profileId,
    } }
  } catch { return { status: "error" } }
}

export async function deleteEmployee(organizationId: string, profileId: string, confirmationEmail: string, recipientId?: string): Promise<AdminResult> {
  try {
    const context = await employeeContext(organizationId, profileId)
    if (!context?.canManage) return { ok: false, message: "Super admin permission is required." }
    if (context.actorId === profileId) return { ok: false, message: "You cannot delete your own account." }
    const person = await context.client.from("profiles").select("email").eq("id", profileId).maybeSingle()
    if (person.error || !person.data?.email || typeof confirmationEmail !== "string" || confirmationEmail.trim().toLowerCase() !== person.data.email.trim().toLowerCase()) return { ok: false, message: "Type the employee's email to confirm deletion." }
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!key) return { ok: false, message: "Employee deletion is not configured on the server." }
    const admin = createAdminClient(readSupabasePublicEnv().url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    const memberships = await admin.from("organization_memberships").select("organization_id").eq("profile_id", profileId)
    if (memberships.error || !memberships.data?.length) return { ok: false, message: "Employee membership could not be verified." }
    if (memberships.data.some(row => row.organization_id !== organizationId)) return { ok: false, message: "This account also belongs to another workspace and cannot be deleted here." }
    if (context.targetRole === "org_admin") {
      const admins = await admin.from("organization_memberships").select("profile_id").eq("organization_id", organizationId).eq("role", "org_admin")
      if (admins.error || !admins.data?.some(row => row.profile_id !== profileId)) return { ok: false, message: "The workspace must retain a Super admin." }
    }
    const recipient=recipientId||context.actorId
    if(recipient===profileId)return {ok:false,message:"Choose another employee to receive this work."}
    const transfer=await admin.rpc("transfer_departing_employee_work",{actor:context.actorId,target_organization:organizationId,departing_employee:profileId,recipient})
    if(transfer.error)return {ok:false,message:transfer.error.message.includes("full access")?"The selected employee needs full access to every affected project first. Choose yourself or grant project access before deleting.":transfer.error.message.includes("work history")?"This employee is referenced as an author in work history. Those records must be retained. No work was transferred and no account was deleted.":"Work could not be transferred. Check that the recipient is an active employee with the required access. No account was deleted."}
    // The Auth delete and its database cascades are atomic. FK/last-admin guards remain authoritative for races.
    const deleted = await admin.auth.admin.deleteUser(profileId, false)
    if (deleted.error) return { ok: false, message: "Work was transferred, but the account could not be deleted. Its work is now assigned to the selected recipient. No work records were removed." }
    try {
      const photo = await admin.storage.from(employeePhotoBucket).remove([employeePhotoPath(organizationId, profileId)])
      if (photo.error) return { ok: true, message: "Employee account deleted. The stored photo still needs administrator cleanup." }
    } catch { return { ok: true, message: "Employee account deleted. The stored photo still needs administrator cleanup." } }
    return { ok: true, message: "Employee account permanently deleted." }
  } catch { return { ok: false, message: "Employee deletion could not be completed." } }
}

export async function updateEmployeeDetails(organizationId: string, profileId: string, input: { name: string; jobTitle: string; avatarColor: string }): Promise<AdminResult> {
  try {
    const context = await employeeContext(organizationId, profileId)
    if (!context?.canManage) return { ok: false, message: "Super admin permission is required." }
    if (!input || typeof input.name !== "string" || typeof input.jobTitle !== "string" || typeof input.avatarColor !== "string" || !input.name.trim() || input.name.trim().length > 120 || input.jobTitle.trim().length > 120 || !/^#[0-9a-f]{6}$/i.test(input.avatarColor)) return { ok: false, message: "Enter a name and job title of up to 120 characters and a valid avatar colour." }
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!key) return { ok: false, message: "Employee editing is not configured on the server." }
    // Use privileged profile writes only after checking both tenant memberships and the caller's role.
    const admin = createAdminClient(readSupabasePublicEnv().url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    const name = input.name.trim()
    const initials = name.split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join("").toUpperCase()
    const result = await admin.from("profiles").update({ full_name: name, job_title: input.jobTitle.trim() || null, avatar_color: input.avatarColor, initials }).eq("id", profileId).select("id")
    return result.error || result.data?.length !== 1 ? { ok: false, message: "Employee details could not be saved." } : { ok: true, message: "Employee details saved." }
  } catch { return { ok: false, message: "Employee details could not be saved." } }
}

export async function uploadEmployeePhoto(organizationId: string, profileId: string, form: FormData): Promise<AdminResult> {
  try {
    const context = await employeeContext(organizationId, profileId)
    if (!context?.canManage) return { ok: false, message: "Super admin permission is required." }
    const path = employeePhotoPath(organizationId, profileId)
    const file = form.get("photo")
    if (!(file instanceof File)) return { ok: false, message: "Choose a photo first." }
    let bytes: Buffer
    try { bytes = await normalizeEmployeePhoto(file) }
    catch { return { ok: false, message: "Choose a valid, still JPG, PNG or WebP image up to 2 MB and 25 megapixels." } }
    const storage = employeePhotoAdmin().storage
    const bucket = await storage.getBucket(employeePhotoBucket)
    if (bucket.error || !bucket.data || bucket.data.public) return { ok: false, message: "Private photo storage is unavailable. Please contact your administrator." }
    const result = await storage.from(employeePhotoBucket).upload(path, bytes, { upsert: true, contentType: "image/webp", cacheControl: "0" })
    return result.error ? { ok: false, message: "Photo could not be uploaded. Try again." } : { ok: true, message: "Profile photo updated." }
  } catch { return { ok: false, message: "Photo could not be uploaded. Try again." } }
}
