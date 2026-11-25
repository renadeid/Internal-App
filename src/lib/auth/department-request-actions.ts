"use server"

import { createClient } from "@/lib/supabase/server"
import { validateDepartmentRequest, type DepartmentRequestDraft, type RequestLibrary } from "@/lib/department-requests"
import { getTaskCreationAccess } from "./task-creation-actions"

const uuid=(value:string)=>typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const failure=(error:unknown)=>({ok:false as const,message:error instanceof Error?error.message:"Requests could not be loaded."})
async function context(org:string){
 if(!uuid(org)) throw Error("Select an organization.")
 const client=await createClient(),user=await client.auth.getUser()
 if(user.error||!user.data.user)throw Error("Sign in again to continue.")
 return client
}
export async function getDepartmentRequests(org:string){
 try {const client=await context(org),result=await client.rpc("department_request_library",{target_organization:org})
  if(result.error||!result.data)throw Error("Department requests could not be loaded. Retry or ask your administrator to check the database update.")
  return {ok:true as const,library:result.data as unknown as RequestLibrary}
 }catch(error){return failure(error)}
}
export async function sendDepartmentRequest(org:string,input:DepartmentRequestDraft){
 try {const values=validateDepartmentRequest(input),client=await context(org),result=await client.rpc("send_department_request",{target_organization:org,payload:values})
  if(result.error)throw Error(result.error.code==="42501"?"Your role cannot send requests.":"Request could not be sent. Check the department and try again.")
  return {ok:true as const}
 }catch(error){return failure(error)}
}
export async function decideDepartmentRequest(org:string,id:string,decision:"accepted"|"declined"|"cancelled",feedback:string,projectId:string,assigneeId:string){
 try {if(!uuid(id)||!["accepted","declined","cancelled"].includes(decision)||typeof feedback!=="string"||feedback.length>2000)throw Error("Reopen this request and try again.")
  if(decision==="declined"&&!feedback.trim())throw Error("Explain why the request was declined.")
  if(decision==="accepted"&&(!uuid(projectId)||!uuid(assigneeId)))throw Error("Choose a project and an assignee.")
  const client=await context(org)
  // The RPC independently checks the actor, tenant, department and existing project access.
  const library=await client.rpc("department_request_library",{target_organization:org})
  if(library.error||!(library.data as unknown as RequestLibrary)?.requests.some(r=>r.id===id))throw Error("Request unavailable in this organization.")
  const result=await client.rpc("decide_department_request",{target_request:id,decision,feedback:feedback.trim(),target_project:decision==="accepted"?projectId:null,target_assignee:decision==="accepted"?assigneeId:null})
  if(result.error)throw Error(result.error.code==="22023"?result.error.message:"Request could not be updated. Refresh and check your department and project access.")
  return {ok:true as const,taskId:result.data}
 }catch(error){return failure(error)}
}
export async function getRequestProjects(org:string,departmentId:string){
 try {const client=await context(org),access=await client.rpc("department_request_library",{target_organization:org})
  if(access.error||!(access.data as unknown as RequestLibrary)?.departments.some(d=>d.id===departmentId&&d.canManage))throw Error("Department lead permission required.")
  const [projects,links]=await Promise.all([client.from("projects").select("id,name,lead_department_id").eq("organization_id",org).is("archived_at",null).order("name"),client.from("project_departments").select("project_id").eq("organization_id",org).eq("department_id",departmentId)])
  if(projects.error||links.error)throw Error("Projects could not be loaded.")
  const linked=new Set(links.data.map(l=>l.project_id))
  const eligible=projects.data.filter(p=>p.lead_department_id===departmentId||linked.has(p.id))
  const options=await Promise.all(eligible.map(async p=>{
   const permission=await getTaskCreationAccess(org,p.id)
   if(permission.status!=="ready"||!permission.canCreate)return null
   const [members,roles]=await Promise.all([
    client.from("project_members").select("profile_id,role,history_access,can_update_assigned_status").eq("organization_id",org).eq("project_id",p.id),
    client.from("organization_memberships").select("profile_id,role").eq("organization_id",org),
   ])
   if(members.error||roles.error)throw Error("Project assignees could not be loaded.")
   const writable=new Set(members.data.filter(m=>m.role!=="viewer"&&(m.history_access==="full_history"||m.can_update_assigned_status)&&roles.data.some(o=>o.profile_id===m.profile_id&&o.role!=="viewer")).map(m=>m.profile_id))
   return {id:p.id,name:p.name,assignees:permission.assignees.filter(a=>writable.has(a.id))}
  }))
  return {ok:true as const,projects:options.filter((p):p is NonNullable<typeof p>=>Boolean(p))}
 }catch(error){return failure(error)}
}

export async function setDepartmentRequestArchived(org:string,id:string,archived:boolean){
 try{if(!uuid(id)||typeof archived!=="boolean")throw Error("Reopen this request and try again.")
 const client=await context(org),result=await client.rpc("set_department_request_archived",{target_organization:org,target_request:id,archived})
 if(result.error)throw Error("Request could not be updated. Refresh and check your department permissions.")
 return {ok:true as const}
 }catch(error){return failure(error)}
}
