"use client"
import { useRef, useState } from "react"
import { useOrganization } from "@/components/auth/organization-provider"
import { Button } from "@/components/ui/button"
import { createViewerLink, manageViewerLinks } from "@/lib/auth/viewer-link-actions"

export function PublicShare({ resourceId, kind, asset }: { resourceId: string; kind: "project" | "asset"; asset?: { title: string; description: string; url: string; type: string } }) {
  const { activeOrganization } = useOrganization()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<"create" | "revoke" | null>(null)
  const [loadingLinks, setLoadingLinks] = useState(false)
  const [copying, setCopying] = useState(false)
  const busy = useRef(false)
  const listGeneration = useRef(0)
  const [url, setUrl] = useState("")
  const [message, setMessage] = useState("")
  const [links, setLinks] = useState<{ id: string; expires_at: string }[]>([])
  if (activeOrganization?.role !== "org_admin") return null
  const organizationId = activeOrganization.id
  async function manage(revokeId?: string) {
    if (revokeId && busy.current) return
    if (revokeId) { busy.current = true; setPending("revoke") }
    const generation = ++listGeneration.current
    setLoadingLinks(true)
    try {
      const result = await manageViewerLinks(organizationId, resourceId, kind, revokeId)
      if (generation !== listGeneration.current) return
      if (result.error) setMessage(result.error)
      else { setLinks(result.links ?? []); if (revokeId) { setUrl(""); setMessage("Link revoked.") } }
    } catch { if (generation === listGeneration.current) setMessage("Could not load sharing settings.") }
    finally {
      if (generation === listGeneration.current) setLoadingLinks(false)
      if (revokeId) { busy.current = false; setPending(null) }
    }
  }
  async function create() {
    if (busy.current) return
    busy.current = true; setPending("create"); setMessage("")
    try {
      const result = await createViewerLink({ organizationId, resourceId, kind, asset })
      if (result.path) { setUrl(new URL(result.path, window.location.origin).href); setMessage("Link ready. Use Copy link below."); void manage() }
      else setMessage(result.error ?? "Could not create link.")
    } catch { setMessage("Could not create link.") }
    finally { busy.current = false; setPending(null) }
  }
  return <div className="my-4 rounded-lg border p-4">
    <Button type="button" variant="outline" onClick={() => { setOpen(!open); if (!open) void manage() }}>Share with external viewers</Button>
    {open ? <div className="mt-3 grid gap-3 text-sm">
      <p>Anyone with this link can view it without signing in. The link expires in 7 days. You can revoke it here.</p>
      <p>{kind === "project" ? "Shares a snapshot of the project name, description, status, due date and all current active tasks (titles, descriptions, statuses and due dates). Member identities, comments, campaigns and assets are excluded." : "Shares a snapshot of this asset's name, description, type and file URL. The source file's own access rules still apply."} Later changes require a new link.</p>
      {asset ? <div className="rounded bg-muted p-3"><strong>{asset.title}</strong><p className="whitespace-pre-wrap">{asset.description}</p><p className="break-all">{asset.url || "No file URL"}</p></div> : null}
      <div><Button type="button" disabled={pending !== null} onClick={() => void create()}>{pending === "create" ? "Creating link…" : "Create public view-only link"}</Button></div>
      {loadingLinks ? <p role="status" className="text-xs text-muted-foreground">Loading existing links… You can create a new link while this loads.</p> : null}
      {url ? <div className="grid gap-2"><label htmlFor={`share-url-${resourceId}`}>Public link</label><input id={`share-url-${resourceId}`} readOnly value={url} className="w-full rounded border p-2" onFocus={event => event.target.select()} /><Button type="button" variant="outline" disabled={copying} onClick={async () => { setCopying(true); try { await navigator.clipboard.writeText(url); setMessage("Link copied.") } catch { setMessage("Automatic copy is unavailable. Select and copy the link above.") } finally { setCopying(false) } }}>{copying ? "Copying…" : "Copy link"}</Button><p>For people outside this computer, the app needs a publicly reachable address; localhost links only work on this computer.</p></div> : null}
      {links.map(link => <div key={link.id} className="flex items-center justify-between gap-2"><span>Expires {new Date(link.expires_at).toLocaleDateString()}</span><Button type="button" variant="outline" disabled={pending !== null} onClick={() => void manage(link.id)}>{pending === "revoke" ? "Revoking…" : "Revoke link"}</Button></div>)}
      {message ? <p role="status">{message}</p> : null}
    </div> : null}
  </div>
}
