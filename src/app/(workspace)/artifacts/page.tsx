import { Suspense } from "react"
import type { Metadata } from "next"
import { ArtifactLibrary } from "@/components/artifacts/artifact-library"

export const metadata: Metadata = { title: "Artifact hub" }
export default function ArtifactsPage() {
  return (
    <Suspense fallback={<p role="status">Loading artifacts…</p>}>
      <ArtifactLibrary />
    </Suspense>
  )
}
