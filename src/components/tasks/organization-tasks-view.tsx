"use client"

import { useMemo, useRef, useState, useSyncExternalStore } from "react"

import { useOrganization } from "@/components/auth/organization-provider"
import { TaskRecord } from "@/components/projects/project-tasks-record"
import { PageIntro } from "@/components/shared/page-intro"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getOrganizationTasks } from "@/lib/auth/get-organization-tasks"
import { subscribeTaskListRefresh, refreshOrganizationTasks } from "@/lib/auth/task-list-refresh"
import { setOrganizationTaskStatus } from "@/lib/auth/task-creation-actions"
import {
  taskPriorityLabel,
  taskStatusLabel,
  taskStatusValues,
  type OrganizationTask,
  type OrganizationTasksResult,
  type TaskPriorityValue,
  type TaskScope,
  type TaskStatusValue,
} from "@/lib/auth/organization-tasks"

type StatusFilter = "all" | TaskStatusValue
type PriorityFilter = "all" | TaskPriorityValue

const statuses: StatusFilter[] = [
  "all",
  "todo",
  "in_progress",
  "in_review",
  "done",
]
const priorities: PriorityFilter[] = ["all", "low", "medium", "high", "urgent"]

type TasksSnapshot = {
  status: "loading" | OrganizationTasksResult["status"]
  tasks: OrganizationTask[]
}

export function OrganizationTasksView() {
  const { activeOrganization, mode } = useOrganization()
  const description = activeOrganization
    ? `Tasks you can read in ${activeOrganization.name}. Assigned to me uses your account.`
    : mode === "multiple"
      ? "Select an organization in the sidebar to see its tasks."
      : mode === "unavailable"
        ? "Organization is unavailable."
        : "No organization is available."

  return (
    <div className="flex flex-col gap-8">
      <PageIntro title="My tasks" description={description} />
      {activeOrganization ? (
        <OrganizationTaskList
          key={activeOrganization.id}
          organizationId={activeOrganization.id}
          organizationName={activeOrganization.name}
        />
      ) : null}
    </div>
  )
}

