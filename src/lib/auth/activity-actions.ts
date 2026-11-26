"use server"
import { getAccessibleOrganizations } from "./current-organizations"
import { createClient } from "@/lib/supabase/server"

const PAGE_SIZE = 50

/** Older activity for the Activity page's "Load more", newest first, with who did each event. */
export async function getOlderActivity(organizationId: string, before: string) {
  try {
    if (!Number.isFinite(Date.parse(before))) return { ok: false as const }
    const access = await getAccessibleOrganizations()
    if (access.status !== "ready" || !access.organizations.some((o) => o.id === organizationId)) return { ok: false as const }
    const client = await createClient()
    const { data, error } = await client.auth.getUser()
    if (error || !data.user) return { ok: false as const }
    const rows = await client
      .from("activity_events")
      .select("id,summary,verb,actor_id,project_id,campaign_id,asset_id,task_id,created_at")
      .eq("organization_id", organizationId)
      .lt("created_at", before)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE)
    if (rows.error) return { ok: false as const }
    const actorIds = [...new Set(rows.data.flatMap((row) => (row.actor_id ? [row.actor_id] : [])))]
    const actors = actorIds.length ? await client.from("profiles").select("id,full_name,email").in("id", actorIds) : { data: [], error: null }
    const names = new Map((actors.error ? [] : (actors.data ?? [])).map((p) => [p.id, (p.full_name || "").trim() || p.email.split("@")[0]]))
    return {
      ok: true as const,
      hasMore: rows.data.length === PAGE_SIZE,
      activity: rows.data.map((row) => ({
        ...row,
        actorName: row.actor_id ? (names.get(row.actor_id) ?? null) : null,
        isMine: row.actor_id === data.user.id,
      })),
    }
  } catch {
    return { ok: false as const }
  }
}
