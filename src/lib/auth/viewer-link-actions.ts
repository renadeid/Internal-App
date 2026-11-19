"use server"

import { randomBytes } from "node:crypto"
import { createClient } from "@/lib/supabase/server"

export async function createViewerLink(input: { organizationId: string; resourceId: string; kind: "project" | "asset"; asset?: { title: string; description: string; url: string; type: string } }) {
  const client = await createClient()
  const { data: identity } = await client.auth.getUser()
  if (!identity.user) return { error: "Sign in first." }
  if (!input.resourceId || input.resourceId.length > 200 || !["project", "asset"].includes(input.kind)) return { error: "Invalid resource." }
  if (input.kind === "asset" && (!input.asset?.title.trim() || JSON.stringify(input.asset).length > 20000)) return { error: "Invalid asset." }
  const token = randomBytes(32).toString("hex")
  const result = await client.rpc("create_viewer_link", { target_organization: input.organizationId, target_resource: input.resourceId, resource_kind: input.kind, link_token: token, ...(input.asset ? { asset_snapshot: input.asset } : {}) })
  if (result.error) return { error: result.error.code === "42501" ? "Only Super admin can create public links." : "Could not create link. Check that the sharing SQL migration is applied." }
  return { path: `/share/${token}` }
}

export async function manageViewerLinks(organizationId: string, resourceId: string, kind: string, revokeId?: string) {
  const client = await createClient()
  const result = await client.rpc("manage_viewer_links", { target_organization: organizationId, target_resource: resourceId, resource_kind: kind, ...(revokeId ? { revoke_id: revokeId } : {}) })
  return result.error ? { error: "Could not manage public links." } : { links: result.data }
}
