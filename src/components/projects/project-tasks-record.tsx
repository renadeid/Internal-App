"use client"
import { AssignedTaskStatus } from "@/components/tasks/assigned-task-status"

import { useMemo, useState, useSyncExternalStore } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getOrganizationProjectTasks } from "@/lib/auth/get-organization-tasks"
import {
  taskPriorityLabel,
  taskPriorityValues,
  taskStatusLabel,
  taskStatusValues,
  type OrganizationTask,
  type OrganizationTasksResult,
  type TaskCreationAccess,
  type TaskPriorityValue,
  type TaskStatusValue,
} from "@/lib/auth/organization-tasks"
import { subscribeProjectListRefresh } from "@/lib/auth/project-list-refresh"
import {
  createOrganizationTask,
  getTaskCreationAccess,
  setOrganizationTaskArchived,
  updateOrganizationTask,
} from "@/lib/auth/task-creation-actions"
import { refreshOrganizationTasks, subscribeTaskListRefresh } from "@/lib/auth/task-list-refresh"
import { priorityClass, surfaceClass, taskStatusClass } from "@/lib/presentation"
import type { Priority, TaskStatus } from "@/lib/types"

type TasksSnapshot = {
  status: "loading" | OrganizationTasksResult["status"]
  tasks: OrganizationTask[]
}

type AccessSnapshot = { status: "loading" } | TaskCreationAccess

