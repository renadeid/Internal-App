import { createClient } from "@supabase/supabase-js"
import { readSupabasePublicEnv } from "@/lib/supabase/public-env"
import type { Database } from "@/lib/supabase/database"
import { viewerHtml } from "@/lib/viewer-html"

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  let content: unknown = null
  if (/^[a-f0-9]{64}$/.test(token)) {
    const { url, publishableKey } = readSupabasePublicEnv()
    const client = createClient<Database>(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const result = await client.rpc("read_viewer_link", { link_token: token })
    if (!result.error) {
      content = result.data
      const shared = content as {kind?:string;content?:{sharedAssetId?:string;versionId?:string;url?:string}} | null
      if(shared?.kind === "asset" && shared.content?.sharedAssetId && shared.content.versionId) shared.content.url = new URL(`/share/${token}/file`, _request.url).href
    }
  }
  return new Response(viewerHtml(content), { status: content ? 200 : 404, headers: {
    "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow, noarchive", "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  } })
}
