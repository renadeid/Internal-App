"use client"

import { useMemo, useState } from "react"

import { TaskRow } from "@/components/dashboard/task-row"
import { EmptyNote } from "@/components/projects/empty-note"
import { useWorkspace } from "@/components/workspace/workspace-provider"
import { Button } from "@/components/ui/button"
import { tasksForProject } from "@/lib/project-records"
import type { Priority, TaskStatus } from "@/lib/types"

const statuses: Array<"All" | TaskStatus> = [
  "All",
  "To do",
  "In progress",
  "In review",
  "Done",
]

const priorities: Array<"All" | Priority> = [
  "All",
  "Urgent",
  "High",
  "Medium",
  "Low",
]

export function ProjectTasks({ projectId }: { projectId: string }) {
  const { projects, tasks: allTasks, campaigns } = useWorkspace()
  const tasks = tasksForProject(allTasks, projectId)
  const [status, setStatus] = useState<(typeof statuses)[number]>("All")
  const [priority, setPriority] = useState<(typeof priorities)[number]>("All")

  const visible = useMemo(
    () =>
      tasks.filter((task) => {
        const statusMatch = status === "All" || task.status === status
        const priorityMatch = priority === "All" || task.priority === priority
        return statusMatch && priorityMatch
      }),
    [priority, status, tasks]
  )

  if (tasks.length === 0) {
    return <EmptyNote>No tasks are assigned to this project yet.</EmptyNote>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {statuses.map((item) => (
            <FilterButton
              key={item}
              pressed={status === item}
              onClick={() => setStatus(item)}
            >
              {item}
            </FilterButton>
          ))}
        </div>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Filter by priority"
        >
          {priorities.map((item) => (
            <FilterButton
              key={item}
              pressed={priority === item}
              onClick={() => setPriority(item)}
            >
              {item === "All" ? "Any priority" : item}
            </FilterButton>
          ))}
        </div>
      </div>
      {visible.length === 0 ? (
        <EmptyNote>No tasks match these filters.</EmptyNote>
      ) : (
        <ul className="roaya-glass rounded-2xl border border-border bg-card px-4">
          {visible.map((task) => (
              <TaskRow
              key={task.id}
              task={task}
              projects={projects}
              campaigns={campaigns}
              showAssignee
              showProject={false}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function FilterButton({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={pressed ? "default" : "outline"}
      aria-pressed={pressed}
      className="rounded-full"
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
