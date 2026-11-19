"use client"

import { useState } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Asset } from "@/lib/types"

export function AssetDownloadButton({ asset }: { asset: Pick<Asset, "name" | "url" | "type"> }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const url = fileUrl(asset.url)
  const available = Boolean(url) && asset.type !== "External Link"
  async function download() {
    if (!url || !available || pending) return
    setPending(true)
    setError(null)
    try {
      // Download from the user's browser, without forwarding app credentials
      // or turning the server into a proxy for arbitrary asset URLs.
      const response = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(60000) })
      if (!response.ok) throw new Error("unavailable")
      const blob = await response.blob()
      if (/text\/html|application\/xhtml\+xml/i.test(blob.type)) throw new Error("webpage")
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = objectUrl
      link.download = downloadName(asset.name, url, blob.type)
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
    } catch {
      setError("Direct download is unavailable. Open the source to sign in or download there.")
    } finally {
      setPending(false)
    }
  }
  const hint = asset.type === "External Link" ? "External links open on the source website." : !url ? "No file link has been added to this asset." : undefined
  return <div className="flex flex-col items-start gap-1">
    <Button type="button" size="sm" variant="outline" disabled={!available || pending} title={hint} aria-label={`Download ${asset.name}`} onClick={() => void download()}>
      <Download aria-hidden />{pending ? "Downloading…" : "Download"}
    </Button>
    {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    {error ? <p role="alert" className="max-w-xs text-xs text-destructive">{error}</p> : null}
    {url && (error || asset.type === "External Link") ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs underline">Open source</a> : null}
  </div>
}

function fileUrl(value?: string) {
  if (!value) return null
  try {
    const url = new URL(value)
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null
  } catch { return null }
}

function downloadName(name: string, url: string, mimeType: string) {
  const filename = new URL(url).pathname.split("/").pop() || ""
  const extensions: Record<string, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/svg+xml": ".svg", "image/gif": ".gif", "application/pdf": ".pdf", "video/mp4": ".mp4", "application/zip": ".zip", "text/plain": ".txt" }
  const extension = /\.[a-z0-9]{1,10}$/i.exec(filename)?.[0] ?? extensions[mimeType.split(";")[0]] ?? ""
  const safeName = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim().replace(/[. ]+$/, "") || "asset"
  return extension && !safeName.toLowerCase().endsWith(extension.toLowerCase()) ? `${safeName}${extension}` : safeName
}
