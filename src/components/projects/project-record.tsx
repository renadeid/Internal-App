"use client"

import { useMemo, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { PublicShare } from "@/components/shared/public-share"

import { ProjectAdminAccess } from "@/components/projects/project-admin-access"
import { useOrganization } from "@/components/auth/organization-provider"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
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
import { getOrganizationProject } from "@/lib/auth/get-organization-projects"
import { ProjectCampaignsRecord } from "@/components/marketing/organization-campaigns-view"
import { ProjectTasksRecord } from "@/components/projects/project-tasks-record"
import type {
  OrganizationProject,
  OrganizationProjectResult,
  ProjectEditAccess,
  ProjectStatusValue,
} from "@/lib/auth/organization-projects"
import { refreshOrganizationProjects } from "@/lib/auth/project-list-refresh"
import {
  getProjectEditAccess,
  deleteOrganizationProject,
  setOrganizationProjectArchived,
  updateOrganizationProject,
} from "@/lib/auth/project-update-actions"
import { projectStatusClass, surfaceClass } from "@/lib/presentation"
import type { ProjectStatus } from "@/lib/types"

type ProjectSnapshot = {
  status: "loading" | OrganizationProjectResult["status"]
  project: OrganizationProject | null
}

export function ProjectRecord({ projectId }: { projectId: string }) {
  const { activeOrganization, mode } = useOrganization()

  if (!activeOrganization) {
    const message =
      mode === "multiple"
        ? "Select an organization in the sidebar to open this project."
        : mode === "unavailable"
          ? "Organization is unavailable."
          : "No organization is available."
    return <ProjectNotice title="Project unavailable" message={message} />
  }

  return (
    <ProjectBody
      key={`${activeOrganization.id}:${projectId}`}
      organizationId={activeOrganization.id}
      organizationName={activeOrganization.name}
      projectId={projectId}
    />
  )
}

function ProjectBody({
  organizationId,
  organizationName,
  projectId,
}: {
  organizationId: string
  organizationName: string
  projectId: string
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const { snapshot, reload } = useProjectRecord(organizationId, projectId)
  const editAccess = useProjectEditAccess(organizationId, projectId)
  const editable = isEditableAccess(editAccess) ? editAccess : null

  if (snapshot.status === "loading") {
    return (
      <ProjectNotice
        title="Loading project"
        message={`Loading this project in ${organizationName}…`}
      />
    )
  }
  if (snapshot.status === "error") {
    return (
      <ProjectNotice
        title="Project unavailable"
        message="This project could not be loaded."
      />
    )
  }
  if (snapshot.status === "rejected") {
    return (
      <ProjectNotice
        title="Project unavailable"
        message="This organization is not available for your account."
      />
    )
  }
  if (snapshot.status === "sample") {
    return (
      <ProjectNotice
        title="Preview sample"
        message={`${projectId} is a preview address. Open Projects to see the saved projects in ${organizationName}.`}
      />
    )
  }
  if (snapshot.status === "missing" || !snapshot.project) {
    return (
      <ProjectNotice
        title="Project not available"
        message={`This project is not available in ${organizationName}. It may be private, or it may not exist in this organization.`}
      />
    )
  }

  const project = snapshot.project
  const status = statusLabel(project.status)

  return (
    <div className="flex flex-col gap-6">
      <section className={`${surfaceClass} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-center gap-2">
          {project.leadDepartment ? (
            <Badge variant="secondary">{project.leadDepartment}</Badge>
          ) : null}
          <Badge variant="secondary" className={projectStatusClass[status]}>
            {status}
          </Badge>
          {project.archivedAt ? <Badge variant="secondary">Archived</Badge> : null}
        </div>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {project.name}
          </h1>
          {editable && snapshot.project ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
                Edit
              </Button>
              {editable.canArchive ? <Button type="button" variant="outline" onClick={() => setArchiveOpen(true)}>
                {project.archivedAt ? "Restore" : "Archive"}
              </Button> : null}
              {editable.canDelete ? <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>Delete project</Button> : null}
            </div>
          ) : null}
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          {project.description || "No description yet."}
        </p>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Assets on their own pages are preview samples and are not linked to
          this project.
        </p>
        {editable?.canDelete ? <DeleteProjectDialog key={`${project.id}:${deleteOpen}`} open={deleteOpen} onOpenChange={setDeleteOpen} organizationId={organizationId} project={project} /> : null}
        {editable?.canArchive ? (
          <ArchiveProjectDialog
            open={archiveOpen}
            organizationId={organizationId}
            organizationName={organizationName}
            project={project}
            onOpenChange={setArchiveOpen}
            onSaved={() => {
              refreshOrganizationProjects()
              reload()
            }}
          />
        ) : null}
        {editable ? (
          <EditProjectForm
            key={`${project.updatedOn}:${project.name}:${project.status}:${project.leadDepartmentId}:${project.ownerId}:${project.startsOn ?? ""}:${project.dueOn ?? ""}:${project.description}`}
            open={editOpen}
            organizationId={organizationId}
            organizationName={organizationName}
            project={project}
            departments={editable.departments}
            owners={editable.owners}
            onOpenChange={setEditOpen}
            onSaved={() => {
              refreshOrganizationProjects()
              reload()
            }}
          />
        ) : null}
        <dl className="mt-6 grid gap-4 border-t border-border pt-5 text-sm sm:grid-cols-2">
          <Fact label="Organization" value={organizationName} />
          <Fact label="Lead department" value={project.leadDepartment ?? "Not available"} />
          <Fact label="Owner" value={project.ownerName ?? "Not available"} />
          <Fact label="Starts" value={project.startsOn ?? "Not set"} />
          <Fact label="Due" value={project.dueOn ?? "Not set"} />
          <Fact label="Updated" value={project.updatedOn} />
        </dl>
      </section>
      <ProjectAdminAccess organizationId={organizationId} projectId={project.id} />
      <PublicShare key={`${organizationId}:${project.id}`} resourceId={project.id} kind="project" />
      <ProjectTasksRecord organizationId={organizationId} projectId={project.id} />
      {project.historyAccess === "assigned_only" ? <p className="text-sm text-muted-foreground">Your access is limited to tasks assigned to you. Other project work and history are private.</p> : <ProjectCampaignsRecord organizationId={organizationId} projectId={project.id} />}
    </div>
  )
}

function DeleteProjectDialog({ open, onOpenChange, organizationId, project }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  project: OrganizationProject
}) {
  const router = useRouter()
  const [confirmation, setConfirmation] = useState("")
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  async function handleDelete() {
    if (pending || confirmation !== project.name) return
    setPending(true)
    setMessage(null)
    try {
      const result = await deleteOrganizationProject({ organizationId, projectId: project.id, confirmationName: confirmation })
      if (result.status === "updated") {
        refreshOrganizationProjects()
        router.replace("/projects")
        return
      }
      setMessage(result.status === "invalid" ? result.message : result.status === "denied" ? "Only Super admin can delete projects." : "The project could not be deleted. Refresh and try again.")
    } catch {
      setMessage("The project could not be deleted. Refresh and try again.")
    }
    setPending(false)
  }
  return <Dialog open={open} onOpenChange={next => { if (!pending) onOpenChange(next) }}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Delete project permanently?</DialogTitle>
        <DialogDescription>This permanently deletes {project.name}, its tasks, campaigns, deliverables, invitations, memberships and project activity. This cannot be undone. Linked library assets and their files are kept.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="delete-project-confirmation">Type the project name: {project.name}</Label>
        <Input id="delete-project-confirmation" autoComplete="off" value={confirmation} disabled={pending} onChange={event => setConfirmation(event.target.value)} />
        {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
      </div>
      <DialogFooter>
        <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button variant="destructive" disabled={pending || confirmation !== project.name} onClick={() => void handleDelete()}>{pending ? "Deleting…" : "Delete permanently"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  )
}

function ProjectNotice({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-3 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm leading-6 text-muted-foreground" aria-live="polite">
        {message}
      </p>
      <Link href="/projects" className={buttonVariants({ variant: "outline" })}>
        Back to projects
      </Link>
    </div>
  )
}

function statusLabel(status: ProjectStatusValue): ProjectStatus {
  if (status === "planning") return "Planning"
  if (status === "in_progress") return "In progress"
  if (status === "in_review") return "In review"
  return "On hold"
}

function useProjectRecord(organizationId: string, projectId: string) {
  const store = useMemo(
    () => createProjectStore(organizationId, projectId),
    [organizationId, projectId]
  )
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  )
  return { snapshot, reload: store.reload }
}

function createProjectStore(organizationId: string, projectId: string) {
  const initial: ProjectSnapshot = { status: "loading", project: null }
  let current = initial
  let generation = 0
  const listeners = new Set<() => void>()

  function load() {
    const requestGeneration = ++generation
    void getOrganizationProject(organizationId, projectId)
      .then((result) => {
        if (requestGeneration !== generation) return
        current = {
          status: result.status,
          project: result.status === "ready" ? result.project : null,
        }
        listeners.forEach((item) => item())
      })
      .catch(() => {
        if (requestGeneration !== generation) return
        current = { status: "error", project: null }
        listeners.forEach((item) => item())
      })
  }

  return {
    reload: load,
    subscribe(listener: () => void) {
      listeners.add(listener)
      load()
      return () => {
        listeners.delete(listener)
        generation += 1
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

const editStatuses: { value: ProjectStatusValue; label: ProjectStatus }[] = [
  { value: "planning", label: "Planning" },
  { value: "in_progress", label: "In progress" },
  { value: "in_review", label: "In review" },
  { value: "on_hold", label: "On hold" },
]

function ArchiveProjectDialog({
  open,
  organizationId,
  organizationName,
  project,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  organizationId: string
  organizationName: string
  project: OrganizationProject
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const restoring = Boolean(project.archivedAt)
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
      const result = await setOrganizationProjectArchived({
        organizationId,
        projectId: project.id,
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
      setMessage(restoring ? "The project could not be restored." : "The project could not be archived.")
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle>{restoring ? "Restore project" : "Archive project"}</DialogTitle>
          <DialogDescription>
            {restoring
              ? `Restore ${project.name} in ${organizationName}. It returns to the active project list.`
              : `Archive ${project.name} in ${organizationName}. It stays available from its address and from Show archived in the project list.`}
          </DialogDescription>
        </DialogHeader>
        {message ? (
          <p className="text-sm text-destructive" role="alert">
            {message}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => handleOpenChange(false)}>
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

function EditProjectForm({
  open,
  organizationId,
  organizationName,
  project,
  departments,
  owners,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  organizationId: string
  organizationName: string
  project: OrganizationProject
  departments: { id: string; name: string }[]
  owners: { id: string; name: string }[]
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description)
  const [status, setStatus] = useState<ProjectStatusValue>(project.status)
  const [leadDepartmentId, setLeadDepartmentId] = useState(project.leadDepartmentId)
  const [ownerId, setOwnerId] = useState(project.ownerId)
  const [startsOn, setStartsOn] = useState(project.startsOn ?? "")
  const [dueOn, setDueOn] = useState(project.dueOn ?? "")
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function handleOpenChange(next: boolean) {
    if (pending) return
    onOpenChange(next)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setMessage("Enter a project name.")
      return
    }
    if (!departments.some((department) => department.id === leadDepartmentId)) {
      setMessage("Choose a lead department in this organization.")
      return
    }
    if (!owners.some((owner) => owner.id === ownerId)) {
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
      const result = await updateOrganizationProject({
        organizationId,
        projectId: project.id,
        name: trimmedName,
        description,
        status,
        leadDepartmentId,
        ownerId,
        startsOn: startsOn || null,
        dueOn: dueOn || null,
      })
      if (result.status === "updated") {
        onOpenChange(false)
        onSaved()
        setPending(false)
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
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription>
            Update this project in {organizationName}.
          </DialogDescription>
        </DialogHeader>
        <form id="edit-project-form" className="grid gap-4" onSubmit={handleSubmit}>
          {message ? (
            <p className="text-sm text-destructive" role="alert">
              {message}
            </p>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="edit-project-name">Project name</Label>
            <Input
              id="edit-project-name"
              value={name}
              autoFocus
              autoComplete="off"
              disabled={pending}
              className="h-9"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-project-description">Description</Label>
            <Textarea
              id="edit-project-description"
              value={description}
              rows={4}
              disabled={pending}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label id="edit-project-status-label">Status</Label>
            <Select
              items={editStatuses.map((item) => ({
                value: item.value,
                label: item.label,
              }))}
              value={status}
              onValueChange={(value) => {
                if (value && isProjectStatus(value)) setStatus(value)
              }}
            >
              <SelectTrigger
                className="w-full"
                disabled={pending}
                aria-labelledby="edit-project-status-label"
              >
                <SelectValue placeholder="Choose a status" />
              </SelectTrigger>
              <SelectContent>
                {editStatuses.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label id="edit-project-department-label">Lead department</Label>
            <Select
              items={departments.map((department) => ({
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
                aria-labelledby="edit-project-department-label"
              >
                <SelectValue placeholder="Choose a lead department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label id="edit-project-owner-label">Owner</Label>
            <Select
              items={owners.map((owner) => ({
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
                aria-labelledby="edit-project-owner-label"
              >
                <SelectValue placeholder="Choose an owner" />
              </SelectTrigger>
              <SelectContent>
                {owners.map((owner) => (
                  <SelectItem key={owner.id} value={owner.id}>
                    {owner.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-project-start">Start</Label>
              <Input
                id="edit-project-start"
                type="date"
                value={startsOn}
                disabled={pending}
                className="h-9"
                onChange={(event) => setStartsOn(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-project-due">Due</Label>
              <Input
                id="edit-project-due"
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
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function useProjectEditAccess(organizationId: string, projectId: string) {
  const store = useMemo(
    () => createEditAccessStore(organizationId, projectId),
    [organizationId, projectId]
  )
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  )
}

function createEditAccessStore(organizationId: string, projectId: string) {
  const initial: ProjectEditAccess = { status: "ready", canEdit: false }
  let current: ProjectEditAccess = initial
  let generation = 0
  const listeners = new Set<() => void>()

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      const requestGeneration = ++generation
      void getProjectEditAccess(organizationId, projectId)
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
      return () => {
        listeners.delete(listener)
        generation += 1
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

function archiveMessage(
  result: Exclude<Awaited<ReturnType<typeof setOrganizationProjectArchived>>, { status: "updated" }>,
  restoring: boolean
) {
  if (result.status === "invalid") return result.message
  if (result.status === "denied") {
    return restoring
      ? "You do not have permission to restore this project."
      : "You do not have permission to archive this project."
  }
  if (result.status === "unavailable") {
    return restoring
      ? "This project is not available to restore."
      : "This project is not available to archive."
  }
  if (result.status === "rejected") {
    return "This organization is not available for your account."
  }
  return restoring ? "The project could not be restored." : "The project could not be archived."
}

function messageFor(
  result: Exclude<Awaited<ReturnType<typeof updateOrganizationProject>>, { status: "updated" }>
) {
  if (result.status === "invalid") return result.message
  if (result.status === "denied") {
    return "You do not have permission to edit this project."
  }
  if (result.status === "unavailable") {
    return "This project is not available to edit."
  }
  if (result.status === "rejected") {
    return "This organization is not available for your account."
  }
  return "The project could not be saved."
}

function isEditableAccess(
  access: ProjectEditAccess
): access is Extract<ProjectEditAccess, { canEdit: true }> {
  return access.status === "ready" && access.canEdit
}

function isProjectStatus(value: string): value is ProjectStatusValue {
  return editStatuses.some((item) => item.value === value)
}

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}
