"use client"

import { FileSearch, FolderKanban, Images, ListTodo } from "lucide-react"

import { ActivityFeedItem } from "@/components/dashboard/activity-item"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { ProjectCard } from "@/components/dashboard/project-card"
import { QuickAccess } from "@/components/dashboard/quick-access"
import { SectionHeading } from "@/components/dashboard/section-heading"
import { TaskRow } from "@/components/dashboard/task-row"
import { useCurrentIdentity } from "@/components/auth/current-identity-provider"
import { CreatedBanner } from "@/components/shared/created-banner"
import { useWorkspace } from "@/components/workspace/workspace-provider"
import { currentUser } from "@/lib/mock-data/team"
import { isActiveProject } from "@/lib/presentation"

export function DashboardView() {
  const { projects, tasks, activity, campaigns, assets } = useWorkspace()
  const identity = useCurrentIdentity()
  const activeProjects = projects.filter((project) =>
    isActiveProject(project.status)
  )
  const myTasks = tasks.filter(
    (task) => task.assigneeId === currentUser.id && task.status !== "Done"
  )
  const reviews = tasks.filter((task) => task.status === "In review")
  const firstName = identity.name.split(/\s+/)[0] || identity.name

  return (
    <div className="flex flex-col gap-8">
      <CreatedBanner />
      <div className="max-w-2xl">
        <h1 className="roaya-page-title text-foreground">
          Welcome back, {firstName}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
          The counts and lists below are preview samples. Open Projects for
          records in the selected organization.
        </p>
      </div>

      <section aria-label="Workspace summary">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Preview projects"
            value={activeProjects.length}
            hint="Sample count, not the selected organization"
            href="/projects"
            icon={FolderKanban}
          />
          <KpiCard
            label="Preview tasks"
            value={myTasks.length}
            hint="Sample count, not saved tasks"
            href="/tasks"
            icon={ListTodo}
          />
          <KpiCard
            label="Preview reviews"
            value={reviews.length}
            hint="Sample count, not saved reviews"
            href="/tasks"
            icon={FileSearch}
            accent="violet"
          />
          <KpiCard
            label="Preview assets"
            value={assets.filter((asset) => !asset.archived).length}
            hint="Sample count, not saved assets"
            href="/assets"
            icon={Images}
          />
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <SectionHeading
            title="Preview tasks"
            meta="Sample list"
            href="/tasks"
            action="View all"
          />
          <div className="roaya-glass rounded-2xl border border-border bg-card px-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-5">
            {myTasks.length === 0 ? (
              <p className="py-8 text-sm text-muted-foreground">
                You have no open tasks.
              </p>
            ) : (
              <ul>
                {myTasks.slice(0, 4).map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    projects={projects}
                    campaigns={campaigns}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="lg:col-span-2">
          <SectionHeading
            title="Preview activity"
            meta="Sample list"
            href="/activity"
            action="View all"
          />
          <div className="roaya-glass rounded-2xl border border-border bg-card px-3 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <ul>
              {activity.slice(0, 5).map((item) => (
                <ActivityFeedItem key={item.id} item={item} />
              ))}
            </ul>
          </div>
        </section>
      </div>

      <section>
        <SectionHeading
          title="Preview projects"
          meta="Sample cards"
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {activeProjects.slice(0, 6).map((project) => (
            <ProjectCard key={project.id} project={project} preview />
          ))}
        </div>
      </section>

      <QuickAccess />
    </div>
  )
}
