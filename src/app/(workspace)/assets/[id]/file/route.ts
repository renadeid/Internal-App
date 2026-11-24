import {createClient} from "@/lib/supabase/server"
import {signedSharedFile,type SharedFileDescriptor} from "@/lib/shared-asset-storage"
export async function GET(request:Request,context:{params:Promise<{id:string}>}){
 try{
  const {id}=await context.params;const url=new URL(request.url);const version=url.searchParams.get("version")
  const uuid=/^[0-9a-f-]{36}$/i;if(!uuid.test(id)||(version&&!uuid.test(version)))throw Error("Unavailable")
  const client=await createClient();const {data}=await client.auth.getUser();if(!data.user)return new Response("Sign in to download this file.",{status:401,headers:{"Cache-Control":"no-store"}})
  const file=await client.rpc("shared_asset_file",{target_asset:id,...(version?{target_version:version}:{})});if(file.error||!file.data)throw Error("Unavailable")
  const location=await signedSharedFile(file.data as SharedFileDescriptor,url.searchParams.get("preview")==="1")
  return new Response(null,{status:302,headers:{Location:location,"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow"}})
 }catch{return new Response("File unavailable.",{status:404,headers:{"Cache-Control":"no-store"}})}
}
