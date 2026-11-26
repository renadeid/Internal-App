"use client"

import { useMemo, useState, useSyncExternalStore } from "react"
import Link from "next/link"

import { useOrganization } from "@/components/auth/organization-provider"
import { PageIntro } from "@/components/shared/page-intro"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useProjectCreateLauncher } from "@/components/projects/project-create-launcher"
import { Plus } from "lucide-react"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getOrganizationProjects } from "@/lib/auth/get-organization-projects"
import { subscribeProjectListRefresh } from "@/lib/auth/project-list-refresh"
import type {
  OrganizationProject,
  OrganizationProjectsResult,
  ProjectStatusValue,
} from "@/lib/auth/organization-projects"
import { projectStatusClass } from "@/lib/presentation"
import type { ProjectStatus } from "@/lib/types"

type ProjectsSnapshot = {
  status: "loading" | OrganizationProjectsResult["status"]
  projects: OrganizationProject[]
}

export function ProjectsView() {
  const { activeOrganization, mode } = useOrganization()
  const projectCreation = useProjectCreateLauncher()
  const description = activeOrganization
    ? `Projects visible in ${activeOrganization.name}.`
    : mode === "multiple"
      ? "Select an organization in the sidebar to see its projects."
      : mode === "unavailable"
        ? "Organization is unavailable."
        : "No organization is available."

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageIntro title="Projects" description={description} />
        {projectCreation.canCreate ? (
          <Button type="button" className="gap-2" onClick={projectCreation.open}>
            <Plus className="size-4" aria-hidden />
            New project
          </Button>
        ) : null}
      </div>
      {activeOrganization ? (
        <ProjectList
          key={activeOrganization.id}
          organizationId={activeOrganization.id}
          organizationName={activeOrganization.name}
        />
      ) : null}
    </div>
  )
}

function ProjectList({
  organizationId,
  organizationName,
}: {
  organizationId: string
  organizationName: string
}) {
  const [showArchived, setShowArchived] = useState(false)
  const snapshot = useOrganizationProjects(organizationId)

  if (snapshot.status === "loading") {
    return <Status message={`Loading projects in ${organizationName}…`} />
  }
  if (snapshot.status === "error") {
    return <Status message="Projects could not be loaded." />
  }
  if (snapshot.status === "rejected") {
    return <Status message="This organization is not available for your account." />
  }
  if (snapshot.projects.length === 0) {
    return (
      <Status
        message={`No projects are visible in ${organizationName}. Private projects stay hidden.`}
      />
    )
  }

  const visible = showArchived
    ? snapshot.projects
    : snapshot.projects.filter((project) => !project.archivedAt)
  const archivedCount = snapshot.projects.filter((project) => project.archivedAt).length

  return (
    <div className="flex flex-col gap-4">
      {archivedCount > 0 ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant={showArchived ? "default" : "outline"}
            aria-pressed={showArchived}
            onClick={() => setShowArchived((current) => !current)}
          >
            {showArchived ? "Showing archived" : "Show archived"}
          </Button>
        </div>
      ) : null}
      {visible.length === 0 ? (
        <Status
          message={`No active projects are visible in ${organizationName}. Show archived projects to see them.`}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((project) => (
            <ProjectSummary key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectSummary({ project }: { project: OrganizationProject }) {
  const status = statusLabel(project.status)

  return (
    <Link
      href={`/projects/${project.id}`}
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="h-full shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-md">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            {project.leadDepartment ? (
              <Badge variant="secondary">{project.leadDepartment}</Badge>
            ) : null}
            <Badge variant="secondary" className={projectStatusClass[status]}>
              {status}
            </Badge>
            {project.archivedAt ? <Badge variant="secondary">Archived</Badge> : null}
          </div>
          <CardTitle>{project.name}</CardTitle>
          <CardDescription className="line-clamp-2">
            {project.description || "No description yet."}
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-between bg-transparent">
          <p className="text-xs text-muted-foreground">
            {project.ownerName ? project.ownerName : "Owner unavailable"}
          </p>
          <p className="text-xs text-muted-foreground">Updated {project.updatedOn}</p>
        </CardFooter>
      </Card>
    </Link>
  )
}

function Status({ message }: { message: string }) {
  return (
    <p
      className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground"
      aria-live="polite"
    >
      {message}
    </p>
  )
}

function statusLabel(status: ProjectStatusValue): ProjectStatus {
  if (status === "planning") return "Planning"
  if (status === "in_progress") return "In progress"
  if (status === "in_review") return "In review"
  return "On hold"
}

function useOrganizationProjects(organizationId: string) {
  const store = useMemo(
    () => createProjectsStore(organizationId),
    [organizationId]
  )
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  )
}

function createProjectsStore(organizationId: string) {
  const initial: ProjectsSnapshot = { status: "loading", projects: [] }
  let current = initial
  let generation = 0
  const listeners = new Set<() => void>()

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      const load = () => {
        const requestGeneration = ++generation
        void getOrganizationProjects(organizationId)
          .then((result) => {
            if (requestGeneration !== generation) return
            current = {
              status: result.status,
              projects: result.status === "ready" ? result.projects : [],
            }
            listeners.forEach((item) => item())
          })
          .catch(() => {
            if (requestGeneration !== generation) return
            current = { status: "error", projects: [] }
            listeners.forEach((item) => item())
          })
      }
      load()
      const stopRefresh = subscribeProjectListRefresh(load)
      return () => {
        listeners.delete(listener)
        generation += 1
        stopRefresh()
      }
    },
    getSnapshot() {
      return current
    },
    getServerSnapshot() {
      return initial
    },
  }
}
