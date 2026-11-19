"use client"

import { useMemo, useState } from "react"

import { TaskRow } from "@/components/dashboard/task-row"
import { PageIntro } from "@/components/shared/page-intro"
import { useWorkspace } from "@/components/workspace/workspace-provider"
import { Button } from "@/components/ui/button"
import { currentUser } from "@/lib/mock-data/team"
import type { TaskStatus } from "@/lib/types"

type StatusFilter = "Open" | TaskStatus
type Scope = "mine" | "everyone"

const filters: StatusFilter[] = ["Open", "To do", "In progress", "In review", "Done"]

export function TasksView() {
  const { projects, tasks, campaigns } = useWorkspace()
  const [filter, setFilter] = useState<StatusFilter>("Open")
  const [scope, setScope] = useState<Scope>("mine")

  const visible = useMemo(() => {
    return tasks.filter((task) => {
      const inScope = scope === "everyone" || task.assigneeId === currentUser.id
      const inStatus =
        filter === "Open" ? task.status !== "Done" : task.status === filter
      return inScope && inStatus
    })
  }, [filter, scope, tasks])

  return (
    <div className="flex flex-col gap-8">
      <PageIntro
        title="My tasks"
        description="Work assigned across the launch, the brand system, and the stories in production. Switch to everyone when you need the full queue."
      />
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Whose tasks">
          <Button
            type="button"
            size="sm"
            variant={scope === "mine" ? "default" : "outline"}
            aria-pressed={scope === "mine"}
            className="rounded-full"
            onClick={() => setScope("mine")}
          >
            Assigned to me
          </Button>
          <Button
            type="button"
            size="sm"
            variant={scope === "everyone" ? "default" : "outline"}
            aria-pressed={scope === "everyone"}
            className="rounded-full"
            onClick={() => setScope("everyone")}
          >
            Everyone
          </Button>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {filters.map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={filter === item ? "default" : "outline"}
              aria-pressed={filter === item}
              className="rounded-full"
              onClick={() => setFilter(item)}
            >
              {item}
            </Button>
          ))}
        </div>
      </div>
      <div className="roaya-glass rounded-2xl border border-border bg-card px-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-5">
        {visible.length === 0 ? (
          <p className="py-10 text-sm text-muted-foreground">
            No tasks match this filter.
          </p>
        ) : (
          <ul>
            {visible.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                projects={projects}
                campaigns={campaigns}
                showAssignee={scope === "everyone"}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
