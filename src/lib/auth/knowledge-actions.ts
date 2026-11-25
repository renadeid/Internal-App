"use server"

import { createClient } from "@/lib/supabase/server"
import { getAccessibleOrganizations } from "./current-organizations"
import { validateArticle, type ArticleDraft, type KnowledgeArticle } from "@/lib/knowledge"

async function context(organizationId: string) {
 const access = await getAccessibleOrganizations()
 if (access.status !== "ready" || !access.organizations.some(org => org.id === organizationId)) throw Error("Workspace unavailable.")
 const client = await createClient()
 const { data, error } = await client.auth.getUser()
 if (error || !data.user) throw Error("Sign in to continue.")
 const membership = await client.from("organization_memberships").select("role").eq("organization_id",organizationId).eq("profile_id",data.user.id).maybeSingle()
 if (membership.error || !membership.data) throw Error("Workspace unavailable.")
 return { client, canManage: ["org_admin","team_lead"].includes(membership.data.role) }
}

export async function getKnowledgeLibrary(organizationId: string): Promise<{ ok: true; articles: KnowledgeArticle[]; departments: {id:string;name:string}[]; canManage: boolean } | {ok:false;message:string}> {
 try {
  const { client, canManage } = await context(organizationId)
  const [articles,departments] = await Promise.all([
   client.from("knowledge_articles").select("id,title,summary,body,category,department_id,status,source_url,updated_by,updated_at").eq("organization_id",organizationId).order("updated_at",{ascending:false}),
   client.from("departments").select("id,name").eq("organization_id",organizationId).order("name"),
  ])
  if (articles.error || departments.error) throw Error("Company knowledge could not be loaded.")
  const ids = [...new Set(articles.data.flatMap(article => article.updated_by ? [article.updated_by] : []))]
  const profiles = ids.length ? await client.from("profiles").select("id,full_name").in("id",ids) : { data: [], error: null }
  if (profiles.error) throw Error("Article authors could not be loaded.")
  return { ok:true,canManage,departments:departments.data,articles:articles.data.map(article => ({id:article.id,title:article.title,summary:article.summary,body:article.body,category:article.category,departmentId:article.department_id,departmentName:departments.data.find(d=>d.id===article.department_id)?.name??null,status:article.status,sourceUrl:article.source_url,authorName:profiles.data?.find(p=>p.id===article.updated_by)?.full_name||"Workspace team",updatedAt:article.updated_at})) }
 } catch(error) { return {ok:false,message:error instanceof Error?error.message:"Knowledge could not be loaded."} }
}

export async function saveKnowledgeArticle(organizationId: string, input: ArticleDraft) {
 try {
  const {client,canManage} = await context(organizationId)
  if (!canManage) return {ok:false as const,message:"Team lead or Super admin permission is required."}
  const values = validateArticle(input)
  if (input.id) {
   if (typeof input.expectedUpdatedAt !== "string" || !input.expectedUpdatedAt) throw Error("Reopen the article before editing.")
   const result = await client.from("knowledge_articles").update(values).eq("organization_id",organizationId).eq("id",input.id).eq("updated_at",input.expectedUpdatedAt).select("id")
   if (result.error) throw Error("Article could not be saved. Check the department and try again.")
   if (result.data.length!==1) throw Error("This article changed or is no longer available. Reopen it to load the latest version.")
  } else {
   const result = await client.from("knowledge_articles").insert({...values,organization_id:organizationId}).select("id")
   if (result.error || result.data.length!==1) throw Error("Article could not be created. Check the department and try again.")
  }
  return {ok:true as const,message:input.status==="published"?"Article published.":input.status==="archived"?"Article archived.":"Draft saved."}
 } catch(error) { return {ok:false as const,message:error instanceof Error?error.message:"Article could not be saved."} }
}