export function ProjectTasksRecord({
  organizationId,
  projectId,
}: {
  organizationId: string
  projectId: string
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<OrganizationTask | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [archiving, setArchiving] = useState<OrganizationTask | null>(null)
  const snapshot = useProjectTasks(organizationId, projectId)
  const access = useTaskCreationAccess(organizationId, projectId)
  const creatable = isCreatableAccess(access) ? access : null
  const editable = access.status === "ready" && "canEdit" in access && access.canEdit ? access : null
  const archivedCount =
    snapshot.status === "ready"
      ? snapshot.tasks.filter((task) => task.archivedAt).length
      : 0
  const visible =
    snapshot.status === "ready"
      ? showArchived
        ? snapshot.tasks
        : snapshot.tasks.filter((task) => !task.archivedAt)
      : []

  return (
    <section className={`${surfaceClass} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Tasks</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Active tasks saved for this project.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {archivedCount > 0 ? (
            <Button
              type="button"
              variant={showArchived ? "default" : "outline"}
              aria-pressed={showArchived}
              onClick={() => setShowArchived((current) => !current)}
            >
              {showArchived ? "Showing archived" : "Show archived"}
            </Button>
          ) : null}
          {creatable ? (
            <Button
              type="button"
              onClick={() => {
                setEditing(null)
                setCreateOpen(true)
              }}
            >
              Create task
            </Button>
          ) : null}
        </div>
      </div>
      {creatable ? (
        <TaskDraftDialog
          open={createOpen}
          task={null}
          organizationId={organizationId}
          projectId={projectId}
          assignees={creatable.assignees}
          onOpenChange={setCreateOpen}
          onSaved={() => refreshOrganizationTasks()}
        />
      ) : null}
      {editable && editing ? (
        <TaskDraftDialog
          key={editing.id}
          open
          task={editing}
          organizationId={organizationId}
          projectId={projectId}
          assignees={editable!.assignees}
          onOpenChange={(next) => {
            if (!next) setEditing(null)
          }}
          onSaved={() => {
            setEditing(null)
            refreshOrganizationTasks()
          }}
        />
      ) : null}
      {creatable && archiving ? (
        <ArchiveTaskDialog
          key={`${archiving.id}:${archiving.archivedAt ?? "active"}`}
          task={archiving}
          organizationId={organizationId}
          projectId={projectId}
          onOpenChange={(next) => {
            if (!next) setArchiving(null)
          }}
          onSaved={() => {
            setArchiving(null)
            if (editing?.id === archiving.id) setEditing(null)
            refreshOrganizationTasks()
          }}
        />
      ) : null}
      <div className="mt-4">
        {snapshot.status === "loading" ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Loading tasks…
          </p>
        ) : null}
        {snapshot.status === "error" ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Tasks could not be loaded.
          </p>
        ) : null}
        {snapshot.status === "rejected" ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            This organization is not available for your account.
          </p>
        ) : null}
        {snapshot.status === "unavailable" ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            This project is not available.
          </p>
        ) : null}
        {snapshot.status === "ready" && visible.length === 0 ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {archivedCount > 0 && !showArchived
              ? "No active tasks are visible for this project. Show archived tasks to see them."
              : "No active tasks are visible for this project."}
          </p>
        ) : null}
        {snapshot.status === "ready" && visible.length > 0 ? (
          <ul className="border-t border-border">
            {visible.map((task) => (
              <TaskRecord
                key={task.id}
                task={task}
                showProject={false}
                onEdit={
                  editable && task.canWrite && !task.archivedAt ? () => setEditing(task) : undefined
                }
                onArchive={
                  editable?.canArchive && !task.archivedAt ? () => setArchiving(task) : undefined
                }
                onRestore={
                  editable?.canArchive && task.archivedAt ? () => setArchiving(task) : undefined
                }
              />
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}

export function TaskRecord({
  task,
  showProject,
  onEdit,
  onArchive,
  onRestore,
  statusControl,
}: {
  task: OrganizationTask
  showProject: boolean
  onEdit?: () => void
  onArchive?: () => void
  onRestore?: () => void
  statusControl?: React.ReactNode
}) {
  const status = taskStatusLabel(task.status) as TaskStatus
  const priority = taskPriorityLabel(task.priority) as Priority

  return (
    <li className="border-b border-border py-3.5 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-foreground">{task.title}</p>
        <div className="flex shrink-0 items-center gap-2">
          {onEdit ? (
            <Button type="button" size="sm" variant="outline" onClick={onEdit}>
              Edit
            </Button>
          ) : null}
          {onArchive ? (
            <Button type="button" size="sm" variant="outline" onClick={onArchive}>
              Archive
            </Button>
          ) : null}
          {onRestore ? (
            <Button type="button" size="sm" variant="outline" onClick={onRestore}>
              Restore
            </Button>
          ) : null}
          {task.archivedAt ? <Badge variant="secondary">Archived</Badge> : null}
          {statusControl ?? (task.canUpdateStatus && !task.canWrite ? <AssignedTaskStatus task={task} /> : (
            <Badge variant="secondary" className={taskStatusClass[status]}>
              {status}
            </Badge>
          ))}
        </div>
      </div>
      {showProject ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {task.projectName ?? "Project unavailable"}
        </p>
      ) : null}
      {task.description ? <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{task.description}</p> : null}
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className={priorityClass[priority]}>{priority} priority</span>
        <span className="text-muted-foreground">
          {task.dueOn ? `Due ${task.dueOn}` : "No due date"}
        </span>
        <span className="text-muted-foreground">
          {task.assigneeName ?? "Unassigned"}
        </span>
      </p>
    </li>
  )
}

function ArchiveTaskDialog({
  task,
  organizationId,
  projectId,
  onOpenChange,
  onSaved,
}: {
  task: OrganizationTask
  organizationId: string
  projectId: string
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const restoring = Boolean(task.archivedAt)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function handleOpenChange(next: boolean) {
    if (pending) return
    onOpenChange(next)
    if (!next) setMessage(null)
  }

  async function handleConfirm() {
    setPending(true)
    setMessage(null)
    try {
      const result = await setOrganizationTaskArchived({
        organizationId,
        projectId,
        taskId: task.id,
        archived: !restoring,
      })
      if (result.status === "updated") {
        onOpenChange(false)
        setPending(false)
        setMessage(null)
        onSaved()
        return
      }
      setMessage(archiveMessage(result, restoring))
      setPending(false)
    } catch {
      setMessage(restoring ? "The task could not be restored." : "The task could not be archived.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle>{restoring ? "Restore task" : "Archive task"}</DialogTitle>
          <DialogDescription>
            {restoring
              ? `Restore ${task.title}. It returns to the active task list.`
              : `Archive ${task.title}. It stays available from Show archived on this project and leaves My Tasks.`}
          </DialogDescription>
        </DialogHeader>
        {message ? (
          <p className="text-sm text-destructive" role="alert">
            {message}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={() => void handleConfirm()}>
            {pending ? "Saving…" : restoring ? "Restore" : "Archive"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function archiveMessage(
  result: Exclude<Awaited<ReturnType<typeof setOrganizationTaskArchived>>, { status: "updated" }>,
  restoring: boolean
) {
  if (result.status === "invalid") return result.message
  if (result.status === "denied") {
    return restoring
      ? "You do not have permission to restore this task."
      : "You do not have permission to archive this task."
  }
  if (result.status === "unavailable") {
    return restoring
      ? "This task is not available to restore."
      : "This task is not available to archive."
  }
  if (result.status === "rejected") {
    return "This organization is not available for your account."
  }
  return restoring ? "The task could not be restored." : "The task could not be archived."
}

function TaskDraftDialog({
  open,
  task,
  organizationId,
  projectId,
  assignees,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  task: OrganizationTask | null
  organizationId: string
  projectId: string
  assignees: { id: string; name: string }[]
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const editing = task !== null
  const fieldPrefix = editing ? `edit-task-${task.id}` : "create-task"
  const [title, setTitle] = useState(task?.title ?? "")
  const [description, setDescription] = useState(task?.description ?? "")
  const [priority, setPriority] = useState<TaskPriorityValue>(task?.priority ?? "medium")
  const [status, setStatus] = useState<TaskStatusValue>(task?.status ?? "todo")
  const [dueOn, setDueOn] = useState(task?.dueOn ?? "")
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? "unassigned")
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const assigneeItems = [
    { value: "unassigned", label: "Unassigned" },
    ...assignees.map((assignee) => ({ value: assignee.id, label: assignee.name })),
  ]

  function reset() {
    setTitle(task?.title ?? "")
    setDescription(task?.description ?? "")
    setPriority(task?.priority ?? "medium")
    setStatus(task?.status ?? "todo")
    setDueOn(task?.dueOn ?? "")
    setAssigneeId(task?.assigneeId ?? "unassigned")
    setMessage(null)
    setPending(false)
  }

  function handleOpenChange(next: boolean) {
    if (pending) return
    onOpenChange(next)
    if (!next) reset()
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const taskTitle = title.trim()
    if (!taskTitle) {
      setMessage("Enter a task title.")
      return
    }
    if (dueOn && !/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) {
      setMessage("Enter the due date as YYYY-MM-DD.")
      return
    }
    setPending(true)
    setMessage(null)
    try {
      const draft = {
        organizationId,
        projectId,
        title: taskTitle,
        description: description.trim(),
        priority,
        status,
        dueOn: dueOn || null,
        assigneeId: assigneeId === "unassigned" ? null : assigneeId,
      }
      const result = task
        ? await updateOrganizationTask({ ...draft, taskId: task.id })
        : await createOrganizationTask(draft)
      if (result.status === "created" || result.status === "updated") {
        onOpenChange(false)
        reset()
        onSaved()
        return
      }
      setMessage(messageFor(result, editing))
      setPending(false)
    } catch {
      setMessage("The task could not be saved.")
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[min(40rem,calc(100vh-2rem))] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle>{editing ? "Edit task" : "Create task"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update this task. Saving keeps it on the same project."
              : "Add a task to this project. It stays unassigned until you choose a project member."}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
          {message ? (
            <p className="text-sm text-destructive" role="alert">
              {message}
            </p>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor={`${fieldPrefix}-title`}>Title</Label>
            <Input
              id={`${fieldPrefix}-title`}
              value={title}
              disabled={pending}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${fieldPrefix}-description`}>Description</Label>
            <Textarea
              id={`${fieldPrefix}-description`}
              value={description}
              disabled={pending}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label id={`${fieldPrefix}-priority-label`}>Priority</Label>
              <Select
                items={taskPriorityValues.map((item) => ({
                  value: item,
                  label: taskPriorityLabel(item),
                }))}
                value={priority}
                onValueChange={(value) => {
                  if (isPriority(value)) setPriority(value)
                }}
              >
                <SelectTrigger
                  className="w-full"
                  disabled={pending}
                  aria-labelledby={`${fieldPrefix}-priority-label`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {taskPriorityValues.map((item) => (
                    <SelectItem key={item} value={item}>
                      {taskPriorityLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label id={`${fieldPrefix}-status-label`}>Status</Label>
              <Select
                items={taskStatusValues.map((item) => ({
                  value: item,
                  label: taskStatusLabel(item),
                }))}
                value={status}
                onValueChange={(value) => {
                  if (isStatus(value)) setStatus(value)
                }}
              >
                <SelectTrigger
                  className="w-full"
                  disabled={pending}
                  aria-labelledby={`${fieldPrefix}-status-label`}
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
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`${fieldPrefix}-due`}>Due date</Label>
              <Input
                id={`${fieldPrefix}-due`}
                type="date"
                value={dueOn}
                disabled={pending}
                className="h-9"
                onChange={(event) => setDueOn(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label id={`${fieldPrefix}-assignee-label`}>Assignee</Label>
              <Select
                items={assigneeItems}
                value={assigneeId}
                onValueChange={(value) => {
                  if (value) setAssigneeId(value)
                }}
              >
                <SelectTrigger
                  className="w-full"
                  disabled={pending}
                  aria-labelledby={`${fieldPrefix}-assignee-label`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assigneeItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save task" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function messageFor(
  result: Exclude<
    Awaited<ReturnType<typeof createOrganizationTask | typeof updateOrganizationTask>>,
    { status: "created" } | { status: "updated" }
  >,
  editing: boolean
) {
  if (result.status === "invalid") return result.message
  if (result.status === "denied") {
    return editing
      ? "You do not have permission to edit this task."
      : "You do not have permission to add a task to this project."
  }
  if (result.status === "unavailable") {
    return editing ? "This task is not available to update." : "This project is not available."
  }
  if (result.status === "rejected") {
    return "This organization is not available for your account."
  }
  return "The task could not be saved."
}

function isCreatableAccess(
  access: AccessSnapshot
): access is Extract<TaskCreationAccess, { canCreate: true }> {
  return access.status === "ready" && access.canCreate
}

function isPriority(value: string | null): value is TaskPriorityValue {
  return taskPriorityValues.some((priority) => priority === value)
}

function isStatus(value: string | null): value is TaskStatusValue {
  return taskStatusValues.some((status) => status === value)
}

function useProjectTasks(organizationId: string, projectId: string) {
  const store = useMemo(
    () => createTasksStore(organizationId, projectId),
    [organizationId, projectId]
  )
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  )
}

function createTasksStore(organizationId: string, projectId: string) {
  const initial: TasksSnapshot = { status: "loading", tasks: [] }
  let current = initial
  let generation = 0
  const listeners = new Set<() => void>()

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      const load = () => {
        const requestGeneration = ++generation
        void getOrganizationProjectTasks(organizationId, projectId)
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

function useTaskCreationAccess(organizationId: string, projectId: string) {
  const store = useMemo(
    () => createAccessStore(organizationId, projectId),
    [organizationId, projectId]
  )
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  )
}

function createAccessStore(organizationId: string, projectId: string) {
  const initial: AccessSnapshot = { status: "loading" }
  let current: AccessSnapshot = initial
  let generation = 0
  const listeners = new Set<() => void>()

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      const load = () => {
        const requestGeneration = ++generation
        void getTaskCreationAccess(organizationId, projectId)
          .then((result) => {
            if (requestGeneration !== generation) return
            current = result
            listeners.forEach((item) => item())
          })
          .catch(() => {
            if (requestGeneration !== generation) return
            current = { status: "error" }
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
