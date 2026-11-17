"use client"

import { useState } from "react"

import { useWorkspace } from "@/components/workspace/workspace-provider"
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
  departments,
  projectStatuses,
  type Department,
  type Project,
  type ProjectStatus,
} from "@/lib/types"
import { cn } from "@/lib/utils"

const ownerItems = team.map((member) => ({
  value: member.id,
  label: member.name,
}))

const departmentItems = departments.map((department) => ({
  value: department,
  label: department,
}))

const statusItems = projectStatuses.map((status) => ({
  value: status,
  label: status,
}))

export function EditProjectDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { updateProject } = useWorkspace()
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description)
  const [ownerId, setOwnerId] = useState(project.ownerId)
  const [department, setDepartment] = useState<Department>(project.department)
  const [selectedDepartments, setSelectedDepartments] = useState<Department[]>(
    project.departments.includes(project.department)
      ? project.departments
      : [project.department, ...project.departments]
  )
  const [status, setStatus] = useState<ProjectStatus>(project.status)
  const [progress, setProgress] = useState(String(project.progress))
  const [startLabel, setStartLabel] = useState(project.startLabel)
  const [deadlineLabel, setDeadlineLabel] = useState(project.deadlineLabel)
  const [nameError, setNameError] = useState<string | null>(null)
  const [progressError, setProgressError] = useState<string | null>(null)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError("Enter a project name.")
      return
    }

    const parsed = Number(progress)
    if (!Number.isFinite(parsed) || progress.trim() === "") {
      setProgressError("Enter progress from 0 to 100.")
      return
    }

    updateProject(project.id, {
      name: trimmedName,
      description: description.trim(),
      ownerId,
      department,
      departments: selectedDepartments.includes(department)
        ? selectedDepartments
        : [department, ...selectedDepartments],
      status,
      progress: parsed,
      startLabel: startLabel.trim() || "Not set",
      deadlineLabel: deadlineLabel.trim() || "Not set",
    })
    onOpenChange(false)
  }

  function toggleDepartment(item: Department) {
    if (item === department) return
    setSelectedDepartments((current) =>
      current.includes(item)
        ? current.filter((value) => value !== item)
        : [...current, item]
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(40rem,calc(100vh-2rem))] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription>
            Update this project for everyone working in it. Changes stay in
            this tab.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="edit-project-name">Project name</Label>
            <Input
              id="edit-project-name"
              value={name}
              autoComplete="off"
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "edit-project-name-error" : undefined}
              className="h-9"
              onChange={(event) => {
                setName(event.target.value)
                if (nameError) setNameError(null)
              }}
            />
            {nameError ? (
              <p id="edit-project-name-error" className="text-xs text-destructive">
                {nameError}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-project-description">Description</Label>
            <Textarea
              id="edit-project-description"
              value={description}
              rows={4}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label id="edit-project-owner-label">Owner</Label>
              <Select
                items={ownerItems}
                value={ownerId}
                onValueChange={(value) => {
                  if (value) setOwnerId(value)
                }}
              >
                <SelectTrigger
                  className="w-full"
                  aria-labelledby="edit-project-owner-label"
                >
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
              <Label id="edit-project-status-label">Status</Label>
              <Select
                items={statusItems}
                value={status}
                onValueChange={(value) => {
                  if (isProjectStatus(value)) setStatus(value)
                }}
              >
                <SelectTrigger
                  className="w-full"
                  aria-labelledby="edit-project-status-label"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {projectStatuses.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label id="edit-project-lead-label">Lead department</Label>
            <Select
              items={departmentItems}
              value={department}
              onValueChange={(value) => {
                if (!isDepartment(value)) return
                setDepartment(value)
                setSelectedDepartments((current) =>
                  current.includes(value) ? current : [value, ...current]
                )
              }}
            >
              <SelectTrigger
                className="w-full"
                aria-labelledby="edit-project-lead-label"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {departments.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <p id="edit-project-departments-label" className="text-sm font-medium">
              Collaborating departments
            </p>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-labelledby="edit-project-departments-label"
            >
              {departments.map((item) => {
                const selected = selectedDepartments.includes(item)
                const lead = item === department
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={selected}
                    disabled={lead}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    )}
                    onClick={() => toggleDepartment(item)}
                  >
                    {item}
                    {lead ? " · Lead" : ""}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              The lead department stays on the project. Other departments can
              join the same work.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="edit-project-progress">Progress</Label>
              <Input
                id="edit-project-progress"
                inputMode="numeric"
                value={progress}
                aria-invalid={progressError ? true : undefined}
                aria-describedby={
                  progressError ? "edit-project-progress-error" : undefined
                }
                className="h-9"
                onChange={(event) => {
                  setProgress(event.target.value)
                  if (progressError) setProgressError(null)
                }}
              />
              {progressError ? (
                <p
                  id="edit-project-progress-error"
                  className="text-xs text-destructive"
                >
                  {progressError}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-project-start">Start</Label>
              <Input
                id="edit-project-start"
                value={startLabel === "Not set" ? "" : startLabel}
                placeholder="Mar 2"
                className="h-9"
                onChange={(event) => setStartLabel(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-project-deadline">Deadline</Label>
              <Input
                id="edit-project-deadline"
                value={deadlineLabel === "Not set" ? "" : deadlineLabel}
                placeholder="Apr 14"
                className="h-9"
                onChange={(event) => setDeadlineLabel(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function isDepartment(value: string | null): value is Department {
  return departments.some((department) => department === value)
}

function isProjectStatus(value: string | null): value is ProjectStatus {
  return projectStatuses.some((status) => status === value)
}
