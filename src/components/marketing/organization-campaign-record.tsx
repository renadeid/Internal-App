"use client"

import { useMemo, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"

import { useCurrentIdentity } from "@/components/auth/current-identity-provider"
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
import {
  refreshOrganizationCampaigns,
  subscribeCampaignListRefresh,
} from "@/lib/auth/campaign-list-refresh"
import {
  getOrganizationCampaignUpdateAccess,
  setOrganizationCampaignStatus,
  updateOrganizationCampaign,
} from "@/lib/auth/campaign-update-actions"
import { getOrganizationCampaign } from "@/lib/auth/get-organization-campaigns"
import {
  campaignStatusLabel,
  campaignStatusValues,
  campaignTypeLabel,
  campaignTypeValues,
  type CampaignOwnerOption,
  type CampaignStatusValue,
  type CampaignTypeValue,
  type CampaignUpdateAccess,
  type OrganizationCampaign,
  type OrganizationCampaignResult,
  type SetCampaignStatusResult,
  type UpdateCampaignResult,
} from "@/lib/auth/organization-campaigns"
import { dateRange } from "@/lib/dates"
import { campaignStatusClass, surfaceClass } from "@/lib/presentation"

type CampaignSnapshot = {
  status: "loading" | OrganizationCampaignResult["status"]
  campaign: OrganizationCampaign | null
}

type AccessSnapshot = { status: "loading" } | CampaignUpdateAccess

export function OrganizationCampaignRecord({ campaignId }: { campaignId: string }) {
  const identity = useCurrentIdentity()
  const { activeOrganization, mode } = useOrganization()

  if (!activeOrganization) {
    const message =
      mode === "multiple"
        ? "Select an organization in the sidebar to open this campaign."
        : mode === "unavailable"
          ? "Organization is unavailable."
          : "No organization is available."
    return <CampaignNotice title="Campaign unavailable" message={message} />
  }

  return (
    <CampaignBody
      key={`${identity.profileId}:${activeOrganization.id}:${campaignId}`}
      userId={identity.profileId}
      organizationId={activeOrganization.id}
      organizationName={activeOrganization.name}
      campaignId={campaignId}
    />
  )
}

function CampaignBody({
  userId,
  organizationId,
  organizationName,
  campaignId,
}: {
  userId: string
  organizationId: string
  organizationName: string
  campaignId: string
}) {
  const snapshot = useCampaign(userId, organizationId, campaignId)
  const { snapshot: access, retry: retryAccess } = useCampaignUpdateAccess(
    userId,
    organizationId,
    campaignId
  )
  const [editOpen, setEditOpen] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusPending, setStatusPending] = useState(false)
  const statusRef = useRef(false)
  const canEdit = access.status === "ready" && access.canEdit
  const owners = canEdit ? access.owners : []

  async function changeStatus(nextStatus: string | null) {
    if (!snapshot.campaign || statusRef.current || !isCampaignStatus(nextStatus)) return
    if (nextStatus === snapshot.campaign.status) return
    statusRef.current = true
    setStatusPending(true)
    setStatusMessage(null)
    try {
      const result = await setOrganizationCampaignStatus({
        organizationId,
        campaignId,
        status: nextStatus,
      })
      if (result.status === "updated") refreshOrganizationCampaigns()
      else setStatusMessage(statusMessageFor(result))
    } catch {
      setStatusMessage("The campaign status could not be changed.")
    } finally {
      statusRef.current = false
      setStatusPending(false)
    }
  }

  if (snapshot.status === "loading") {
    return (
      <CampaignNotice
        title="Loading campaign"
        message={`Loading this campaign in ${organizationName}…`}
      />
    )
  }
  if (snapshot.status === "error") {
    return (
      <CampaignNotice title="Campaign unavailable" message="This campaign could not be loaded." />
    )
  }
  if (snapshot.status === "rejected") {
    return (
      <CampaignNotice
        title="Campaign unavailable"
        message="This organization is not available for your account."
      />
    )
  }
  if (snapshot.status === "missing" || !snapshot.campaign) {
    return (
      <CampaignNotice
        title="Campaign not available"
        message={`This campaign is not available in ${organizationName}. It may be private, or it may not exist in this organization.`}
      />
    )
  }

  const campaign = snapshot.campaign
  const status = campaignStatusLabel(campaign.status)

  return (
    <div className="flex flex-col gap-6">
      <section className={`${surfaceClass} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className={campaignStatusClass[status]}>
              {status}
            </Badge>
            <Badge variant="secondary">{campaignTypeLabel(campaign.type)}</Badge>
            {campaign.archivedAt ? <Badge variant="secondary">Archived</Badge> : null}
          </div>
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <Select
                items={campaignStatusValues.map((item) => ({
                  value: item,
                  label: campaignStatusLabel(item),
                }))}
                value={campaign.status}
                onValueChange={(value) => void changeStatus(value)}
              >
                <SelectTrigger
                  className="w-40"
                  disabled={statusPending}
                  aria-label="Campaign status"
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
              <Button type="button" disabled={statusPending} onClick={() => setEditOpen(true)}>
                Edit campaign
              </Button>
            </div>
          ) : access.status === "loading" ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Checking edit permission…
            </p>
          ) : access.status === "error" || access.status === "rejected" ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-destructive" role="alert">
                {access.status === "rejected"
                  ? "This organization is not available for your account."
                  : "Edit permission could not be checked."}
              </p>
              <Button type="button" variant="outline" onClick={retryAccess}>
                Retry
              </Button>
            </div>
          ) : null}
        </div>
        {statusMessage ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {statusMessage}
          </p>
        ) : null}
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{campaign.name}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {campaign.description || "No description yet."}
        </p>
        <dl className="mt-6 grid gap-4 border-t border-border pt-5 text-sm sm:grid-cols-2">
          <Fact label="Organization" value={organizationName} />
          <Fact label="Project" value={campaign.projectName ?? "Not available"} />
          <Fact label="Owner" value={campaign.ownerName ?? "Not available"} />
          <Fact label="Dates" value={dateRange(campaign.startsOn, campaign.endsOn)} />
          <Fact label="Goals" value={campaign.goals || "No goals yet."} />
        </dl>
      </section>
      <div className="flex flex-wrap gap-2">
        <Link href="/workspaces/marketing" className={buttonVariants({ variant: "outline" })}>
          Back to Marketing
        </Link>
        <Link
          href={`/projects/${campaign.projectId}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Open project
        </Link>
      </div>
      {canEdit ? (
        <EditCampaignDialog
          open={editOpen}
          campaign={campaign}
          organizationId={organizationId}
          owners={owners}
          onOpenChange={setEditOpen}
        />
      ) : null}
    </div>
  )
}

function EditCampaignDialog({
  open,
  campaign,
  organizationId,
  owners,
  onOpenChange,
}: {
  open: boolean
  campaign: OrganizationCampaign
  organizationId: string
  owners: CampaignOwnerOption[]
  onOpenChange: (open: boolean) => void
}) {
  const [name, setName] = useState(campaign.name)
  const [description, setDescription] = useState(campaign.description)
  const [goals, setGoals] = useState(campaign.goals)
  const [ownerId, setOwnerId] = useState(
    owners.some((owner) => owner.id === campaign.ownerId) ? campaign.ownerId : ""
  )
  const [type, setType] = useState<CampaignTypeValue>(campaign.type)
  const [status, setStatus] = useState<CampaignStatusValue>(campaign.status)
  const [startsOn, setStartsOn] = useState(dateInputValue(campaign.startsOn))
  const [endsOn, setEndsOn] = useState(dateInputValue(campaign.endsOn))
  const [formSession, setFormSession] = useState(open)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const savingRef = useRef(false)

  if (open !== formSession) {
    setFormSession(open)
    if (open) {
      setName(campaign.name)
      setDescription(campaign.description)
      setGoals(campaign.goals)
      setOwnerId(owners.some((owner) => owner.id === campaign.ownerId) ? campaign.ownerId : "")
      setType(campaign.type)
      setStatus(campaign.status)
      setStartsOn(dateInputValue(campaign.startsOn))
      setEndsOn(dateInputValue(campaign.endsOn))
      setMessage(null)
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
    if (!campaignName) {
      setMessage("Enter a campaign name.")
      return
    }
    if (!ownerId) {
      setMessage("Choose an owner from this project.")
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

    savingRef.current = true
    setPending(true)
    setMessage(null)
    try {
      const result = await updateOrganizationCampaign({
        organizationId,
        campaignId: campaign.id,
        name: campaignName,
        description: description.trim(),
        goals: goals.trim(),
        ownerId,
        type,
        status,
        startsOn,
        endsOn,
      })
      if (result.status === "updated") {
        setPending(false)
        onOpenChange(false)
        refreshOrganizationCampaigns()
        return
      }
      setMessage(editMessage(result))
      setPending(false)
    } catch {
      setMessage("The campaign could not be saved.")
      setPending(false)
    } finally {
      savingRef.current = false
    }
  }

  const ownerItems = owners.map((owner) => ({ value: owner.id, label: owner.name }))

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[min(40rem,calc(100vh-2rem))] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle>Edit campaign</DialogTitle>
          <DialogDescription>
            Update this campaign in {campaign.projectName ?? "its project"}. The project and address stay the same.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
          {message ? (
            <p className="text-sm text-destructive" role="alert">
              {message}
            </p>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="edit-campaign-name">Name</Label>
            <Input
              id="edit-campaign-name"
              value={name}
              disabled={pending}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-campaign-description">Description</Label>
            <Textarea
              id="edit-campaign-description"
              value={description}
              disabled={pending}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-campaign-goals">Goals</Label>
            <Textarea
              id="edit-campaign-goals"
              value={goals}
              disabled={pending}
              onChange={(event) => setGoals(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label id="edit-campaign-type-label">Type</Label>
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
                  aria-labelledby="edit-campaign-type-label"
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
              <Label id="edit-campaign-status-label">Status</Label>
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
                  aria-labelledby="edit-campaign-status-label"
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
            <Label id="edit-campaign-owner-label">Owner</Label>
            <Select
              items={ownerItems}
              value={ownerId}
              onValueChange={(value) => {
                if (value) setOwnerId(value)
              }}
            >
              <SelectTrigger
                className="w-full"
                disabled={pending || owners.length === 0}
                aria-labelledby="edit-campaign-owner-label"
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
              <Label htmlFor="edit-campaign-start">Start date</Label>
              <Input
                id="edit-campaign-start"
                type="date"
                value={startsOn}
                disabled={pending}
                onChange={(event) => setStartsOn(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-campaign-end">End date</Label>
              <Input
                id="edit-campaign-end"
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
              {pending ? "Saving…" : "Save campaign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  )
}

function CampaignNotice({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-3 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm leading-6 text-muted-foreground">{message}</p>
      <Link href="/workspaces/marketing" className={buttonVariants({ variant: "outline" })}>
        Back to Marketing
      </Link>
    </div>
  )
}

function useCampaign(userId: string, organizationId: string, campaignId: string) {
  const store = useMemo(
    () => createCampaignStore(userId, organizationId, campaignId),
    [userId, organizationId, campaignId]
  )
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
}

function createCampaignStore(userId: string, organizationId: string, campaignId: string) {
  const initial: CampaignSnapshot = { status: "loading", campaign: null }
  let current = initial
  let generation = 0
  const listeners = new Set<() => void>()

  const load = () => {
    const requestGeneration = ++generation
    const requestUserId = userId
    const requestOrganizationId = organizationId
    const requestCampaignId = campaignId
    void getOrganizationCampaign(organizationId, campaignId)
      .then((result) => {
        if (
          requestGeneration !== generation ||
          requestUserId !== userId ||
          requestOrganizationId !== organizationId ||
          requestCampaignId !== campaignId
        ) {
          return
        }
        current = {
          status: result.status,
          campaign: result.status === "ready" ? result.campaign : null,
        }
        listeners.forEach((item) => item())
      })
      .catch(() => {
        if (
          requestGeneration !== generation ||
          requestUserId !== userId ||
          requestOrganizationId !== organizationId ||
          requestCampaignId !== campaignId
        ) {
          return
        }
        current = { status: "error", campaign: null }
        listeners.forEach((item) => item())
      })
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      current = initial
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

function useCampaignUpdateAccess(userId: string, organizationId: string, campaignId: string) {
  const store = useMemo(
    () => createUpdateAccessStore(userId, organizationId, campaignId),
    [userId, organizationId, campaignId]
  )
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  )
  return { snapshot, retry: store.retry }
}

function createUpdateAccessStore(userId: string, organizationId: string, campaignId: string) {
  const initial: AccessSnapshot = { status: "loading" }
  let current: AccessSnapshot = initial
  let generation = 0
  const listeners = new Set<() => void>()

  const matches = (
    requestGeneration: number,
    requestUserId: string,
    requestOrganizationId: string,
    requestCampaignId: string
  ) =>
    requestGeneration === generation &&
    requestUserId === userId &&
    requestOrganizationId === organizationId &&
    requestCampaignId === campaignId &&
    listeners.size > 0

  const publish = (snapshot: AccessSnapshot) => {
    current = snapshot
    listeners.forEach((listener) => listener())
  }

  const load = () => {
    const requestGeneration = ++generation
    const requestUserId = userId
    const requestOrganizationId = organizationId
    const requestCampaignId = campaignId
    void getOrganizationCampaignUpdateAccess(organizationId, campaignId)
      .then((result) => {
        if (
          !matches(
            requestGeneration,
            requestUserId,
            requestOrganizationId,
            requestCampaignId
          )
        ) {
          return
        }
        publish(result)
      })
      .catch(() => {
        if (
          !matches(
            requestGeneration,
            requestUserId,
            requestOrganizationId,
            requestCampaignId
          )
        ) {
          return
        }
        publish({ status: "error" })
      })
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      const stopRefresh = subscribeCampaignListRefresh(load)
      const scheduledGeneration = generation
      // The request starts after subscribe returns. Starting it inside subscribe
      // lets React's immediate cleanup invalidate the only in-flight check.
      queueMicrotask(() => {
        if (!listeners.has(listener) || generation !== scheduledGeneration) return
        load()
      })
      return () => {
        listeners.delete(listener)
        generation += 1
        stopRefresh()
      }
    },
    retry() {
      if (listeners.size === 0) return
      publish(initial)
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

function editMessage(result: Exclude<UpdateCampaignResult, { status: "updated" }>) {
  if (result.status === "invalid") return result.message
  if (result.status === "denied") return "You do not have permission to edit this campaign."
  if (result.status === "conflict") return "This campaign conflicts with an existing record."
  if (result.status === "unavailable") return "This campaign is not available to edit."
  if (result.status === "rejected") return "This organization is not available for your account."
  return "The campaign could not be saved."
}

function statusMessageFor(result: Exclude<SetCampaignStatusResult, { status: "updated" }>) {
  if (result.status === "invalid") return result.message
  if (result.status === "denied") return "You do not have permission to change this status."
  if (result.status === "unavailable") return "This campaign is not available to update."
  if (result.status === "rejected") return "This organization is not available for your account."
  return "The campaign status could not be changed."
}

function dateInputValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : ""
}

function isCampaignType(value: string | null): value is CampaignTypeValue {
  return campaignTypeValues.some((type) => type === value)
}

function isCampaignStatus(value: string | null): value is CampaignStatusValue {
  return campaignStatusValues.some((status) => status === value)
}
