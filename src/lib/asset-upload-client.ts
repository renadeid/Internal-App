"use client"

import { prepareSharedAsset } from "@/lib/auth/shared-asset-actions"
import { createClient } from "@/lib/supabase/client"
import { readSupabasePublicEnv } from "@/lib/supabase/public-env"
import type { SharedAssetDraft } from "@/lib/shared-assets"

export const sharedAssetUploadBucket = "shared-assets"

export type PreparedAssetUpload = {
  path: string
  token: string
  ticket: string
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

const hashWorkerSource = `self.onmessage = async (event) => {
  try {
    const buffer = await event.data.arrayBuffer()
    const digest = await crypto.subtle.digest("SHA-256", buffer)
    self.postMessage({ ok: true, digest }, [digest])
  } catch (error) {
    self.postMessage({ ok: false, message: String(error) })
  }
}`

/**
 * SHA-256 of a file, computed in a Web Worker so reading a large video
 * never blocks the page. Falls back to the main thread if workers are unavailable.
 */
export async function hashFile(file: File): Promise<string> {
  if (typeof Worker !== "undefined" && typeof Blob !== "undefined") {
    let url = ""
    let worker: Worker | null = null
    try {
      url = URL.createObjectURL(new Blob([hashWorkerSource], { type: "text/javascript" }))
      worker = new Worker(url)
      const digest = await new Promise<ArrayBuffer>((resolve, reject) => {
        worker!.onmessage = (event: MessageEvent<{ ok: boolean; digest?: ArrayBuffer; message?: string }>) =>
          event.data.ok && event.data.digest ? resolve(event.data.digest) : reject(new Error(event.data.message))
        worker!.onerror = () => reject(new Error("Hash worker failed"))
        worker!.postMessage(file)
      })
      return toHex(digest)
    } catch {
      // fall through to the main-thread hash below
    } finally {
      worker?.terminate()
      if (url) URL.revokeObjectURL(url)
    }
  }
  return toHex(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))
}

/** Checks the file and asks the server for a signed upload slot. Fast; runs before the dialog closes so validation errors show in the dialog. */
export async function prepareAssetUpload(
  organizationId: string,
  draft: SharedAssetDraft,
  file: File
): Promise<PreparedAssetUpload> {
  const sha256 = await hashFile(file)
  const prepared = await prepareSharedAsset(organizationId, draft, { name: file.name, size: file.size, sha256 })
  if (!prepared.ok) throw new Error(prepared.message)
  return { path: prepared.path, token: prepared.token, ticket: prepared.ticket }
}

export class UploadCanceledError extends Error {
  constructor() {
    super("Upload canceled.")
  }
}

/**
 * Same request as supabase-js `uploadToSignedUrl`, sent with XMLHttpRequest
 * so the browser reports upload progress and the request can be canceled.
 */
export async function uploadToSignedUrlWithProgress(
  prepared: PreparedAssetUpload,
  file: File,
  onProgress: (loaded: number, total: number) => void,
  signal: AbortSignal
): Promise<void> {
  const { url, publishableKey } = readSupabasePublicEnv()
  const { data } = await createClient().auth.getSession()
  const cleanPath = prepared.path.replace(/^\/|\/$/g, "").replace(/\/+/g, "/")
  const target = new URL(`${url.replace(/\/$/, "")}/storage/v1/object/upload/sign/${sharedAssetUploadBucket}/${cleanPath}`)
  target.searchParams.set("token", prepared.token)

  const body = new FormData()
  body.append("cacheControl", "0")
  body.append("", file)

  await new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new UploadCanceledError())
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", target.toString())
    xhr.setRequestHeader("apikey", publishableKey)
    xhr.setRequestHeader("Authorization", `Bearer ${data.session?.access_token ?? publishableKey}`)
    xhr.setRequestHeader("x-upsert", "false")
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error("Upload failed. Check your connection and try again."))
    }
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."))
    xhr.onabort = () => reject(new UploadCanceledError())
    signal.addEventListener("abort", () => xhr.abort(), { once: true })
    xhr.send(body)
  })
}
