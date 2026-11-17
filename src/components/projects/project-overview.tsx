"use client"

import { Check } from "lucide-react"
import Link from "next/link"

import { ActivityFeedItem } from "@/components/dashboard/activity-item"
import { useWorkspace } from "@/components/workspace/workspace-provider"
import { Button } from "@/components/ui/button"
import { getMember } from "@/lib/mock-data/team"
import { dueText } from "@/lib/mock-data/tasks"
import { surfaceClass } from "@/lib/presentation"
import {
  activityForProject,
  collaboratingDepartments,
  filesForProject,
  milestonesForProject,
  tasksForProject,
  type ProjectFile,
} from "@/lib/project-records"
import type { Project } from "@/lib/types"

export function ProjectOverview({
  project,
  onShowFiles,
}: {
  project: Project
  onShowFiles: () => void
}) {
  const { tasks: allTasks, activity: allActivity, assets } = useWorkspace()
  const departments = collaboratingDepartments(project)
  const milestones = milestonesForProject(project.id)
  const tasks = tasksForProject(allTasks, project.id)
  const approvals = tasks.filter((task) => task.status === "In review")
  const deadlines = [
    ...milestones
      .filter((milestone) => !milestone.complete)
      .map((milestone) => ({
        id: milestone.id,
        label: milestone.name,
        due: milestone.dueLabel,
        kind: "Milestone",
      })),
    ...tasks
      .filter((task) => task.status !== "Done")
      .map((task) => ({
        id: task.id,
        label: task.title,
        due: dueText(task.dueLabel),
        kind: "Task",
      })),
  ]
  const activity = activityForProject(allActivity, project.id).slice(0, 3)
  const files = filesForProject(assets, project.id).slice(0, 4)
  const progress = Math.max(0, Math.min(100, project.progress))

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={`${surfaceClass} p-5`}>
        <h2 className="text-base font-semibold tracking-tight">Summary</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {project.description || "No description yet."}
        </p>
        <p className="mt-3 text-sm leading-6 text-foreground">
          {collaborationSentence(departments)}
        </p>
      </section>
      <section className={`${surfaceClass} p-5`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">Progress</h2>
          <p className="text-sm font-medium tabular-nums">{progress}%</p>
        </div>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
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
        {milestones.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No milestones yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {milestones.map((milestone) => (
              <li key={milestone.id} className="flex items-start gap-2 text-sm">
                <span
                  className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border"
                  aria-hidden
                >
                  {milestone.complete ? <Check className="size-3" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-foreground">{milestone.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {milestone.complete ? "Complete" : milestone.dueLabel}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={`${surfaceClass} p-5`}>
        <h2 className="text-base font-semibold tracking-tight">
          Upcoming deadlines
        </h2>
        {deadlines.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No open deadlines.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {deadlines.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 py-2.5">
                <span>
                  <span className="block text-sm text-foreground">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.kind}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {item.due}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={`${surfaceClass} p-5`}>
        <h2 className="text-base font-semibold tracking-tight">
          Pending approvals
        </h2>
        {approvals.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No reviews are waiting.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {approvals.map((task) => {
              const assignee = getMember(task.assigneeId)
              return (
                <li key={task.id} className="py-2.5">
                  <p className="text-sm text-foreground">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {assignee.name} · {dueText(task.dueLabel)}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      <section className={`${surfaceClass} p-5`}>
        <h2 className="text-base font-semibold tracking-tight">Recent activity</h2>
        {activity.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing has been recorded for this project yet.
          </p>
        ) : (
          <ul className="mt-2">
            {activity.map((item) => (
              <ActivityFeedItem key={item.id} item={item} />
            ))}
          </ul>
        )}
      </section>
      <section className={`${surfaceClass} p-5`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">Project assets</h2>
          <Button type="button" variant="link" className="h-auto px-0" onClick={onShowFiles}>
            View files
          </Button>
        </div>
        {files.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No assets are linked yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {files.map((file) => (
              <QuickFile key={file.id} file={file} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function QuickFile({ file }: { file: ProjectFile }) {
  return (
    <li>
      {file.external ? (
        <a
          href={file.href}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="min-w-0 truncate text-foreground">{file.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{file.kind}</span>
        </a>
      ) : (
        <Link
          href={file.href}
          className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="min-w-0 truncate text-foreground">{file.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{file.kind}</span>
        </Link>
      )}
    </li>
  )
}

function collaborationSentence(departments: string[]) {
  if (departments.length <= 1) {
    return `${departments[0] ?? "The team"} is leading this project.`
  }
  const last = departments[departments.length - 1]
  const rest = departments.slice(0, -1).join(", ")
  return `${rest} and ${last} are collaborating on this project.`
}
