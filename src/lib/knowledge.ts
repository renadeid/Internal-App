export const articleCategories = ["Getting started", "Company policies", "Department guides"] as const
export const libraryCategories = ["All knowledge", ...articleCategories, "App guides"] as const
export type ArticleDraft = { id?: string; title: string; summary: string; body: string; category: typeof articleCategories[number]; departmentId: string; status: "draft" | "published" | "archived"; sourceUrl: string; expectedUpdatedAt?: string }
export type KnowledgeArticle = { id: string; title: string; summary: string; body: string; category: string; departmentId: string | null; departmentName: string | null; status: string; sourceUrl: string | null; authorName: string; updatedAt: string | null; appGuide?: boolean; href?: string; linkLabel?: string }
export function validateArticle(input: ArticleDraft) {
 if (!input || typeof input.title !== "string" || !input.title.trim() || input.title.trim().length > 160 || typeof input.summary !== "string" || input.summary.length > 400 || typeof input.body !== "string" || !input.body.trim() || input.body.length > 30000 || !articleCategories.includes(input.category) || !["draft","published","archived"].includes(input.status) || typeof input.departmentId !== "string" || typeof input.sourceUrl !== "string") throw Error("Enter a title, summary and article content within the field limits.")
 if (input.category === "Department guides" && !/^[0-9a-f-]{36}$/i.test(input.departmentId)) throw Error("Choose a department for this guide.")
 const source = input.sourceUrl.trim()
 if (source) { let url: URL; try { url = new URL(source) } catch { throw Error("Enter a valid HTTPS resource link.") }; if (url.protocol !== "https:" || url.username || url.password || source.length > 2048) throw Error("Enter a valid HTTPS resource link.") }
 return { title: input.title.trim(), summary: input.summary.trim(), body: input.body.trim(), category: input.category, department_id: input.category === "Department guides" ? input.departmentId : null, status: input.status, source_url: source || null }
}
