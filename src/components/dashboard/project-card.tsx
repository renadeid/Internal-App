import Link from "next/link"

import { MemberAvatars } from "@/components/dashboard/member-avatars"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { departmentClass, projectStatusClass } from "@/lib/presentation"
import { collaboratingDepartments } from "@/lib/project-records"
import type { Project } from "@/lib/types"

export function ProjectCard({
  project,
  preview = false,
}: {
  project: Project
  preview?: boolean
}) {
  const progress = Math.max(0, Math.min(100, project.progress))
  const departments = collaboratingDepartments(project)

  const card = (
    <Card className="h-full shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          {preview ? <Badge variant="secondary">Preview</Badge> : null}
          {departments.map((department) => (
            <Badge
              key={department}
              variant="secondary"
              className={departmentClass[department]}
            >
              {department}
            </Badge>
          ))}
          <Badge variant="secondary" className={projectStatusClass[project.status]}>
            {project.status}
          </Badge>
        </div>
        <CardTitle>{project.name}</CardTitle>
        {project.description ? (
          <CardDescription className="line-clamp-2">
            {project.description}
          </CardDescription>
        ) : (
          <CardDescription>No description yet.</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span className="font-medium text-foreground tabular-nums">{progress}%</span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${project.name} progress`}
        >
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardContent>
      <CardFooter className="justify-between bg-transparent">
        <MemberAvatars ids={project.memberIds} />
        <p className="text-xs text-muted-foreground">{project.updatedLabel}</p>
      </CardFooter>
    </Card>
  )

  if (preview) {
    return <div className="block h-full rounded-xl">{card}</div>
  }

  return (
    <Link
      href={`/projects/${project.id}`}
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {card}
    </Link>
  )
}
