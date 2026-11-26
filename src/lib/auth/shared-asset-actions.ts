"use server"
import {createHash,randomUUID} from "node:crypto"
import {createClient} from "@/lib/supabase/server"
import {getAccessibleOrganizations} from "@/lib/auth/current-organizations"
import {sharedAssetMaxBytes,sharedFileKind,validateSharedDraft,type SharedAsset,type SharedAssetAccess,type SharedAssetDraft,type AssetFolder} from "@/lib/shared-assets"
import {readAssetUpload,signAssetUpload,sharedAssetAdmin,sharedAssetBucket,sharedStoragePath,validateSharedFile,type AssetUploadTicket} from "@/lib/shared-asset-storage"

async function context(organizationId:string){
 const access=await getAccessibleOrganizations();if(access.status!=="ready"||!access.organizations.some(org=>org.id===organizationId))throw Error("Workspace unavailable.")
 const client=await createClient();const {data,error}=await client.auth.getUser();if(error||!data.user)throw Error("Sign in to continue.")
 return {client,actorId:data.user.id}
}
export async function getSharedAssets(organizationId:string):Promise<{ok:true;assets:SharedAsset[];access:SharedAssetAccess;folders:AssetFolder[];departments:{id:string;name:string}[];projects:{id:string;name:string}[]}|{ok:false;message:string}>{
 try{
  const {client}=await context(organizationId)
  const [rows,access,folders,departments,memberships,projects,projectDepartments]=await Promise.all([
   client.rpc("list_shared_assets",{target_organization:organizationId}),
   client.rpc("shared_asset_upload_access",{target_organization:organizationId}),
   client.from("asset_folders").select("id,name,visibility,project_id").eq("organization_id",organizationId).order("name"),
   client.from("departments").select("id,name").eq("organization_id",organizationId).order("name"),
   client.from("department_memberships").select("profile_id,department_id").eq("organization_id",organizationId),
   client.from("projects").select("id,name,lead_department_id").eq("organization_id",organizationId).order("name"),
   client.from("project_departments").select("project_id,department_id").eq("organization_id",organizationId),
  ])
  if(rows.error||access.error||!Array.isArray(rows.data)||!access.data)throw Error("Shared files are not available. The shared-files database update may still need to be applied.")
  if(folders.error)throw Error("Folders are not available. Apply the asset-folders database update.")
  if(departments.error||memberships.error)throw Error("Asset departments could not be loaded.")
  if(projects.error||projectDepartments.error)throw Error("Asset projects could not be loaded.")
  const ownerDepartments=new Map<string,string[]>()
  for(const membership of memberships.data){const ids=ownerDepartments.get(membership.profile_id)??[];ids.push(membership.department_id);ownerDepartments.set(membership.profile_id,ids)}
  const departmentsByProject=new Map<string,Set<string>>()
  for(const project of projects.data){departmentsByProject.set(project.id,new Set(project.lead_department_id?[project.lead_department_id]:[]))}
  for(const link of projectDepartments.data){const ids=departmentsByProject.get(link.project_id)??new Set<string>();ids.add(link.department_id);departmentsByProject.set(link.project_id,ids)}
  const assets=(rows.data as SharedAsset[]).map(asset=>({...asset,departmentIds:[...new Set([
   ...(ownerDepartments.get(asset.ownerId)??[]),
   ...(asset.projects??[]).flatMap(project=>[...(departmentsByProject.get(project.id)??[])]),
  ])]}))
  return {ok:true,assets,access:access.data as SharedAssetAccess,folders:folders.data,departments:departments.data,projects:projects.data}
 }
 catch(error){return {ok:false,message:error instanceof Error?error.message:"Files could not be loaded."}}
}
export async function prepareSharedAsset(organizationId:string,draftInput:SharedAssetDraft,file:{name:string;size:number;sha256?:string}){
 try{
  const draft=validateSharedDraft(draftInput);const {client,actorId}=await context(organizationId)
  const access=await client.rpc("shared_asset_upload_access",{target_organization:organizationId});const permissions=access.data as SharedAssetAccess|null
  if(access.error||!permissions?.canUpload||(draft.projectId&&!permissions.projects.some(p=>p.id===draft.projectId)))throw Error("You do not have permission to upload here.")
  if(file?.size===0)throw Error("This file is empty. Choose a file with content.")
  if(file?.size>sharedAssetMaxBytes)throw Error("This file exceeds the 20 MB limit. Choose a smaller file.")
  if(!file||typeof file.name!=="string"||!file.name.trim()||file.name.length>200||!Number.isInteger(file.size)||file.size<1||file.size>sharedAssetMaxBytes)throw Error("Choose a file up to 20 MB.")
  const kind=sharedFileKind(file.name);if(!kind)throw Error("Choose an image, PDF, Office file, ZIP, text, CSV or MP4.")
  if(draft.folderId){const folder=await client.from("asset_folders").select("visibility,project_id").eq("organization_id",organizationId).eq("id",draft.folderId).single();if(folder.error||!folder.data)throw Error("Folder unavailable.");if(draft.visibility!==folder.data.visibility||(folder.data.project_id&&draft.projectId!==folder.data.project_id))throw Error("Upload access must match the folder.")}
  const ticket:AssetUploadTicket={organizationId,actorId,assetId:randomUUID(),versionId:randomUUID(),fileName:file.name.replace(/[\r\n/\\]/g,"_"),size:file.size,mime:kind.mime,type:kind.type,expires:Date.now()+15*60*1000,draft}
  const path=sharedStoragePath(organizationId,ticket.assetId,ticket.versionId);const admin=sharedAssetAdmin()
  if(file.sha256&&!/^[0-9a-f]{64}$/.test(file.sha256))throw Error("Invalid file fingerprint.")
  const [duplicateName,duplicateFile]=await Promise.all([
   admin.rpc("shared_asset_name_exists",{target_organization:organizationId,proposed_name:draft.name}),
   file.sha256?admin.rpc("shared_asset_content_exists",{target_organization:organizationId,proposed_hash:file.sha256}):Promise.resolve({data:false,error:null})
  ])
  if(duplicateName.error||duplicateFile.error)throw Error("Could not check for duplicate assets. Try again.")
  if(duplicateName.data&&duplicateFile.data)throw Error("This file is already uploaded, and the asset name is also already in use. Choose a different file and a different name.")
  if(duplicateFile.data)throw Error("This file is already uploaded, even if its name is different.")
  if(duplicateName.data)throw Error("An asset with this name is already uploaded. Choose a different name.")
  const bucket=await admin.storage.getBucket(sharedAssetBucket);if(bucket.error||bucket.data.public)throw Error("Private file storage is not configured.")
  const upload=await admin.storage.from(sharedAssetBucket).createSignedUploadUrl(path,{upsert:false});if(upload.error)throw Error("Could not prepare upload.")
  return {ok:true as const,ticket:signAssetUpload(ticket),path,token:upload.data.token,mime:kind.mime}
 }catch(error){return {ok:false as const,message:error instanceof Error?error.message:"Upload could not be prepared."}}
}
export async function completeSharedAsset(signedTicket:string){
 try{
  const ticket=readAssetUpload(signedTicket);const {client,actorId}=await context(ticket.organizationId);if(actorId!==ticket.actorId)throw Error("Upload belongs to another account.")
  const access=await client.rpc("shared_asset_upload_access",{target_organization:ticket.organizationId});const permissions=access.data as SharedAssetAccess|null
  if(access.error||!permissions?.canUpload||(ticket.draft.projectId&&!permissions.projects.some(p=>p.id===ticket.draft.projectId)))throw Error("Upload permission changed. No file was published.")
  const path=sharedStoragePath(ticket.organizationId,ticket.assetId,ticket.versionId);const admin=sharedAssetAdmin()
  const info=await admin.storage.from(sharedAssetBucket).info(path)
  if(info.error||info.data.size!==ticket.size||info.data.size>sharedAssetMaxBytes||info.data.contentType?.split(";")[0].trim().toLowerCase()!==ticket.mime)throw Error("Uploaded file does not match its details.")
  const file=await admin.storage.from(sharedAssetBucket).download(path);if(file.error)throw Error("Uploaded file could not be verified.")
  const bytes=Buffer.from(await file.data.arrayBuffer());if(bytes.length!==ticket.size)throw Error("Invalid file size.")
  const kind=await validateSharedFile(bytes,ticket.fileName)
  const result=await admin.rpc("register_shared_asset",{actor:actorId,payload:{...validateSharedDraft(ticket.draft),organizationId:ticket.organizationId,assetId:ticket.assetId,versionId:ticket.versionId,fileName:ticket.fileName,mime:kind.mime,type:kind.type,size:bytes.length,contentHash:createHash("sha256").update(bytes).digest("hex")}})
  if(result.error?.code==="23505"&&result.error.message.includes("already uploaded"))throw Error(result.error.message.startsWith("This file")?"This file is already uploaded, even if its name is different.":"An asset with this name is already uploaded. Choose a different name.");if(result.error)throw Error("File registration failed. Check the shared-files database update and try again.")
  return {ok:true as const,assetId:ticket.assetId}
 }catch(error){return {ok:false as const,message:error instanceof Error?error.message:"The file could not be published."}}
}
export async function editSharedAsset(organizationId:string,assetId:string,details:{name:string;description:string;tags:string[];collection:string;visibility?:string;projectId?:string}){
 try{
  if(!details||typeof details.name!=="string"||!details.name.trim()||details.name.length>120||typeof details.description!=="string"||details.description.length>4000||typeof details.collection!=="string"||details.collection.length>80||!Array.isArray(details.tags)||details.tags.length>20||details.tags.some(t=>typeof t!=="string"||t.length>40))throw Error("Check the file details.")
  const {client}=await context(organizationId);const visible=await client.rpc("list_shared_assets",{target_organization:organizationId});if(visible.error||!(visible.data as SharedAsset[]|null)?.some(a=>a.id===assetId&&a.canEdit))throw Error("Edit permission is required.")
  const result=await client.rpc("edit_shared_asset",{target_asset:assetId,details});if(result.error?.code==="23505"&&result.error.message.includes("already uploaded"))throw Error("An asset with this name is already uploaded. Choose a different name.");if(result.error)throw Error("File details could not be saved.")
  return {ok:true as const,message:"File details saved."}
 }catch(error){return {ok:false as const,message:error instanceof Error?error.message:"File details could not be saved."}}
}
export async function deleteSharedAsset(organizationId:string,assetId:string,confirmationName:string){
 try{
  const {client}=await context(organizationId);const visible=await client.rpc("list_shared_assets",{target_organization:organizationId});if(visible.error||!(visible.data as SharedAsset[]|null)?.some(a=>a.id===assetId&&a.canDelete))throw Error("Super admin permission is required.")
  const result=await client.rpc("delete_shared_asset",{target_asset:assetId,confirmation_name:confirmationName});if(result.error)throw Error("File could not be deleted. Check the confirmation name.")
  const files=result.data as {bucket:string;path:string}[];const prefix=organizationId+"/"+assetId+"/"
  const paths=files.filter(f=>f.bucket===sharedAssetBucket&&f.path.startsWith(prefix)&&!f.path.includes("..")).map(f=>f.path)
  if(paths.length){try{const removed=await sharedAssetAdmin().storage.from(sharedAssetBucket).remove(paths);if(removed.error)return {ok:true as const,message:"Asset deleted. Stored file cleanup needs administrator attention."}}catch{return {ok:true as const,message:"Asset deleted. Stored file cleanup needs administrator attention."}}}
  return {ok:true as const,message:"Asset and stored file deleted."}
 }catch(error){return {ok:false as const,message:error instanceof Error?error.message:"File could not be deleted."}}
}

export async function createAssetFolder(organizationId:string,name:string,projectId:string|null){try{const {client}=await context(organizationId);const result=await client.rpc("create_asset_folder",{target_organization:organizationId,folder_name:name,folder_project:projectId});if(result.error)throw Error(result.error.code==="23505"?"A folder with this name already exists.":"Folder could not be created. Check your project file permissions.");return {ok:true as const,id:result.data}}catch(e){return {ok:false as const,message:e instanceof Error?e.message:"Folder could not be created."}}}
export async function moveAssetToFolder(organizationId:string,assetId:string,folderId:string|null){try{const {client}=await context(organizationId);const rows=await client.rpc("list_shared_assets",{target_organization:organizationId});if(rows.error||!(rows.data as SharedAsset[])?.some(a=>a.id===assetId&&a.canEdit))throw Error("Edit permission required.");const result=await client.rpc("move_asset_to_folder",{target_asset:assetId,target_folder:folderId});if(result.error)throw Error(result.error.code==="22023"?"Choose a folder with the same company or project access as this file.":"File could not be moved.");return {ok:true as const}}catch(e){return {ok:false as const,message:e instanceof Error?e.message:"File could not be moved."}}}
