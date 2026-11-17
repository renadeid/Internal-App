"use client"

import { useState } from "react"
import {
  Clapperboard,
  FileText,
  Folder,
  ImageIcon,
  Link2,
  PenTool,
  Presentation,
  type LucideIcon,
} from "lucide-react"

import type { AssetType } from "@/lib/types"

const icons: Record<AssetType, LucideIcon> = {
  Image: ImageIcon,
  Video: Clapperboard,
  Document: FileText,
  Presentation: Presentation,
  Design: PenTool,
  "External Link": Link2,
  Other: Folder,
}

export function AssetMark({
  type,
  name,
  url,
}: {
  type: AssetType
  name: string
  url?: string
}) {
  const Icon = icons[type]
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const imageUrl = type === "Image" && url && /^https?:\/\//i.test(url) ? url : null
  const showImage = Boolean(imageUrl && failedUrl !== imageUrl)

  return (
    <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-lg bg-[#F8FAFC]">
      {showImage && imageUrl ? (
        <img
          key={imageUrl}
          src={imageUrl}
          alt={name}
          className="size-full object-cover"
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : (
        <span className="flex size-12 items-center justify-center rounded-xl bg-[#2563EB]/10 text-[#1D4ED8]">
          <Icon className="size-5" aria-hidden />
          <span className="sr-only">{name}</span>
        </span>
      )}
    </div>
  )
}
