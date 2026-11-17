"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

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
import { createOrganizationProject } from "@/lib/auth/project-creation-actions"
import type { ProjectCreationAccess } from "@/lib/auth/project-creation"
import { refreshOrganizationProjects } from "@/lib/auth/project-list-refresh"
import { projectSlugFromName } from "@/lib/auth/project-slug"

type CreateAccess = Extract<ProjectCreationAccess, { canCreate: true }>

export function CreateProjectDialog({
  open,
  onOpenChange,
  organizationId,
  organizationName,
  access,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  organizationName: string
  access: CreateAccess
}) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [leadDepartmentId, setLeadDepartmentId] = useState<string | null>(
    access.departments.length === 1 ? access.departments[0].id : null
  )
  const [ownerId, setOwnerId] = useState<string | null>(
    access.owners.some((owner) => owner.id === access.currentUserId)
      ? access.currentUserId
      : null
  )
  const [startsOn, setStartsOn] = useState("")
  const [dueOn, setDueOn] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const slug = projectSlugFromName(name)

  function reset() {
    setName("")
    setDescription("")
    setLeadDepartmentId(access.departments.length === 1 ? access.departments[0].id : null)
    setOwnerId(
      access.owners.some((owner) => owner.id === access.currentUserId)
        ? access.currentUserId
        : null
    )
    setStartsOn("")
    setDueOn("")
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
    const trimmedName = name.trim()
    if (!trimmedName) {
      setMessage("Enter a project name.")
      return
    }
    if (!slug) {
      setMessage("Use a name that contains a letter or number.")
      return
    }
    if (!leadDepartmentId || !access.departments.some((department) => department.id === leadDepartmentId)) {
      setMessage("Choose a lead department in this organization.")
      return
    }
    if (!ownerId || !access.owners.some((owner) => owner.id === ownerId)) {
      setMessage("Choose an owner who belongs to this organization.")
      return
    }
    if ((startsOn && !isDate(startsOn)) || (dueOn && !isDate(dueOn))) {
      setMessage("Enter dates as YYYY-MM-DD.")
      return
    }
    if (startsOn && dueOn && dueOn < startsOn) {
      setMessage("The due date must be on or after the start date.")
      return
    }

    setPending(true)
    setMessage(null)
    try {
      const result = await createOrganizationProject({
        organizationId,
        name: trimmedName,
        description,
        leadDepartmentId,
        ownerId,
        startsOn: startsOn || null,
        dueOn: dueOn || null,
      })
      if (result.status === "created") {
        refreshOrganizationProjects()
        onOpenChange(false)
        reset()
        router.push(`/projects/${result.projectId}`)
        router.refresh()
        return
      }
      setMessage(messageFor(result))
      setPending(false)
    } catch {
      setMessage("The project could not be saved.")
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            Save a project in {organizationName}. Editing and archiving stay
            unavailable.
          </DialogDescription>
        </DialogHeader>
        <form id="create-project-form" className="grid gap-4" onSubmit={handleSubmit}>
          {message ? (
            <p className="text-sm text-destructive" role="alert">
              {message}
            </p>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              value={name}
              autoFocus
              autoComplete="off"
              disabled={pending}
              placeholder="Spring field kit"
              className="h-9"
              onChange={(event) => setName(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {slug ? `Address: ${slug}` : "The address is created from the name."}
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={description}
              rows={4}
              disabled={pending}
              placeholder="What this project is for"
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label id="project-department-label">Lead department</Label>
            <Select
              items={access.departments.map((department) => ({
                value: department.id,
                label: department.name,
              }))}
              value={leadDepartmentId}
              onValueChange={(value) => {
                if (value) setLeadDepartmentId(value)
              }}
            >
              <SelectTrigger
                className="w-full"
                disabled={pending}
                aria-labelledby="project-department-label"
              >
                <SelectValue placeholder="Choose a lead department" />
              </SelectTrigger>
              <SelectContent>
                {access.departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label id="project-owner-label">Owner</Label>
            <Select
              items={access.owners.map((owner) => ({
                value: owner.id,
                label: owner.name,
              }))}
              value={ownerId}
              onValueChange={(value) => {
                if (value) setOwnerId(value)
              }}
            >
              <SelectTrigger
                className="w-full"
                disabled={pending}
                aria-labelledby="project-owner-label"
              >
                <SelectValue placeholder="Choose an owner" />
              </SelectTrigger>
              <SelectContent>
                {access.owners.map((owner) => (
                  <SelectItem key={owner.id} value={owner.id}>
                    {owner.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="project-start">Start</Label>
              <Input
                id="project-start"
                type="date"
                value={startsOn}
                disabled={pending}
                className="h-9"
                onChange={(event) => setStartsOn(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project-due">Due</Label>
              <Input
                id="project-due"
                type="date"
                value={dueOn}
                disabled={pending}
                className="h-9"
                onChange={(event) => setDueOn(event.target.value)}
              />
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
              {pending ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function messageFor(result: Exclude<Awaited<ReturnType<typeof createOrganizationProject>>, { status: "created" }>) {
  if (result.status === "invalid") return result.message
  if (result.status === "denied") {
    return "You do not have permission to create a project in this department."
  }
  if (result.status === "conflict") {
    return "A project in this organization already uses that address. Change the name."
  }
  if (result.status === "rejected") {
    return "This organization is not available for your account."
  }
  return "The project could not be saved."
}

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}
