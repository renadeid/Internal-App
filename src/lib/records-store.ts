import { marketingManagerId } from "@/lib/mock-data/team"
import type {
  ActivityItem,
  Asset,
  AssetComment,
  AssetVersion,
  Campaign,
  CampaignInput,
  Deliverable,
  DeliverableStatus,
  Task,
} from "@/lib/types"

export type Records = {
  campaigns: Campaign[]
  tasks: Task[]
  deliverables: Deliverable[]
  activity: ActivityItem[]
  assets: Asset[]
  assetComments: AssetComment[]
  assetVersions: AssetVersion[]
}

const STORAGE_KEY = "company-hub.records.v1"

function seed(): Records {
  return {
    campaigns: [],
    tasks: [],
    deliverables: [],
    activity: [],
    assets: [],
    assetComments: [],
    assetVersions: [],
  }
}

const serverSnapshot = JSON.stringify(seed())

const listeners = new Set<() => void>()
let snapshot = serverSnapshot

function isCampaign(value: unknown): value is Campaign {
  if (!value || typeof value !== "object") return false
  const item = value as Campaign
  return Boolean(item.id && item.projectId && item.name && item.status && item.type)
}

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== "object") return false
  const item = value as Task
  return Boolean(item.id && item.projectId && item.title && item.status)
}

function isDeliverable(value: unknown): value is Deliverable {
  if (!value || typeof value !== "object") return false
  const item = value as Deliverable
  return Boolean(item.id && item.campaignId && item.title && item.status)
}

function isActivity(value: unknown): value is ActivityItem {
  if (!value || typeof value !== "object") return false
  const item = value as ActivityItem
  return Boolean(item.id && item.actorId && item.summary && item.href)
}

function isAsset(value: unknown): value is Asset {
  if (!value || typeof value !== "object") return false
  const item = value as Asset
  return Boolean(
    item.id &&
      item.name &&
      item.type &&
      item.ownerId &&
      item.visibility &&
      Array.isArray(item.tags) &&
      typeof item.archived === "boolean"
  )
}

function isAssetComment(value: unknown): value is AssetComment {
  if (!value || typeof value !== "object") return false
  const item = value as AssetComment
  return Boolean(item.id && item.assetId && item.authorId && item.body)
}

function isAssetVersion(value: unknown): value is AssetVersion {
  if (!value || typeof value !== "object") return false
  const item = value as AssetVersion
  return Boolean(item.id && item.assetId && item.label && item.number)
}

export function parseRecords(raw: string): Records {
  const seeded = JSON.parse(serverSnapshot) as Records
  try {
    const data = JSON.parse(raw) as Partial<Records>
    if (
      !Array.isArray(data.campaigns) ||
      !Array.isArray(data.tasks) ||
      !Array.isArray(data.deliverables) ||
      !Array.isArray(data.activity) ||
      !data.campaigns.every(isCampaign) ||
      !data.tasks.every(isTask) ||
      !data.deliverables.every(isDeliverable) ||
      !data.activity.every(isActivity)
    ) {
      return seeded
    }
    return {
      campaigns: data.campaigns,
      tasks: data.tasks,
      deliverables: data.deliverables,
      activity: data.activity,
      assets:
        Array.isArray(data.assets) && data.assets.every(isAsset)
          ? data.assets
          : seeded.assets,
      assetComments:
        Array.isArray(data.assetComments) && data.assetComments.every(isAssetComment)
          ? data.assetComments
          : seeded.assetComments,
      assetVersions:
        Array.isArray(data.assetVersions) && data.assetVersions.every(isAssetVersion)
          ? data.assetVersions
          : seeded.assetVersions,
    }
  } catch {
    return seeded
  }
}

function readStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return serverSnapshot
    const parsed = parseRecords(stored)
    const normalized = JSON.stringify(parsed)
    return normalized
  } catch {
    return serverSnapshot
  }
}

export function subscribeRecords(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return
    snapshot = event.newValue && parseRecords(event.newValue) ? event.newValue : serverSnapshot
    listener()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

export function getRecordsSnapshot() {
  const next = readStorage()
  if (next !== snapshot) snapshot = next
  return snapshot
}

export function getRecordsServerSnapshot() {
  return serverSnapshot
}

export function updateRecords(change: (current: Records) => Records) {
  const next = change(parseRecords(getRecordsSnapshot()))
  snapshot = JSON.stringify(next)
  try {
    localStorage.setItem(STORAGE_KEY, snapshot)
  } catch {
    // The in-memory snapshot still updates this tab when storage is blocked.
  }
  listeners.forEach((listener) => listener())
}

export function canSubmitDeliverable(
  actorId: string,
  status: DeliverableStatus,
  creatorId: string
) {
  return (
    actorId === creatorId &&
    (status === "Draft" || status === "In Progress" || status === "Changes Requested")
  )
}

export function canStartDeliverable(
  actorId: string,
  status: DeliverableStatus,
  creatorId: string
) {
  return actorId === creatorId && (status === "Draft" || status === "Changes Requested")
}

export function canReviewDeliverable(actorId: string, status: DeliverableStatus) {
  return actorId === marketingManagerId && status === "Submitted"
}

export function campaignProgress(
  campaignId: string,
  tasks: Task[],
  deliverables: Deliverable[]
) {
  const taskItems = tasks.filter((task) => task.campaignId === campaignId)
  const deliverableItems = deliverables.filter(
    (item) => item.campaignId === campaignId
  )
  const total = taskItems.length + deliverableItems.length
  if (total === 0) return 0
  const done =
    taskItems.filter((task) => task.status === "Done").length +
    deliverableItems.filter((item) => item.status === "Approved").length
  return Math.round((done / total) * 100)
}

export function createCampaignRecord(input: CampaignInput, id: string): Campaign {
  return {
    id,
    name: input.name,
    description: input.description,
    projectId: input.projectId,
    ownerId: input.ownerId,
    type: input.type,
    status: input.status,
    startDate: input.startDate,
    endDate: input.endDate,
    goals: input.goals,
  }
}
