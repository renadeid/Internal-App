"use server"
import {getAccessibleOrganizations} from "./current-organizations"
import {getOrganizationProjects} from "./get-organization-projects"
import {getOrganizationTasks} from "./get-organization-tasks"
import {getOrganizationCampaigns} from "./get-organization-campaigns"
import {getSharedAssets} from "./shared-asset-actions"
import {createClient} from "@/lib/supabase/server"
export async function getWorkspaceOverview(organizationId:string){
 try{
  const access=await getAccessibleOrganizations();if(access.status!=="ready"||!access.organizations.some(o=>o.id===organizationId))return {status:"error" as const}
  const client=await createClient();const {data,error}=await client.auth.getUser();if(error||!data.user)return {status:"error" as const}
  const [projects,tasks,campaigns,assets,activity,notifications,role]=await Promise.all([
   getOrganizationProjects(organizationId),getOrganizationTasks(organizationId,"everyone"),getOrganizationCampaigns(organizationId),getSharedAssets(organizationId),
   client.from("activity_events").select("id,summary,verb,actor_id,project_id,campaign_id,asset_id,task_id,created_at").eq("organization_id",organizationId).order("created_at",{ascending:false}).limit(100),
   client.from("notifications").select("id,title,read_at,created_at").eq("organization_id",organizationId).eq("recipient_id",data.user.id).order("created_at",{ascending:false}).limit(100),
   client.from("organization_memberships").select("role").eq("organization_id",organizationId).eq("profile_id",data.user.id).single()
  ])
  if(projects.status!=="ready"||tasks.status!=="ready"||campaigns.status!=="ready"||!assets.ok||activity.error||notifications.error||role.error)return {status:"error" as const}
  const actorIds=[...new Set(activity.data.flatMap(a=>a.actor_id?[a.actor_id]:[]))]
  const actors=actorIds.length?await client.from("profiles").select("id,full_name,email").in("id",actorIds):{data:[],error:null}
  const actorNames=new Map((actors.error?[]:actors.data??[]).map(p=>[p.id,(p.full_name||"").trim()||p.email.split("@")[0]]))
  const activityWithActors=activity.data.map(a=>({...a,actorName:a.actor_id?actorNames.get(a.actor_id)??null:null,isMine:a.actor_id===data.user.id}))
  return {status:"ready" as const,userId:data.user.id,role:role.data.role,projects:projects.projects.filter(p=>!p.archivedAt),tasks:tasks.tasks.filter(t=>!t.archivedAt),campaigns:campaigns.campaigns.filter(c=>!c.archivedAt),assets:assets.assets,activity:activityWithActors,notifications:notifications.data}
 }catch{return {status:"error" as const}}
}
export async function markWorkspaceNotificationsRead(organizationId:string){
 const access=await getAccessibleOrganizations();if(access.status!=="ready"||!access.organizations.some(o=>o.id===organizationId))return false
 const client=await createClient();const {data}=await client.auth.getUser();if(!data.user)return false
 const result=await client.from("notifications").update({read_at:new Date().toISOString()}).eq("organization_id",organizationId).eq("recipient_id",data.user.id).is("read_at",null);return !result.error
}
