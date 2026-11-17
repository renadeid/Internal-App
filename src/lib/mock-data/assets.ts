import type {
  Asset,
  AssetComment,
  AssetType,
  AssetVersion,
} from "@/lib/types"

export function assetPath(id: string) {
  return `/assets/${id}` as const
}

export function kindForType(type: AssetType) {
  if (type === "Image") return "Image"
  if (type === "Video") return "Video"
  if (type === "Document") return "Document"
  if (type === "Presentation") return "Deck"
  if (type === "Design") return "Design file"
  if (type === "External Link") return "Link"
  return "Other"
}

export const visibilityLabel = {
  Company: "Company-wide",
  "Project Members": "Project members",
  Restricted: "Restricted",
} as const

export const visibilityNote =
  "Visibility is simulated in this demo. These labels do not securely restrict who can open a file."

export const initialAssets: Asset[] = [
  {
    id: "asset-wordmark",
    name: "Field Notes wordmark",
    description: "Horizontal lockup for light backgrounds. Use the clear-space guide in the brand system.",
    type: "Image",
    kind: "Logo",
    tags: ["brand", "logo", "field-notes"],
    ownerId: "jonah",
    projectId: "brand",
    visibility: "Company",
    collection: "Brand system",
    archived: false,
    createdAt: "2026-03-12T10:00",
    updatedAt: "2026-04-07T15:10",
    updatedLabel: "Updated yesterday",
  },
  {
    id: "asset-photos",
    name: "Launch photography, set 04",
    description: "Selected frames from the studio shoot for the Field Notes launch.",
    type: "Image",
    kind: "Photography",
    tags: ["photography", "launch"],
    ownerId: "jonah",
    projectId: "brand",
    visibility: "Company",
    collection: "Brand system",
    archived: false,
    createdAt: "2026-03-20T11:20",
    updatedAt: "2026-04-08T09:40",
    updatedLabel: "Updated today",
  },
  {
    id: "asset-interview",
    name: "Harbor Clinic interview cut",
    description: "Ninety-second customer film from the Harbor Clinic field visit.",
    type: "Video",
    kind: "Video",
    tags: ["video", "customer", "harbor"],
    ownerId: "priya",
    projectId: "harbor",
    campaignId: "campaign-harbor",
    visibility: "Project Members",
    collection: "Customer stories",
    archived: false,
    createdAt: "2026-04-02T14:00",
    updatedAt: "2026-04-08T11:15",
    updatedLabel: "Shared 2 hours ago",
  },
  {
    id: "asset-color",
    name: "Spring campaign color board",
    description: "Palette and type pairings for the spring launch materials.",
    type: "Design",
    kind: "Design file",
    tags: ["color", "brand", "spring"],
    ownerId: "jonah",
    projectId: "brand",
    campaignId: "campaign-launch",
    visibility: "Company",
    collection: "Brand system",
    archived: false,
    createdAt: "2026-03-18T13:30",
    updatedAt: "2026-04-06T16:00",
    updatedLabel: "Updated Monday",
  },
  {
    id: "asset-onepager",
    name: "Sales one-pager",
    description: "One-page leave-behind for the Field Notes sales kit.",
    type: "Document",
    kind: "Document",
    tags: ["sales", "launch", "copy"],
    ownerId: "amira",
    projectId: "spring",
    campaignId: "campaign-launch",
    visibility: "Project Members",
    collection: "Field Notes launch",
    archived: false,
    createdAt: "2026-03-28T09:00",
    updatedAt: "2026-04-08T10:05",
    updatedLabel: "Updated today",
  },
  {
    id: "asset-screens",
    name: "Product UI screens, light",
    description: "Light-theme product frames used in the homepage and sales kit.",
    type: "Design",
    kind: "Design file",
    tags: ["product", "ui"],
    ownerId: "nolan",
    projectId: "spring",
    campaignId: "campaign-launch",
    visibility: "Restricted",
    collection: "Field Notes launch",
    archived: false,
    createdAt: "2026-03-25T15:45",
    updatedAt: "2026-04-06T12:20",
    updatedLabel: "Updated Monday",
  },
  {
    id: "asset-matrix",
    name: "Q2 messaging matrix",
    description: "Channel messages for the quarter after the Field Notes launch.",
    type: "Document",
    kind: "Document",
    tags: ["messaging", "demand"],
    ownerId: "leo",
    projectId: "demand",
    campaignId: "campaign-demand",
    visibility: "Project Members",
    collection: "Demand",
    archived: false,
    createdAt: "2026-04-01T08:30",
    updatedAt: "2026-04-07T17:00",
    updatedLabel: "Updated yesterday",
  },
  {
    id: "asset-illustrations",
    name: "Onboarding cover illustrations",
    description: "Cover art for the new-hire workspace kit.",
    type: "Image",
    kind: "Illustration",
    tags: ["illustration", "onboarding"],
    ownerId: "jonah",
    projectId: "onboarding",
    visibility: "Company",
    collection: "People",
    archived: false,
    createdAt: "2026-03-02T10:10",
    updatedAt: "2026-03-30T14:25",
    updatedLabel: "Updated last week",
  },
  {
    id: "asset-preview",
    name: "Homepage preview",
    description: "Staging preview of the Field Notes homepage.",
    type: "External Link",
    kind: "Link",
    url: "https://preview.northline.example/field-notes",
    href: "https://preview.northline.example/field-notes",
    tags: ["web", "preview", "launch"],
    ownerId: "nolan",
    projectId: "spring",
    campaignId: "campaign-launch",
    visibility: "Company",
    collection: "Field Notes launch",
    archived: false,
    createdAt: "2026-04-04T09:15",
    updatedAt: "2026-04-07T18:40",
    updatedLabel: "Updated yesterday",
  },
]

