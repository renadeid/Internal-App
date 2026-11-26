import { Suspense } from "react"
import type { Metadata } from "next"

import { AssetsLibrary } from "@/components/assets/assets-library"

export const metadata: Metadata = {
  title: "Assets Library",
}

export default function AssetsPage() {
  return (
    <Suspense fallback={<p role="status">Loading shared files…</p>}>
      <AssetsLibrary />
    </Suspense>
  )
}
