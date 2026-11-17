import { Suspense } from "react"
import type { Metadata } from "next"

import { ProjectRecord } from "@/components/projects/project-record"

type ProjectPageProps = {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = {
  title: "Project",
}

export default function ProjectPage({ params }: ProjectPageProps) {
  return (
    <Suspense fallback={null}>
      <ProjectRoute params={params} />
    </Suspense>
  )
}

async function ProjectRoute({ params }: ProjectPageProps) {
  const { id } = await params
  return <ProjectRecord projectId={id} />
}
