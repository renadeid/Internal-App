"use server"
import {randomUUID} from "node:crypto"
import {createClient} from "@/lib/supabase/server"
import {sharedAssetAdmin,validateSharedFile} from "@/lib/shared-asset-storage"
import {sharedFileKind,sharedAssetMaxBytes} from "@/lib/shared-assets"
import {taskWorkDetails,reviewDetails,type TaskWorkPanel} from "@/lib/task-work"
import {readWorkTicket,signWorkTicket,taskWorkBucket,taskWorkPath} from "@/lib/task-work-storage"
const uuid=(value:string)=>typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
async function context(organizationId:string,taskId:string){
 if(!uuid(organizationId)||!uuid(taskId))throw Error("Task unavailable.")
 const client=await createClient();const {data}=await client.auth.getUser();if(!data.user)throw Error("Sign in again to continue.")
 const task=await client.from("tasks").select("id,organization_id").eq("id",taskId).eq("organization_id",organizationId).maybeSingle();if(task.error||!task.data)throw Error("Task unavailable.")
 const panel=await client.rpc("task_work_panel",{target_task:taskId});if(panel.error||!panel.data)throw Error("Task submissions are unavailable. Check the task-work database update.")
 return {client,actorId:data.user.id,panel:panel.data as unknown as TaskWorkPanel}
}
const failure=(error:unknown)=>({ok:false as const,message:error instanceof Error?error.message:"Task work could not be saved."})
export async function getTaskWork(organizationId:string,taskId:string){try{return {ok:true as const,panel:(await context(organizationId,taskId)).panel}}catch(error){return failure(error)}}
export async function submitTaskWork(organizationId:string,taskId:string,note:string,link:string){
 try{const ctx=await context(organizationId,taskId);if(!ctx.panel.canSubmit)throw Error("Only the assigned employee with work access can submit.");const details=taskWorkDetails(note,link);if(!details.note&&!details.link)throw Error("Add your work as a note, link or file.")
 const result=await sharedAssetAdmin().rpc("register_task_submission",{actor:ctx.actorId,payload:{id:randomUUID(),organizationId,taskId,...details}});if(result.error)throw Error(result.error.code==="22023"?"A submission is already awaiting review, or the task is complete.":"Submission could not be saved. Refresh and check your access.");return {ok:true as const}
 }catch(error){return failure(error)}
}
export async function prepareTaskWork(organizationId:string,taskId:string,note:string,link:string,file:{name:string;size:number}){
 try{const ctx=await context(organizationId,taskId);if(!ctx.panel.canSubmit||ctx.panel.submissions.some(s=>s.status==="pending"))throw Error("You cannot submit while work is awaiting review or the task is complete.")
 const details=taskWorkDetails(note,link);const kind=sharedFileKind(file?.name??"");if(!kind||file.name.length>200||!Number.isInteger(file.size)||file.size<1||file.size>sharedAssetMaxBytes)throw Error("Choose a supported file up to 20 MB.")
 const admin=sharedAssetAdmin();let bucket=await admin.storage.getBucket(taskWorkBucket);if(bucket.error){const created=await admin.storage.createBucket(taskWorkBucket,{public:false,fileSizeLimit:sharedAssetMaxBytes});if(created.error){bucket=await admin.storage.getBucket(taskWorkBucket);if(bucket.error)throw Error("Task file storage is unavailable.")}}else if(bucket.data.public)throw Error("Task file storage must be private.")
 const verifiedBucket=await admin.storage.getBucket(taskWorkBucket);if(verifiedBucket.error||verifiedBucket.data.public)throw Error("Task file storage must be private.");
 const id=randomUUID(),path=taskWorkPath(organizationId,taskId,id);const uploaded=await admin.storage.from(taskWorkBucket).createSignedUploadUrl(path,{upsert:false});if(uploaded.error)throw Error("Could not prepare the file upload.")
 return {ok:true as const,path,token:uploaded.data.token,mime:kind.mime,ticket:signWorkTicket({id,organizationId,taskId,actorId:ctx.actorId,...details,fileName:file.name,size:file.size,mime:kind.mime,expires:Date.now()+15*60*1000})}
 }catch(error){return failure(error)}
}
export async function completeTaskWork(token:string){
 try{const ticket=readWorkTicket(token);const ctx=await context(ticket.organizationId,ticket.taskId);if(ctx.actorId!==ticket.actorId)throw Error("Upload belongs to another account.");if(!ctx.panel.canSubmit)throw Error("Task submission permission has changed.")
 const admin=sharedAssetAdmin();const bucket=await admin.storage.getBucket(taskWorkBucket);if(bucket.error||bucket.data.public)throw Error("Task file storage is unavailable.")
 const downloaded=await admin.storage.from(taskWorkBucket).download(taskWorkPath(ticket.organizationId,ticket.taskId,ticket.id));if(downloaded.error||downloaded.data.size!==ticket.size)throw Error("Upload is incomplete. Select the file again.")
 const kind=await validateSharedFile(Buffer.from(await downloaded.data.arrayBuffer()),ticket.fileName);if(kind.mime!==ticket.mime)throw Error("File type did not match the upload.")
 const result=await admin.rpc("register_task_submission",{actor:ctx.actorId,payload:{id:ticket.id,organizationId:ticket.organizationId,taskId:ticket.taskId,note:ticket.note,link:ticket.link,fileName:ticket.fileName,mime:ticket.mime,size:ticket.size}});if(result.error)throw Error(result.error.code==="22023"?"A submission is already awaiting review, or the task is complete.":"Submission could not be saved. Refresh and check your access.");return {ok:true as const}
 }catch(error){return failure(error)}
}
export async function reviewTaskWork(organizationId:string,taskId:string,submissionId:string,decision:"approved"|"changes_requested",feedback:string){
 try{const ctx=await context(organizationId,taskId);if(!uuid(submissionId)||!ctx.panel.canReview||!ctx.panel.submissions.some(s=>s.id===submissionId&&s.status==="pending"))throw Error("This submission is unavailable for your review.")
 const note=reviewDetails(decision,feedback);const result=await ctx.client.rpc("review_task_submission",{target_submission:submissionId,decision,feedback:note});if(result.error)throw Error("Review could not be saved. Refresh to check whether it has already been reviewed.");return {ok:true as const}
 }catch(error){return failure(error)}
}
