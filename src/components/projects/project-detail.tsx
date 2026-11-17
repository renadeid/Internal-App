"use client"

import { useState } from "react"

import { MemberAvatars } from "@/components/dashboard/member-avatars"
import { EditProjectDialog } from "@/components/projects/edit-project-dialog"
import { ProjectActivity } from "@/components/projects/project-activity"
import { ProjectCampaigns } from "@/components/projects/project-campaigns"
import { ProjectFiles } from "@/components/projects/project-files"
import { ProjectOverview } from "@/components/projects/project-overview"
import { ProjectTasks } from "@/components/projects/project-tasks"
import { ProjectTeam } from "@/components/projects/project-team"
import { useWorkspace } from "@/components/workspace/workspace-provider"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getMember } from "@/lib/mock-data/team"
import {
  departmentClass,
  projectStatusClass,
  surfaceClass,
} from "@/lib/presentation"
import { collaboratingDepartments } from "@/lib/project-records"
import Link from "next/link"

const tabs = [
  { value: "overview", label: "Overview" },
  { value: "campaigns", label: "Campaigns" },
  { value: "tasks", label: "Tasks" },
  { value: "files", label: "Files & Assets" },
  { value: "team", label: "Team" },
  { value: "activity", label: "Activity" },
] as const

type ProjectTab = (typeof tabs)[number]["value"]

export function ProjectDetail({ projectId }: { projectId: string }) {
  const { projects } = useWorkspace()
  const project = projects.find((item) => item.id === projectId)
  const [tab, setTab] = useState<ProjectTab>("overview")
  const [editing, setEditing] = useState(false)
  const [editSession, setEditSession] = useState(0)

  if (!project) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-start gap-3 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Project not found</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          This project is not in the workspace. Projects created in this tab
          disappear after a refresh.
        </p>
        <Link href="/projects" className={buttonVariants({ variant: "outline" })}>
          Back to projects
        </Link>
      </div>
    )
  }

  const owner = getMember(project.ownerId)
  const departments = collaboratingDepartments(project)
  const progress = Math.max(0, Math.min(100, project.progress))

  return (
    <div className="flex flex-col gap-6">
      <section className={`${surfaceClass} p-5 sm:p-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className={projectStatusClass[project.status]}>
                {project.status}
              </Badge>
              {departments.map((department) => (
                <Badge
                  key={department}
                  variant="secondary"
                  className={departmentClass[department]}
                >
                  {department}
                </Badge>
              ))}
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {project.name}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {project.description || "No description yet."}
            </p>
          </div>
          <Button
            type="button"
            className="shrink-0"
            onClick={() => {
              setEditSession((session) => session + 1)
              setEditing(true)
            }}
          >
            Edit project
          </Button>
        </div>
        <div className="mt-6 grid gap-6 border-t border-border pt-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span className="font-medium text-foreground tabular-nums">
                {progress}%
              </span>
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
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Start</dt>
                <dd className="mt-1 font-medium">{project.startLabel}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Deadline</dt>
                <dd className="mt-1 font-medium">{project.deadlineLabel}</dd>
              </div>
            </dl>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Owner</p>
              <p className="mt-1 text-sm font-medium">{owner.name}</p>
              <p className="text-xs text-muted-foreground">{owner.role}</p>
            </div>
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Team</p>
              <MemberAvatars ids={project.memberIds} />
            </div>
            <p className="text-xs text-muted-foreground">{project.updatedLabel}</p>
          </div>
        </div>
      </section>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (isProjectTab(value)) setTab(value)
        }}
      >
        <div className="overflow-x-auto">
          <TabsList
            variant="line"
            className="w-max justify-start group-data-horizontal/tabs:h-9"
          >
            {tabs.map((item) => (
              <TabsTrigger
                key={item.value}
                value={item.value}
                className="h-8 flex-none px-3"
              >
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="overview" className="pt-4">
          <ProjectOverview
            project={project}
            onShowFiles={() => setTab("files")}
          />
        </TabsContent>
        <TabsContent value="campaigns" className="pt-4">
          <ProjectCampaigns projectId={project.id} />
        </TabsContent>
        <TabsContent value="tasks" className="pt-4">
          <ProjectTasks projectId={project.id} />
        </TabsContent>
        <TabsContent value="files" className="pt-4">
          <ProjectFiles projectId={project.id} />
        </TabsContent>
        <TabsContent value="team" className="pt-4">
          <ProjectTeam project={project} />
        </TabsContent>
        <TabsContent value="activity" className="pt-4">
          <ProjectActivity projectId={project.id} />
        </TabsContent>
      </Tabs>

      <EditProjectDialog
        key={editSession}
        project={project}
        open={editing}
        onOpenChange={setEditing}
      />
    </div>
  )
}

function isProjectTab(value: unknown): value is ProjectTab {
  return tabs.some((item) => item.value === value)
}
