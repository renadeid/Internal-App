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
import { visibilityNote } from "@/lib/mock-data/assets"
import { team } from "@/lib/mock-data/team"
import {
  assetTypes,
  assetVisibilities,
  type AssetInput,
  type AssetType,
  type AssetVisibility,
  type Campaign,
  type Project,
} from "@/lib/types"

const owners = team.map((member) => ({ value: member.id, label: member.name }))
const typeItems = assetTypes.map((type) => ({ value: type, label: type }))
const visibilityItems = assetVisibilities.map((visibility) => ({
  value: visibility,
  label: visibility === "Company" ? "Company-wide" : visibility,
}))

export function AssetFormDialog({
  open,
  onOpenChange,
  projects,
  campaigns,
  initial,
  title,
  submitLabel,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: Project[]
  campaigns: Campaign[]
  initial: AssetInput
  title: string
  submitLabel: string
  onSubmit: (input: AssetInput) => void
}) {
  const [draft, setDraft] = useState(initial)
  const [tagText, setTagText] = useState(initial.tags.join(", "))
  const [nameError, setNameError] = useState<string | null>(null)
  const [urlError, setUrlError] = useState<string | null>(null)
  const projectItems = [
    { value: "none", label: "No project" },
    ...projects.map((project) => ({ value: project.id, label: project.name })),
  ]
  const campaignItems = [
    { value: "none", label: "No campaign" },
    ...campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name })),
  ]

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = draft.name.trim()
    const urlMessage = externalUrlError(draft.type, draft.url)
    if (!name) setNameError("Enter an asset name.")
    if (urlMessage) setUrlError(urlMessage)
    if (!name || urlMessage) return
    onSubmit({
      ...draft,
      name,
      description: draft.description.trim(),
      url: draft.url.trim(),
      tags: tagText
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      collection: draft.collection.trim() || "General",
      projectId: draft.projectId === "none" ? "" : draft.projectId,
      campaignId: draft.campaignId === "none" ? "" : draft.campaignId,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(40rem,calc(100vh-2rem))] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            This demo saves the name, link, and metadata. Uploaded files are
            not stored.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="asset-name">Name</Label>
            <Input
              id="asset-name"
              value={draft.name}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "asset-name-error" : undefined}
              className="h-9"
              onChange={(event) => {
                setDraft((current) => ({ ...current, name: event.target.value }))
                if (nameError) setNameError(null)
              }}
            />
            {nameError ? (
              <p id="asset-name-error" className="text-xs text-destructive">
                {nameError}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="asset-description">Description</Label>
            <Textarea
              id="asset-description"
              value={draft.description}
              rows={3}
              onChange={(event) =>
                setDraft((current) => ({ ...current, description: event.target.value }))
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label id="asset-type-label">Type</Label>
              <Select
                items={typeItems}
                value={draft.type}
                onValueChange={(value) => {
                  if (isAssetType(value)) {
                    setDraft((current) => ({ ...current, type: value }))
                    if (urlError) setUrlError(null)
                  }
                }}
              >
                <SelectTrigger className="w-full" aria-labelledby="asset-type-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assetTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label id="asset-owner-label">Owner</Label>
              <Select
                items={owners}
                value={draft.ownerId}
                onValueChange={(value) => {
                  if (value) setDraft((current) => ({ ...current, ownerId: value }))
                }}
              >
                <SelectTrigger className="w-full" aria-labelledby="asset-owner-label">
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
          <div className="grid gap-2">
            <Label htmlFor="asset-url">File or external URL</Label>
            <Input
              id="asset-url"
              value={draft.url}
              placeholder="https://"
              aria-invalid={urlError ? true : undefined}
              aria-describedby={urlError ? "asset-url-error" : "asset-url-hint"}
              className="h-9"
              onChange={(event) => {
                setDraft((current) => ({ ...current, url: event.target.value }))
                if (urlError) setUrlError(null)
              }}
            />
            {urlError ? (
              <p id="asset-url-error" className="text-xs text-destructive">
                {urlError}
              </p>
            ) : (
              <p id="asset-url-hint" className="text-xs text-muted-foreground">
                Use a direct file URL to enable Download. Website and shared-document links may require downloading from the source. Image URLs can show a preview.
              </p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="asset-tags">Tags</Label>
              <Input
                id="asset-tags"
                value={tagText}
                placeholder="launch, sales"
                className="h-9"
                onChange={(event) => setTagText(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="asset-collection">Collection</Label>
              <Input
                id="asset-collection"
                value={draft.collection}
                placeholder="General"
                className="h-9"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, collection: event.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label id="asset-project-label">Project</Label>
              <Select
                items={projectItems}
                value={draft.projectId || "none"}
                onValueChange={(value) => {
                  if (value) setDraft((current) => ({ ...current, projectId: value }))
                }}
              >
                <SelectTrigger className="w-full" aria-labelledby="asset-project-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label id="asset-campaign-label">Campaign</Label>
              <Select
                items={campaignItems}
                value={draft.campaignId || "none"}
                onValueChange={(value) => {
                  if (value) setDraft((current) => ({ ...current, campaignId: value }))
                }}
              >
                <SelectTrigger className="w-full" aria-labelledby="asset-campaign-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No campaign</SelectItem>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label id="asset-visibility-label">Visibility</Label>
            <Select
              items={visibilityItems}
              value={draft.visibility}
              onValueChange={(value) => {
                if (isVisibility(value)) {
                  setDraft((current) => ({ ...current, visibility: value }))
                }
              }}
            >
              <SelectTrigger className="w-full" aria-labelledby="asset-visibility-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assetVisibilities.map((visibility) => (
                  <SelectItem key={visibility} value={visibility}>
                    {visibility === "Company" ? "Company-wide" : visibility}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{visibilityNote}</p>
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

function externalUrlError(type: AssetType, url: string) {
  const value = url.trim()
  if (type === "External Link" && !value) return "Add the external URL."
  if (value && !/^https?:\/\//i.test(value)) {
    return "Use a URL that starts with http:// or https://."
  }
  return null
}

function isAssetType(value: string | null): value is AssetType {
  return assetTypes.some((type) => type === value)
}

function isVisibility(value: string | null): value is AssetVisibility {
  return assetVisibilities.some((visibility) => visibility === value)
}
