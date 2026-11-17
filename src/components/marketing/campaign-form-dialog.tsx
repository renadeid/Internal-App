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
import { endDateError } from "@/lib/dates"
import { team } from "@/lib/mock-data/team"
import {
  campaignStatuses,
  campaignTypes,
  type CampaignInput,
  type CampaignStatus,
  type CampaignType,
  type Project,
} from "@/lib/types"

const owners = team.map((member) => ({ value: member.id, label: member.name }))
const typeItems = campaignTypes.map((type) => ({ value: type, label: type }))
const statusItems = campaignStatuses.map((status) => ({
  value: status,
  label: status,
}))

export function CampaignFormDialog({
  open,
  onOpenChange,
  projects,
  initial,
  title,
  submitLabel,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: Project[]
  initial: CampaignInput
  title: string
  submitLabel: string
  onSubmit: (input: CampaignInput) => void
}) {
  const [draft, setDraft] = useState(initial)
  const [nameError, setNameError] = useState<string | null>(null)
  const [projectError, setProjectError] = useState<string | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)
  const projectItems = projects.map((project) => ({
    value: project.id,
    label: project.name,
  }))

  function update(patch: Partial<CampaignInput>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = draft.name.trim()
    const dateMessage = endDateError(draft.startDate, draft.endDate)
    let invalid = false
    if (!name) {
      setNameError("Enter a campaign name.")
      invalid = true
    }
    if (!draft.projectId) {
      setProjectError("Choose a project.")
      invalid = true
    }
    if (dateMessage) {
      setDateError(dateMessage)
      invalid = true
    }
    if (invalid) return
    onSubmit({
      ...draft,
      name,
      description: draft.description.trim(),
      goals: draft.goals.trim(),
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(40rem,calc(100vh-2rem))] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Campaigns belong to a shared project. Marketing runs the work, and
            the other departments stay on the same project.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="campaign-name">Campaign name</Label>
            <Input
              id="campaign-name"
              value={draft.name}
              autoComplete="off"
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "campaign-name-error" : undefined}
              className="h-9"
              onChange={(event) => {
                update({ name: event.target.value })
                if (nameError) setNameError(null)
              }}
            />
            {nameError ? (
              <p id="campaign-name-error" className="text-xs text-destructive">
                {nameError}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="campaign-description">Description</Label>
            <Textarea
              id="campaign-description"
              value={draft.description}
              rows={3}
              onChange={(event) => update({ description: event.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label id="campaign-project-label">Project</Label>
              <Select
                items={projectItems}
                value={draft.projectId || null}
                onValueChange={(value) => {
                  if (!value) return
                  update({ projectId: value })
                  if (projectError) setProjectError(null)
                }}
              >
                <SelectTrigger
                  className="w-full"
                  aria-labelledby="campaign-project-label"
                  aria-invalid={projectError ? true : undefined}
                >
                  <SelectValue placeholder="Choose a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {projectError ? (
                <p className="text-xs text-destructive">{projectError}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label id="campaign-owner-label">Owner</Label>
              <Select
                items={owners}
                value={draft.ownerId}
                onValueChange={(value) => {
                  if (value) update({ ownerId: value })
                }}
              >
                <SelectTrigger className="w-full" aria-labelledby="campaign-owner-label">
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
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label id="campaign-type-label">Type</Label>
              <Select
                items={typeItems}
                value={draft.type}
                onValueChange={(value) => {
                  if (isCampaignType(value)) update({ type: value })
                }}
              >
                <SelectTrigger className="w-full" aria-labelledby="campaign-type-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {campaignTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label id="campaign-status-label">Status</Label>
              <Select
                items={statusItems}
                value={draft.status}
                onValueChange={(value) => {
                  if (isCampaignStatus(value)) update({ status: value })
                }}
              >
                <SelectTrigger className="w-full" aria-labelledby="campaign-status-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {campaignStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="campaign-start">Start date</Label>
              <Input
                id="campaign-start"
                type="date"
                value={draft.startDate}
                className="h-9"
                onChange={(event) => {
                  update({ startDate: event.target.value })
                  if (dateError) setDateError(null)
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="campaign-end">End date</Label>
              <Input
                id="campaign-end"
                type="date"
                value={draft.endDate}
                aria-invalid={dateError ? true : undefined}
                aria-describedby={dateError ? "campaign-date-error" : undefined}
                className="h-9"
                onChange={(event) => {
                  update({ endDate: event.target.value })
                  if (dateError) setDateError(null)
                }}
              />
              {dateError ? (
                <p id="campaign-date-error" className="text-xs text-destructive">
                  {dateError}
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="campaign-goals">Goals</Label>
            <Textarea
              id="campaign-goals"
              value={draft.goals}
              rows={3}
              placeholder="Optional"
              onChange={(event) => update({ goals: event.target.value })}
            />
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

function isCampaignType(value: string | null): value is CampaignType {
  return campaignTypes.some((type) => type === value)
}

function isCampaignStatus(value: string | null): value is CampaignStatus {
  return campaignStatuses.some((status) => status === value)
}
