"use server"
import {createClient} from "@/lib/supabase/server"
import {getAccessibleOrganizations} from "./current-organizations"
import type {WorkspaceNotification} from "@/lib/workspace-notifications"
async function context(org:string){
 const access=await getAccessibleOrganizations()
 if(access.status!=="ready"||!access.organizations.some(o=>o.id===org))throw Error("Organization unavailable.")
 const client=await createClient(),user=await client.auth.getUser()
 if(user.error||!user.data.user)throw Error("Sign in again to see notifications.")
 return {client,userId:user.data.user.id}
}
export async function getWorkspaceNotifications(org:string):Promise<{ok:true;rows:WorkspaceNotification[]}|{ok:false}>{
 try{const {client,userId}=await context(org),result=await client.from("notifications").select("id,title,read_at,created_at,department_request_id,task_id").eq("organization_id",org).eq("recipient_id",userId).order("created_at",{ascending:false}).limit(100)
 if(result.error)return {ok:false}
 return {ok:true,rows:result.data}
 }catch{return {ok:false}}
}
export async function markWorkspaceNotificationRead(org:string,id:string){
 try{if(!/^[0-9a-f-]{36}$/i.test(id))return false
 const {client,userId}=await context(org),result=await client.from("notifications").update({read_at:new Date().toISOString()}).eq("id",id).eq("organization_id",org).eq("recipient_id",userId).is("read_at",null)
 return !result.error
 }catch{return false}
}
