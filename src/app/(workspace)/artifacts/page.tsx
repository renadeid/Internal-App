import type { Metadata } from "next"
import { ArtifactLibrary } from "@/components/artifacts/artifact-library"

export const metadata: Metadata = { title: "Artifact hub" }
export default function ArtifactsPage() {
  return <ArtifactLibrary />
}
