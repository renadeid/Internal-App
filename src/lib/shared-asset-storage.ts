import "server-only"
import {createHmac,timingSafeEqual} from "node:crypto"
import {createClient} from "@supabase/supabase-js"
import sharp from "sharp"
import {readSupabasePublicEnv} from "@/lib/supabase/public-env"
import {sharedAssetMaxBytes,sharedFileKind,type SharedAssetDraft} from "@/lib/shared-assets"
export const sharedAssetBucket="shared-assets"
export type AssetUploadTicket={organizationId:string;actorId:string;assetId:string;versionId:string;fileName:string;size:number;mime:string;type:string;expires:number;draft:SharedAssetDraft}
export function sharedAssetAdmin(){const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw Error("File storage is not configured.");return createClient(readSupabasePublicEnv().url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
function ticketSignature(value:string){const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw Error("File storage is not configured.");return createHmac("sha256",key).update("shared-asset-upload:"+value).digest("base64url")}
export function signAssetUpload(ticket:AssetUploadTicket){const body=Buffer.from(JSON.stringify(ticket)).toString("base64url");return body+"."+ticketSignature(body)}
export function readAssetUpload(ticket:string):AssetUploadTicket {
 if(typeof ticket!=="string"||ticket.length>16000)throw Error("Invalid upload.")
 const [body,signature,...extra]=ticket.split(".");if(!body||!signature||extra.length)throw Error("Invalid upload.")
 const expected=Buffer.from(ticketSignature(body));const actual=Buffer.from(signature);if(expected.length!==actual.length||!timingSafeEqual(expected,actual))throw Error("Invalid upload.")
 const value=JSON.parse(Buffer.from(body,"base64url").toString()) as AssetUploadTicket
 if(!Number.isFinite(value.expires)||value.expires<Date.now())throw Error("Upload expired. Choose your file again.")
 return value
}
export function sharedStoragePath(org:string,asset:string,version:string,number=1){const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;if(![org,asset,version].every(v=>uuid.test(v))||!Number.isInteger(number)||number<1)throw Error("Invalid file path.");return `${org}/${asset}/v${number}/${version}`}
export async function validateSharedFile(bytes:Buffer,fileName:string){
 if(!bytes.length||bytes.length>sharedAssetMaxBytes)throw Error("Choose a file up to 20 MB.")
 const kind=sharedFileKind(fileName);if(!kind)throw Error("Unsupported file type.")
 const ext=fileName.toLowerCase().split(".").pop()
 if(kind.type==="image"){const info=await sharp(bytes,{limitInputPixels:25_000_000,failOn:"warning"}).metadata();if(!info.format||!({jpg:["jpeg"],jpeg:["jpeg"],png:["png"],webp:["webp"]} as Record<string,string[]>)[ext!]?.includes(info.format))throw Error("Invalid image.");await sharp(bytes,{limitInputPixels:25_000_000,failOn:"warning"}).resize(8,8).toBuffer()}
 else if(ext==="pdf"&&bytes.subarray(0,5).toString()!=="%PDF-")throw Error("Invalid PDF.")
 else if(["zip","docx","xlsx","pptx"].includes(ext!)&&!(bytes[0]===0x50&&bytes[1]===0x4b&&[0x03,0x05,0x07].includes(bytes[2])))throw Error("Invalid archive or Office file.")
 else if(ext==="mp4"&&bytes.subarray(4,8).toString()!=="ftyp")throw Error("Invalid MP4.")
 else if(["txt","csv"].includes(ext!)){new TextDecoder("utf-8",{fatal:true}).decode(bytes);if(bytes.includes(0))throw Error("Invalid text file.")}
 return kind
}
export type SharedFileDescriptor={organizationId:string;assetId:string;versionId:string;number:number;bucket:string;path:string;fileName:string;mime:string;size:number}
export async function signedSharedFile(file:SharedFileDescriptor,preview:boolean){
 if(file.bucket!==sharedAssetBucket||file.path!==sharedStoragePath(file.organizationId,file.assetId,file.versionId,file.number))throw Error("File unavailable.")
 const admin=sharedAssetAdmin();const bucket=await admin.storage.getBucket(sharedAssetBucket);if(bucket.error||bucket.data.public)throw Error("File unavailable.")
 const inline=preview&&["image/jpeg","image/png","image/webp","application/pdf","video/mp4"].includes(file.mime)
 const result=await admin.storage.from(sharedAssetBucket).createSignedUrl(file.path,60,inline?{}:{download:file.fileName.replace(/[\r\n/\\]/g,"_").slice(0,200)})
 if(result.error)throw Error("File unavailable.");return result.data.signedUrl
}
