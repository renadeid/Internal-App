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
import { useWorkspace } from "@/components/workspace/workspace-provider"
import { team } from "@/lib/mock-data/team"
import {
  deliverableTypes,
  type DeliverableInput,
  type DeliverableType,
} from "@/lib/types"

const people = team.map((member) => ({ value: member.id, label: member.name }))
const typeItems = deliverableTypes.map((type) => ({ value: type, label: type }))

export function DeliverableFormDialog({
  open,
  onOpenChange,
  projectId,
  campaignId,
  initial,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  campaignId: string
  initial: DeliverableInput
  onSubmit: (input: DeliverableInput) => void
}) {
  const { assets } = useWorkspace()
  const [draft, setDraft] = useState(initial)
  const [titleError, setTitleError] = useState<string | null>(null)
  const linkedAssets = assets.filter(
    (asset) =>
      !asset.archived &&
      (asset.projectId === projectId || asset.campaignId === campaignId)
  )
  const assetItems = [
    { value: "none", label: "No linked asset" },
    ...linkedAssets.map((asset) => ({ value: asset.id, label: asset.name })),
  ]

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = draft.title.trim()
    if (!title) {
      setTitleError("Enter a deliverable title.")
      return
    }
    onSubmit({
      ...draft,
      title,
      assetId: draft.assetId && draft.assetId !== "none" ? draft.assetId : undefined,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle>Add deliverable</DialogTitle>
          <DialogDescription>
            New deliverables start as drafts. The creator submits them, and the
            Marketing Manager reviews them.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="deliverable-title">Title</Label>
            <Input
              id="deliverable-title"
              value={draft.title}
              aria-invalid={titleError ? true : undefined}
              aria-describedby={titleError ? "deliverable-title-error" : undefined}
              className="h-9"
              onChange={(event) => {
                setDraft((current) => ({ ...current, title: event.target.value }))
                if (titleError) setTitleError(null)
              }}
            />
            {titleError ? (
              <p id="deliverable-title-error" className="text-xs text-destructive">
                {titleError}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label id="deliverable-type-label">Type</Label>
              <Select
                items={typeItems}
                value={draft.type}
                onValueChange={(value) => {
                  if (isDeliverableType(value)) {
                    setDraft((current) => ({ ...current, type: value }))
                  }
                }}
              >
                <SelectTrigger className="w-full" aria-labelledby="deliverable-type-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {deliverableTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label id="deliverable-creator-label">Creator</Label>
              <Select
                items={people}
                value={draft.creatorId}
                onValueChange={(value) => {
                  if (value) setDraft((current) => ({ ...current, creatorId: value }))
                }}
              >
                <SelectTrigger className="w-full" aria-labelledby="deliverable-creator-label">
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
              <Label htmlFor="deliverable-due">Due date</Label>
              <Input
                id="deliverable-due"
                type="date"
                value={draft.dueDate}
                className="h-9"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, dueDate: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label id="deliverable-asset-label">Linked asset</Label>
              <Select
                items={assetItems}
                value={draft.assetId || "none"}
                onValueChange={(value) =>
                  setDraft((current) => ({ ...current, assetId: value ?? "none" }))
                }
              >
                <SelectTrigger className="w-full" aria-labelledby="deliverable-asset-label">
                  <SelectValue placeholder="No linked asset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No linked asset</SelectItem>
                  {linkedAssets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.name}
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
            <Button type="submit">Add deliverable</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function isDeliverableType(value: string | null): value is DeliverableType {
  return deliverableTypes.some((type) => type === value)
}
