import { assetPath } from "@/lib/mock-data/assets"
import { artifacts } from "@/lib/mock-data/library"
import { milestones } from "@/lib/mock-data/milestones"
import type {
  ActivityItem,
  Asset,
  Campaign,
  Department,
  Project,
  Task,
} from "@/lib/types"

export type FileGroup = "Designs" | "Documents" | "Presentations" | "Links"

export type ProjectFile = {
  id: string
  name: string
  kind: string
  ownerId: string
  updatedLabel: string
  href: string
  external: boolean
  group: FileGroup
}

const designKinds = new Set([
  "Logo",
  "Design file",
  "Illustration",
  "Photography",
  "Video",
  "Image",
  "Design",
])

const documentKinds = new Set([
  "Document",
  "Brief",
  "Checklist",
  "Guidelines",
])

export function collaboratingDepartments(project: Project): Department[] {
  return [
    project.department,
    ...project.departments.filter((department) => department !== project.department),
  ]
}

export function tasksForProject(tasks: Task[], projectId: string) {
  return tasks.filter((task) => task.projectId === projectId)
}

export function campaignsForProject(campaigns: Campaign[], projectId: string) {
  return campaigns.filter((campaign) => campaign.projectId === projectId)
}

export function activityForProject(activity: ActivityItem[], projectId: string) {
  return activity.filter((item) => item.projectId === projectId)
}

export function milestonesForProject(projectId: string) {
  return milestones.filter((milestone) => milestone.projectId === projectId)
}

export function filesForProject(assets: Asset[], projectId: string): ProjectFile[] {
  const linkedAssets = assets
    .filter((asset) => asset.projectId === projectId && !asset.archived)
    .map((asset) => toFile(asset, asset.href ?? asset.url, false))

  const linkedArtifacts = artifacts
    .filter((artifact) => artifact.projectId === projectId)
    .map((artifact) => toFile(artifact, undefined, true))

  return [...linkedAssets, ...linkedArtifacts]
}

function toFile(
  item: {
    id: string
    name: string
    kind: string
    ownerId: string
    updatedLabel: string
  },
  href: string | undefined,
  artifact: boolean
): ProjectFile {
  const external = Boolean(href && /^https?:\/\//.test(href))
  return {
    id: item.id,
    name: item.name,
    kind: item.kind,
    ownerId: item.ownerId,
    updatedLabel: item.updatedLabel,
    href: external ? href! : artifact ? "/artifacts" : assetPath(item.id),
    external,
    group: fileGroup(item.kind, external),
  }
}

function fileGroup(kind: string, external: boolean): FileGroup {
  if (external || kind === "Link") return "Links"
  if (kind === "Deck") return "Presentations"
  if (documentKinds.has(kind)) return "Documents"
  if (designKinds.has(kind)) return "Designs"
  return "Documents"
}
