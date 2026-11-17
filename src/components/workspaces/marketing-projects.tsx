"use client"

import { ProjectCard } from "@/components/dashboard/project-card"
import { useWorkspace } from "@/components/workspace/workspace-provider"
import { collaboratingDepartments } from "@/lib/project-records"

export function MarketingProjects() {
  const { projects } = useWorkspace()
  const visible = projects.filter((project) =>
    collaboratingDepartments(project).includes("Marketing")
  )

  if (visible.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        Marketing is not on a project yet.
      </p>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visible.map((project) => (
        <ProjectCard key={project.id} project={project} preview />
      ))}
    </div>
  )
}
