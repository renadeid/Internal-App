import {createClient} from "@supabase/supabase-js"
import {readSupabasePublicEnv} from "@/lib/supabase/public-env"
import {sharedAssetAdmin,signedSharedFile,sharedAssetBucket} from "@/lib/shared-asset-storage"
export async function GET(_request:Request,context:{params:Promise<{token:string}>}){
 try{
  const {token}=await context.params;if(!/^[a-f0-9]{64}$/.test(token))throw Error("Unavailable")
  const env=readSupabasePublicEnv();const reader=createClient(env.url,env.publishableKey,{auth:{persistSession:false,autoRefreshToken:false}})
  const result=await reader.rpc("read_viewer_link",{link_token:token});const shared=result.data as {kind:string;content:{sharedAssetId?:string;versionId?:string}}|null
  if(result.error||shared?.kind!=="asset"||!shared.content.sharedAssetId||!shared.content.versionId)throw Error("Unavailable")
  const version=await sharedAssetAdmin().from("asset_versions").select("id,asset_id,organization_id,number,label,mime_type,byte_size,storage_bucket,storage_path").eq("id",shared.content.versionId).eq("asset_id",shared.content.sharedAssetId).eq("storage_bucket",sharedAssetBucket).maybeSingle()
  if(version.error||!version.data)throw Error("Unavailable")
  const v=version.data;const location=await signedSharedFile({organizationId:v.organization_id,assetId:v.asset_id,versionId:v.id,number:v.number,bucket:v.storage_bucket,path:v.storage_path,fileName:v.label,mime:v.mime_type,size:Number(v.byte_size)},false)
  return new Response(null,{status:302,headers:{Location:location,"Cache-Control":"no-store, private","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow"}})
 }catch{return new Response("Link unavailable.",{status:404,headers:{"Cache-Control":"no-store"}})}
}
