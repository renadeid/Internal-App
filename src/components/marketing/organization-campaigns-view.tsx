"use client"

import { useMemo, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"

import { useCurrentIdentity } from "@/components/auth/current-identity-provider"
import { useOrganization } from "@/components/auth/organization-provider"
import { PageIntro } from "@/components/shared/page-intro"
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
import {
  createOrganizationCampaign,
  getCampaignCreationAccess,
} from "@/lib/auth/campaign-creation-actions"
import {
  refreshOrganizationCampaigns,
  subscribeCampaignListRefresh,
} from "@/lib/auth/campaign-list-refresh"
import {
  getOrganizationCampaigns,
  getOrganizationProjectCampaigns,
} from "@/lib/auth/get-organization-campaigns"
import {
  campaignStatusLabel,
  campaignStatusValues,
  campaignTypeLabel,
  campaignTypeValues,
  type CampaignCreationAccess,
  type CampaignProjectOption,
  type CampaignStatusValue,
  type CampaignTypeValue,
  type OrganizationCampaign,
  type OrganizationCampaignsResult,
} from "@/lib/auth/organization-campaigns"
import { dateRange } from "@/lib/dates"
import { campaignStatusClass, surfaceClass } from "@/lib/presentation"

type CampaignsSnapshot = {
  status: "loading" | OrganizationCampaignsResult["status"]
  campaigns: OrganizationCampaign[]
}

export function OrganizationCampaignsView() {
  const identity = useCurrentIdentity()
  const { activeOrganization, mode } = useOrganization()
  const description = activeOrganization
    ? `Campaigns you can read in ${activeOrganization.name}.`
    : mode === "multiple"
      ? "Select an organization in the sidebar to see its campaigns."
      : mode === "unavailable"
        ? "Organization is unavailable."
        : "No organization is available."

  return (
    <div className="flex flex-col gap-8">
      <PageIntro title="Marketing" description={description} />
      {activeOrganization ? (
        <CampaignList
          key={`${identity.profileId}:${activeOrganization.id}`}
          userId={identity.profileId}
          organizationId={activeOrganization.id}
          organizationName={activeOrganization.name}
          projectId={null}
        />
      ) : null}
    </div>
  )
}

export function ProjectCampaignsRecord({
  organizationId,
  projectId,
}: {
  organizationId: string
  projectId: string
}) {
  const identity = useCurrentIdentity()
  return (
    <section className={`${surfaceClass} p-5 sm:p-6`}>
      <CampaignList
        key={`${identity.profileId}:${organizationId}:${projectId}`}
        userId={identity.profileId}
        organizationId={organizationId}
        organizationName=""
        projectId={projectId}
      />
    </section>
  )
}

function CampaignList({
  userId,
  organizationId,
  organizationName,
  projectId,
}: {
  userId: string
  organizationId: string
  organizationName: string
  projectId: string | null
}) {
  const [showArchived, setShowArchived] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const snapshot = useCampaigns(organizationId, projectId)
  const accessState = useCampaignAccess(userId, organizationId, projectId)
  const access = accessState.snapshot
  const creatable = isCreatableAccess(access) ? access : null
  const archivedCount =
    snapshot.status === "ready"
      ? snapshot.campaigns.filter((campaign) => campaign.archivedAt).length
      : 0
  const visible =
    snapshot.status === "ready"
      ? showArchived
        ? snapshot.campaigns
        : snapshot.campaigns.filter((campaign) => !campaign.archivedAt)
      : []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Campaigns</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {projectId
              ? "Campaigns saved for this project."
              : `Active campaigns visible in ${organizationName}.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {snapshot.status === "ready" ? (
            <Button
              type="button"
              variant={showArchived ? "default" : "outline"}
              aria-pressed={showArchived}
              onClick={() => setShowArchived((current) => !current)}
            >
              {showArchived ? "Hide archived" : "Show archived"}
            </Button>
          ) : null}
          {creatable ? (
            <Button type="button" onClick={() => setCreateOpen(true)}>
              Create campaign
            </Button>
          ) : null}
        </div>
      </div>
      {creatable ? (
        <CreateCampaignDialog
          open={createOpen}
          userId={userId}
          organizationId={organizationId}
          fixedProjectId={projectId}
          projects={creatable.projects}
          listAccess={access}
          listProjectId={projectId}
          listReload={accessState.reload}
          onOpenChange={setCreateOpen}
          onCreated={() => {
            setCreateOpen(false)
            refreshOrganizationCampaigns()
          }}
        />
      ) : null}
      {snapshot.status === "loading" ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Loading campaigns…
        </p>
      ) : null}
      {snapshot.status === "error" ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Campaigns could not be loaded.
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
            ? "No active campaigns are visible. Show archived campaigns to see them."
            : projectId
              ? "No active campaigns are visible for this project."
              : `No active campaigns are visible in ${organizationName}.`}
        </p>
      ) : null}
      {snapshot.status === "ready" && visible.length > 0 ? (
        <ul className="border-t border-border">
          {visible.map((campaign) => (
            <CampaignSummary key={campaign.id} campaign={campaign} showProject={!projectId} />
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function CampaignSummary({
  campaign,
  showProject,
}: {
  campaign: OrganizationCampaign
  showProject: boolean
}) {
  const status = campaignStatusLabel(campaign.status)

  return (
    <li className="border-b border-border py-3.5 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className={campaignStatusClass[status]}>
          {status}
        </Badge>
        <Badge variant="secondary">{campaignTypeLabel(campaign.type)}</Badge>
        {campaign.archivedAt ? <Badge variant="secondary">Archived</Badge> : null}
      </div>
      <h3 className="mt-2 font-medium text-foreground">
        <Link
          href={`/workspaces/marketing/campaigns/${campaign.id}`}
          className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {campaign.name}
        </Link>
      </h3>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
        {campaign.description || "No description yet."}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {campaign.ownerName ?? "Owner unavailable"}
        {showProject ? (
          <>
            {" · "}
            <Link href={`/projects/${campaign.projectId}`} className="hover:underline">
              {campaign.projectName ?? "Project unavailable"}
            </Link>
          </>
        ) : null}
        {" · "}
        {dateRange(campaign.startsOn, campaign.endsOn)}
      </p>
    </li>
  )
}

function useCampaigns(organizationId: string, projectId: string | null) {
  const store = useMemo(
    () => createCampaignsStore(organizationId, projectId),
    [organizationId, projectId]
  )
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
}

function createCampaignsStore(organizationId: string, projectId: string | null) {
  const initial: CampaignsSnapshot = { status: "loading", campaigns: [] }
  let current = initial
  let generation = 0
  const listeners = new Set<() => void>()

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      const load = () => {
        const requestGeneration = ++generation
        const request = projectId
          ? getOrganizationProjectCampaigns(organizationId, projectId)
          : getOrganizationCampaigns(organizationId)
        void request
          .then((result) => {
            if (requestGeneration !== generation) return
            current = {
              status: result.status,
              campaigns: result.status === "ready" ? result.campaigns : [],
            }
            listeners.forEach((item) => item())
          })
          .catch(() => {
            if (requestGeneration !== generation) return
            current = { status: "error", campaigns: [] }
            listeners.forEach((item) => item())
          })
      }
      load()
      const stopRefresh = subscribeCampaignListRefresh(load)
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

type AccessSnapshot = { status: "loading" } | CampaignCreationAccess

function useCampaignAccess(
  userId: string,
  organizationId: string,
  projectId: string | null,
  enabled = true
) {
  const store = useMemo(
    () => createAccessStore(userId, organizationId, projectId, enabled),
    [userId, organizationId, projectId, enabled]
  )
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  )
  return { snapshot, reload: store.reload }
}

function createAccessStore(
  userId: string,
  organizationId: string,
  projectId: string | null,
  enabled: boolean
) {
  const initial: AccessSnapshot = { status: "loading" }
  let current: AccessSnapshot = initial
  let generation = 0
  const listeners = new Set<() => void>()

  const matchesRequest = (
    requestGeneration: number,
    requestUserId: string,
    requestOrganizationId: string,
    requestProjectId: string | null
  ) =>
    requestGeneration === generation &&
    requestUserId === userId &&
    requestOrganizationId === organizationId &&
    requestProjectId === projectId

  const load = () => {
    const requestGeneration = ++generation
    const requestUserId = userId
    const requestOrganizationId = organizationId
    const requestProjectId = projectId
    void getCampaignCreationAccess(organizationId, projectId)
      .then((result) => {
        if (
          !matchesRequest(
            requestGeneration,
            requestUserId,
            requestOrganizationId,
            requestProjectId
          )
        ) {
          return
        }
        current = result
        listeners.forEach((item) => item())
      })
      .catch(() => {
        if (
          !matchesRequest(
            requestGeneration,
            requestUserId,
            requestOrganizationId,
            requestProjectId
          )
        ) {
          return
        }
        current = { status: "error" }
        listeners.forEach((item) => item())
      })
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      if (!enabled) {
        return () => {
          listeners.delete(listener)
        }
      }
      current = initial
      load()
      const stopRefresh = subscribeCampaignListRefresh(load)
      return () => {
        listeners.delete(listener)
        generation += 1
        stopRefresh()
      }
    },
    reload() {
      if (!enabled) return
      current = { status: "loading" }
      listeners.forEach((item) => item())
      load()
    },
    getSnapshot() {
      return current
    },
    getServerSnapshot() {
      return initial
    },
  }
}

function isCreatableAccess(
  access: AccessSnapshot
): access is Extract<CampaignCreationAccess, { canCreate: true }> {
  return access.status === "ready" && access.canCreate
}

function CreateCampaignDialog({
  open,
  userId,
  organizationId,
  fixedProjectId,
  projects,
  listAccess,
  listProjectId,
  listReload,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  userId: string
  organizationId: string
  fixedProjectId: string | null
  projects: CampaignProjectOption[]
  listAccess: AccessSnapshot
  listProjectId: string | null
  listReload: () => void
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [projectId, setProjectId] = useState(fixedProjectId ?? projects[0]?.id ?? "")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [goals, setGoals] = useState("")
  const [type, setType] = useState<CampaignTypeValue>("content")
  const [status, setStatus] = useState<CampaignStatusValue>("planning")
  const [startsOn, setStartsOn] = useState("")
  const [endsOn, setEndsOn] = useState("")
  const [ownerId, setOwnerId] = useState("")
  const [appliedProject, setAppliedProject] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const savingRef = useRef(false)
  const ownsOwnerRequest = listProjectId !== projectId
  const ownAccess = useCampaignAccess(
    userId,
    organizationId,
    projectId || null,
    ownsOwnerRequest
  )
  const ownerAccess = ownsOwnerRequest ? ownAccess.snapshot : listAccess
  const reloadOwners = ownsOwnerRequest ? ownAccess.reload : listReload
  const owners =
    ownerAccess.status === "ready" && ownerAccess.canCreate ? ownerAccess.owners : []

  if (open && appliedProject !== projectId) {
    if (ownerAccess.status === "ready" && ownerAccess.canCreate) {
      setAppliedProject(projectId)
      setOwnerId(ownerAccess.defaultOwnerId ?? "")
    } else if (ownerId) {
      setOwnerId("")
    }
  }

  function handleOpenChange(next: boolean) {
    if (pending || savingRef.current) return
    onOpenChange(next)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (savingRef.current) return
    const campaignName = name.trim()
    if (!projectId) {
      setMessage("Choose a project.")
      return
    }
    if (!campaignName) {
      setMessage("Enter a campaign name.")
      return
    }
    if (!startsOn || !endsOn || !/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) {
      setMessage("Enter the start and end dates.")
      return
    }
    if (endsOn < startsOn) {
      setMessage("The end date must be on or after the start date.")
      return
    }
    if (!ownerId) {
      setMessage("Choose an owner from this project.")
      return
    }

    savingRef.current = true
    setPending(true)
    setMessage(null)
    try {
      const result = await createOrganizationCampaign({
        organizationId,
        projectId,
        name: campaignName,
        description: description.trim(),
        goals: goals.trim(),
        ownerId,
        type,
        status,
        startsOn,
        endsOn,
      })
      if (result.status === "created") {
        setPending(false)
        onCreated()
        return
      }
      setMessage(createMessage(result))
      setPending(false)
    } catch {
      setMessage("The campaign could not be created.")
      setPending(false)
    } finally {
      savingRef.current = false
    }
  }

  const projectItems = projects.map((project) => ({ value: project.id, label: project.name }))
  const ownerItems = owners.map((owner) => ({ value: owner.id, label: owner.name }))
  const selectedProject = projects.find((project) => project.id === projectId)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[min(40rem,calc(100vh-2rem))] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle>Create campaign</DialogTitle>
          <DialogDescription>
            Add a campaign to an active project you can write. It stays available from Marketing and that project.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
          {message ? (
            <p className="text-sm text-destructive" role="alert">
              {message}
            </p>
          ) : null}
          {fixedProjectId ? (
            <div className="grid gap-2">
              <Label>Project</Label>
              <p className="text-sm text-foreground">{selectedProject?.name ?? "This project"}</p>
            </div>
          ) : (
            <div className="grid gap-2">
              <Label id="create-campaign-project-label">Project</Label>
              <Select
                items={projectItems}
                value={projectId}
                onValueChange={(value) => {
                  if (value && value !== projectId) {
                    setProjectId(value)
                    setMessage(null)
                  }
                }}
              >
                <SelectTrigger
                  className="w-full"
                  disabled={pending}
                  aria-labelledby="create-campaign-project-label"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="create-campaign-name">Name</Label>
            <Input
              id="create-campaign-name"
              value={name}
              disabled={pending}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="create-campaign-description">Description</Label>
            <Textarea
              id="create-campaign-description"
              value={description}
              disabled={pending}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="create-campaign-goals">Goals</Label>
            <Textarea
              id="create-campaign-goals"
              value={goals}
              disabled={pending}
              onChange={(event) => setGoals(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label id="create-campaign-type-label">Type</Label>
              <Select
                items={campaignTypeValues.map((item) => ({
                  value: item,
                  label: campaignTypeLabel(item),
                }))}
                value={type}
                onValueChange={(value) => {
                  if (isCampaignType(value)) setType(value)
                }}
              >
                <SelectTrigger
                  className="w-full"
                  disabled={pending}
                  aria-labelledby="create-campaign-type-label"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {campaignTypeValues.map((item) => (
                    <SelectItem key={item} value={item}>
                      {campaignTypeLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label id="create-campaign-status-label">Status</Label>
              <Select
                items={campaignStatusValues.map((item) => ({
                  value: item,
                  label: campaignStatusLabel(item),
                }))}
                value={status}
                onValueChange={(value) => {
                  if (isCampaignStatus(value)) setStatus(value)
                }}
              >
                <SelectTrigger
                  className="w-full"
                  disabled={pending}
                  aria-labelledby="create-campaign-status-label"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {campaignStatusValues.map((item) => (
                    <SelectItem key={item} value={item}>
                      {campaignStatusLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label id="create-campaign-owner-label">Owner</Label>
            <OwnerChoices
              pending={pending}
              projectSelected={Boolean(projectId)}
              access={ownerAccess}
              owners={owners}
              ownerItems={ownerItems}
              ownerId={ownerId}
              onOwnerChange={setOwnerId}
              onRetry={reloadOwners}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="create-campaign-start">Start date</Label>
              <Input
                id="create-campaign-start"
                type="date"
                value={startsOn}
                disabled={pending}
                onChange={(event) => setStartsOn(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-campaign-end">End date</Label>
              <Input
                id="create-campaign-end"
                type="date"
                value={endsOn}
                disabled={pending}
                onChange={(event) => setEndsOn(event.target.value)}
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
              {pending ? "Saving…" : "Create campaign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function OwnerChoices({
  pending,
  projectSelected,
  access,
  owners,
  ownerItems,
  ownerId,
  onOwnerChange,
  onRetry,
}: {
  pending: boolean
  projectSelected: boolean
  access: AccessSnapshot
  owners: { id: string; name: string }[]
  ownerItems: { value: string; label: string }[]
  ownerId: string
  onOwnerChange: (ownerId: string) => void
  onRetry: () => void
}) {
  if (!projectSelected) {
    return <p className="text-sm text-muted-foreground">Choose a project.</p>
  }
  if (access.status === "loading") {
    return (
      <Select items={[]} value="">
        <SelectTrigger
          className="w-full"
          disabled
          aria-labelledby="create-campaign-owner-label"
        >
          <SelectValue placeholder="Loading owners…" />
        </SelectTrigger>
        <SelectContent />
      </Select>
    )
  }
  if (access.status === "error" || access.status === "rejected") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground" role="alert">
          {access.status === "rejected"
            ? "This organization is not available for your account."
            : "Owners could not be loaded."}
        </p>
        <Button type="button" variant="outline" disabled={pending} onClick={onRetry}>
          Try again
        </Button>
      </div>
    )
  }
  if (!access.canCreate) {
    return <p className="text-sm text-muted-foreground">This project is not available.</p>
  }
  if (owners.length === 0) {
    return <p className="text-sm text-muted-foreground">No project members available</p>
  }

  return (
    <Select
      items={ownerItems}
      value={ownerId}
      onValueChange={(value) => {
        if (value) onOwnerChange(value)
      }}
    >
      <SelectTrigger
        className="w-full"
        disabled={pending}
        aria-labelledby="create-campaign-owner-label"
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
  )
}

function createMessage(
  result: Exclude<Awaited<ReturnType<typeof createOrganizationCampaign>>, { status: "created" }>
) {
  if (result.status === "invalid") return result.message
  if (result.status === "denied") return "You do not have permission to create a campaign here."
  if (result.status === "conflict") {
    return "A campaign in this organization already uses that name. Try a different name."
  }
  if (result.status === "unavailable") return "This project is not available."
  if (result.status === "rejected") return "This organization is not available for your account."
  return "The campaign could not be created."
}

function isCampaignType(value: string | null): value is CampaignTypeValue {
  return campaignTypeValues.some((type) => type === value)
}

function isCampaignStatus(value: string | null): value is CampaignStatusValue {
  return campaignStatusValues.some((status) => status === value)
}