function OrganizationTaskList({
  organizationId,
  organizationName,
}: {
  organizationId: string
  organizationName: string
}) {
  const [scope, setScope] = useState<TaskScope>("mine")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [priority, setPriority] = useState<PriorityFilter>("all")
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{ taskId: string; message: string } | null>(
    null
  )
  const savingRef = useRef(false)
  const snapshot = useOrganizationTasks(organizationId, scope)
  const visible =
    snapshot.status === "ready"
      ? snapshot.tasks.filter((task) => {
          const statusMatch = status === "all" || task.status === status
          const priorityMatch = priority === "all" || task.priority === priority
          return statusMatch && priorityMatch
        })
      : []

  async function changeStatus(task: OrganizationTask, next: TaskStatusValue) {
    if (savingRef.current || next === task.status || !task.canWrite) return
    savingRef.current = true
    setPendingTaskId(task.id)
    setRowError(null)
    try {
      const result = await setOrganizationTaskStatus({
        organizationId,
        projectId: task.projectId,
        taskId: task.id,
        status: next,
      })
      if (result.status === "updated") {
        refreshOrganizationTasks()
        return
      }
      setRowError({ taskId: task.id, message: statusError(result) })
    } catch {
      setRowError({ taskId: task.id, message: "The status could not be saved." })
    } finally {
      savingRef.current = false
      setPendingTaskId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Whose tasks">
          <FilterButton pressed={scope === "mine"} onClick={() => setScope("mine")}>
            Assigned to me
          </FilterButton>
          <FilterButton
            pressed={scope === "everyone"}
            onClick={() => setScope("everyone")}
          >
            Everyone
          </FilterButton>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {statuses.map((item) => (
            <FilterButton
              key={item}
              pressed={status === item}
              onClick={() => setStatus(item)}
            >
              {item === "all" ? "All statuses" : taskStatusLabel(item)}
            </FilterButton>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by priority">
          {priorities.map((item) => (
            <FilterButton
              key={item}
              pressed={priority === item}
              onClick={() => setPriority(item)}
            >
              {item === "all" ? "Any priority" : taskPriorityLabel(item)}
            </FilterButton>
          ))}
        </div>
      </div>
      <div className="roaya-glass rounded-2xl border border-border bg-card px-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-5">
        {snapshot.status === "loading" ? (
          <p className="py-10 text-sm text-muted-foreground" aria-live="polite">
            Loading tasks in {organizationName}…
          </p>
        ) : null}
        {snapshot.status === "error" ? (
          <p className="py-10 text-sm text-muted-foreground" aria-live="polite">
            Tasks could not be loaded.
          </p>
        ) : null}
        {snapshot.status === "rejected" ? (
          <p className="py-10 text-sm text-muted-foreground" aria-live="polite">
            This organization is not available for your account.
          </p>
        ) : null}
        {snapshot.status === "unavailable" ? (
          <p className="py-10 text-sm text-muted-foreground" aria-live="polite">
            These tasks are not available.
          </p>
        ) : null}
        {snapshot.status === "ready" && snapshot.tasks.length === 0 ? (
          <p className="py-10 text-sm text-muted-foreground" aria-live="polite">
            {scope === "mine"
              ? `No active tasks are assigned to you in ${organizationName}.`
              : `No active tasks are visible in ${organizationName}.`}
          </p>
        ) : null}
        {snapshot.status === "ready" &&
        snapshot.tasks.length > 0 &&
        visible.length === 0 ? (
          <p className="py-10 text-sm text-muted-foreground" aria-live="polite">
            No tasks match these filters.
          </p>
        ) : null}
        {snapshot.status === "ready" && visible.length > 0 ? (
          <ul>
            {visible.map((task) => (
              <TaskRecord
                key={task.id}
                task={task}
                showProject
                statusControl={
                  task.canWrite ? (
                    <TaskStatusControl
                      task={task}
                      pending={pendingTaskId === task.id}
                      message={rowError?.taskId === task.id ? rowError.message : null}
                      onStatusChange={(next) => void changeStatus(task, next)}
                    />
                  ) : undefined
                }
              />
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}

function TaskStatusControl({
  task,
  pending,
  message,
  onStatusChange,
}: {
  task: OrganizationTask
  pending: boolean
  message: string | null
  onStatusChange: (status: TaskStatusValue) => void
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {pending ? (
          <span className="text-xs text-muted-foreground" aria-live="polite">
            Saving…
          </span>
        ) : null}
        <Select
          items={taskStatusValues.map((item) => ({
            value: item,
            label: taskStatusLabel(item),
          }))}
          value={task.status}
          onValueChange={(value) => {
            if (pending || !isListedStatus(value) || value === task.status) return
            onStatusChange(value)
          }}
        >
          <SelectTrigger
            className="h-8 w-[9.5rem]"
            disabled={pending}
            aria-label={`Status for ${task.title}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {taskStatusValues.map((item) => (
              <SelectItem key={item} value={item}>
                {taskStatusLabel(item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {message ? (
        <p className="max-w-48 text-right text-xs text-destructive" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  )
}

function statusError(
  result: Exclude<Awaited<ReturnType<typeof setOrganizationTaskStatus>>, { status: "updated" }>
) {
  if (result.status === "invalid") return result.message
  if (result.status === "denied") return "You do not have permission to change this status."
  if (result.status === "unavailable") return "This task is not available to update."
  if (result.status === "rejected") return "This organization is not available for your account."
  return "The status could not be saved."
}

function isListedStatus(value: string | null): value is TaskStatusValue {
  return taskStatusValues.some((status) => status === value)
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

function useOrganizationTasks(organizationId: string, scope: TaskScope) {
  const store = useMemo(
    () => createTasksStore(organizationId, scope),
    [organizationId, scope]
  )
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  )
}

function createTasksStore(organizationId: string, scope: TaskScope) {
  const initial: TasksSnapshot = { status: "loading", tasks: [] }
  let current = initial
  let generation = 0
  const listeners = new Set<() => void>()

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      const load = () => {
        const requestGeneration = ++generation
        void getOrganizationTasks(organizationId, scope)
          .then((result) => {
            if (requestGeneration !== generation) return
            current = {
              status: result.status,
              tasks: result.status === "ready" ? result.tasks : [],
            }
            listeners.forEach((item) => item())
          })
          .catch(() => {
            if (requestGeneration !== generation) return
            current = { status: "error", tasks: [] }
            listeners.forEach((item) => item())
          })
      }
      load()
      const stopRefresh = subscribeTaskListRefresh(load)
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
