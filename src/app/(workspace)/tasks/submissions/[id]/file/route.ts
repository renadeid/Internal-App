import {createClient} from "@/lib/supabase/server"
import {sharedAssetAdmin} from "@/lib/shared-asset-storage"
import {taskWorkBucket,taskWorkPath} from "@/lib/task-work-storage"
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
 try{const {id}=await context.params;if(!/^[0-9a-f-]{36}$/i.test(id))throw Error("Unavailable")
 const client=await createClient();const {data}=await client.auth.getUser();if(!data.user)return new Response("Sign in to download this file.",{status:401,headers:{"Cache-Control":"no-store"}})
 const result=await client.rpc("task_submission_file",{target_submission:id});if(result.error||!result.data)throw Error("Unavailable")
 const file=result.data as {organizationId:string;taskId:string;id:string;fileName:string};const admin=sharedAssetAdmin();const bucket=await admin.storage.getBucket(taskWorkBucket);if(bucket.error||bucket.data.public)throw Error("Unavailable")
 const signed=await admin.storage.from(taskWorkBucket).createSignedUrl(taskWorkPath(file.organizationId,file.taskId,file.id),60,{download:file.fileName.replace(/[\r\n/\\]/g,"_")});if(signed.error)throw Error("Unavailable")
 return new Response(null,{status:302,headers:{Location:signed.data.signedUrl,"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow"}})
 }catch{return new Response("File unavailable.",{status:404,headers:{"Cache-Control":"no-store"}})}
}
