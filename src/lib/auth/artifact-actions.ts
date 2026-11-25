"use server"
import {createClient} from "@/lib/supabase/server"
import {getAccessibleOrganizations} from "./current-organizations"
import {validateArtifactFile,type ArtifactDocument} from "@/lib/artifact-documents"

async function context(organizationId:string){
 const access=await getAccessibleOrganizations()
 if(access.status!=="ready"||!access.organizations.some(org=>org.id===organizationId))throw Error("Workspace unavailable.")
 const client=await createClient();const {data,error}=await client.auth.getUser()
 if(error||!data.user)throw Error("Sign in to continue.")
 const membership=await client.from("organization_memberships").select("role").eq("organization_id",organizationId).eq("profile_id",data.user.id).maybeSingle()
 if(membership.error||!membership.data)throw Error("Workspace unavailable.")
 return {client,canUpload:["org_admin","team_lead","member"].includes(membership.data.role)}
}
export async function getArtifactDocuments(organizationId:string):Promise<{ok:true;documents:ArtifactDocument[];canUpload:boolean}|{ok:false;message:string}>{
 try{const {client,canUpload}=await context(organizationId);const rows=await client.from("artifact_documents").select("id,title,file_name,created_at,created_by").eq("organization_id",organizationId).order("created_at",{ascending:false})
 if(rows.error)throw Error("Team artifacts could not be loaded.")
 const ids=[...new Set(rows.data.flatMap(row=>row.created_by?[row.created_by]:[]))]
 const profiles=ids.length?await client.from("profiles").select("id,full_name").in("id",ids):{data:[],error:null}
 if(profiles.error)throw Error("Artifact authors could not be loaded.")
 return {ok:true,canUpload,documents:rows.data.map(row=>({id:row.id,title:row.title,fileName:row.file_name,createdAt:row.created_at,authorName:profiles.data?.find(p=>p.id===row.created_by)?.full_name||"Workspace team"}))}
 }catch(error){return {ok:false,message:error instanceof Error?error.message:"Artifacts could not be loaded."}}
}
export async function getArtifactDocument(organizationId:string,id:string){
 try{const {client}=await context(organizationId);const row=await client.from("artifact_documents").select("id,title,file_name,content,created_at").eq("organization_id",organizationId).eq("id",id).maybeSingle()
 if(row.error||!row.data)throw Error("This artifact is not available in your workspace.")
 return {ok:true as const,document:{id:row.data.id,title:row.data.title,fileName:row.data.file_name,content:row.data.content,createdAt:row.data.created_at,authorName:"Workspace team"} satisfies ArtifactDocument}
 }catch(error){return {ok:false as const,message:error instanceof Error?error.message:"Artifact could not be loaded."}}
}
export async function importArtifactDocument(organizationId:string,fileName:string,content:string,title:string){
 try{const {client,canUpload}=await context(organizationId);if(!canUpload)throw Error("You do not have permission to import artifacts.")
 const values=validateArtifactFile(fileName,content,title)
 const result=await client.from("artifact_documents").insert({...values,organization_id:organizationId}).select("id").single()
 if(result.error?.code==="23505")throw Error("A file with this name already exists in this workspace. Rename it before importing.")
 if(result.error||!result.data)throw Error("Artifact could not be saved.")
 return {ok:true as const,id:result.data.id}
 }catch(error){return {ok:false as const,message:error instanceof Error?error.message:"Import failed."}}
}
