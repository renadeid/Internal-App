"use client"

import { useState } from "react"

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
import { team } from "@/lib/mock-data/team"
import {
  priorities,
  taskStatuses,
  type Priority,
  type TaskInput,
  type TaskStatus,
} from "@/lib/types"

const people = team.map((member) => ({ value: member.id, label: member.name }))
const priorityItems = priorities.map((priority) => ({
  value: priority,
  label: priority,
}))
const statusItems = taskStatuses.map((status) => ({
  value: status,
  label: status,
}))

export function TaskFormDialog({
  open,
  onOpenChange,
  initial,
  title,
  submitLabel,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: TaskInput
  title: string
  submitLabel: string
  onSubmit: (input: TaskInput) => void
}) {
  const [draft, setDraft] = useState(initial)
  const [nameError, setNameError] = useState<string | null>(null)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const taskTitle = draft.title.trim()
    if (!taskTitle) {
      setNameError("Enter a task title.")
      return
    }
    onSubmit({ ...draft, title: taskTitle, description: draft.description.trim() })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(40rem,calc(100vh-2rem))] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            This task stays on the campaign, and it also appears on the parent
            project and in My Tasks.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={draft.title}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "task-title-error" : undefined}
              className="h-9"
              onChange={(event) => {
                setDraft((current) => ({ ...current, title: event.target.value }))
                if (nameError) setNameError(null)
              }}
            />
            {nameError ? (
              <p id="task-title-error" className="text-xs text-destructive">
                {nameError}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={draft.description}
              rows={3}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label id="task-assignee-label">Assignee</Label>
              <Select
                items={people}
                value={draft.assigneeId}
                onValueChange={(value) => {
                  if (value) setDraft((current) => ({ ...current, assigneeId: value }))
                }}
              >
                <SelectTrigger className="w-full" aria-labelledby="task-assignee-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {team.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-due">Due date</Label>
              <Input
                id="task-due"
                type="date"
                value={draft.dueDate}
                className="h-9"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, dueDate: event.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label id="task-priority-label">Priority</Label>
              <Select
                items={priorityItems}
                value={draft.priority}
                onValueChange={(value) => {
                  if (isPriority(value)) {
                    setDraft((current) => ({ ...current, priority: value }))
                  }
                }}
              >
                <SelectTrigger className="w-full" aria-labelledby="task-priority-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {priority}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label id="task-status-label">Status</Label>
              <Select
                items={statusItems}
                value={draft.status}
                onValueChange={(value) => {
                  if (isTaskStatus(value)) {
                    setDraft((current) => ({ ...current, status: value }))
                  }
                }}
              >
                <SelectTrigger className="w-full" aria-labelledby="task-status-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {taskStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function isPriority(value: string | null): value is Priority {
  return priorities.some((priority) => priority === value)
}

function isTaskStatus(value: string | null): value is TaskStatus {
  return taskStatuses.some((status) => status === value)
}