export const initialAssetComments: AssetComment[] = [
  {
    id: "comment-wordmark",
    assetId: "asset-wordmark",
    authorId: "jonah",
    body: "Use the horizontal lockup on light backgrounds.",
    createdAt: "2026-04-07T15:12",
    resolved: false,
  },
  {
    id: "comment-onepager-cover",
    assetId: "asset-onepager",
    authorId: "maya",
    body: "The cover still says March. Please update it before review.",
    createdAt: "2026-04-08T10:20",
    resolved: false,
  },
  {
    id: "comment-onepager-ready",
    assetId: "asset-onepager",
    authorId: "amira",
    body: "Copy is ready for the sales review once the date is fixed.",
    createdAt: "2026-04-08T10:40",
    resolved: false,
  },
  {
    id: "comment-interview",
    assetId: "asset-interview",
    authorId: "priya",
    body: "Picture lock is the 90 second cut.",
    createdAt: "2026-04-08T11:20",
    resolved: true,
  },
]

export const initialAssetVersions: AssetVersion[] = [
  version("asset-wordmark", 1, "First lockup", "2026-03-12T10:00", "jonah", "Initial wordmark."),
  version("asset-wordmark", 2, "Clear space", "2026-04-07T15:10", "jonah", "Added the clear-space guide."),
  version("asset-photos", 1, "Selects", "2026-04-08T09:40", "jonah", "Set 04 selects."),
  version("asset-interview", 1, "Picture lock", "2026-04-08T11:15", "priya", "Ninety-second cut."),
  version("asset-color", 1, "Spring palette", "2026-04-06T16:00", "jonah", "Palette for launch materials."),
  version("asset-onepager", 1, "Draft", "2026-03-28T09:00", "amira", "First sales draft."),
  version("asset-onepager", 2, "Review copy", "2026-04-08T10:05", "amira", "Updated the offer and proof points."),
  version("asset-screens", 1, "Light frames", "2026-04-06T12:20", "nolan", "Light theme product frames."),
  version("asset-matrix", 1, "Q2 draft", "2026-04-07T17:00", "leo", "Channel messages after launch."),
  version("asset-illustrations", 1, "Covers", "2026-03-30T14:25", "jonah", "New-hire cover illustrations."),
  version("asset-preview", 1, "Staging link", "2026-04-07T18:40", "nolan", "Homepage staging preview."),
]

function version(
  assetId: string,
  number: number,
  label: string,
  date: string,
  authorId: string,
  notes: string
): AssetVersion {
  return {
    id: `version-${assetId}-${number}`,
    assetId,
    number,
    label,
    date,
    authorId,
    notes,
  }
}
