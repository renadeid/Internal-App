"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Folder, Images, Layers, LayoutGrid, List } from "lucide-react"

import { AssetFormDialog } from "@/components/assets/asset-form-dialog"
import { AssetDownloadButton } from "@/components/assets/asset-download-button"
import { AssetMark } from "@/components/assets/asset-mark"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { PageIntro } from "@/components/shared/page-intro"
import { useWorkspace } from "@/components/workspace/workspace-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatStamp } from "@/lib/dates"
import { assetPath, visibilityLabel, visibilityNote } from "@/lib/mock-data/assets"
import { getProjectName } from "@/lib/mock-data/projects"
import { getMember, team } from "@/lib/mock-data/team"
import { surfaceClass } from "@/lib/presentation"
import {
  assetTypes,
  type Asset,
  type AssetInput,
  type AssetType,
} from "@/lib/types"

type TypeFilter = "All" | AssetType
type SortKey = "newest" | "name" | "type"

const typeFilters: TypeFilter[] = ["All", ...assetTypes]
const sortItems = [
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name" },
  { value: "type", label: "Type" },
]

function blankAsset(ownerId: string): AssetInput {
  return {
    name: "",
    description: "",
    type: "Image",
    url: "",
    tags: [],
    ownerId,
    projectId: "",
    campaignId: "",
    visibility: "Company",
    collection: "",
  }
}

export function AssetsLibrary() {
  const { projects, campaigns, assets, actorId, createAsset, canCreateRecords } = useWorkspace()
  const [query, setQuery] = useState("")
  const [type, setType] = useState<TypeFilter>("All")
  const [projectId, setProjectId] = useState("all")
  const [campaignId, setCampaignId] = useState("all")
  const [ownerId, setOwnerId] = useState("all")
  const [collection, setCollection] = useState("all")
  const [sort, setSort] = useState<SortKey>("newest")
  const [view, setView] = useState<"grid" | "list">("grid")
  const [showArchived, setShowArchived] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formSession, setFormSession] = useState(0)

  const collections = useMemo(() => {
    return [...new Set(assets.map((asset) => asset.collection))].sort()
  }, [assets])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matched = assets.filter((asset) => {
      if (!showArchived && asset.archived) return false
      const haystack = `${asset.name} ${asset.description} ${asset.tags.join(" ")}`.toLowerCase()
      if (needle && !haystack.includes(needle)) return false
      if (type !== "All" && asset.type !== type) return false
      if (projectId !== "all" && asset.projectId !== projectId) return false
      if (campaignId !== "all" && asset.campaignId !== campaignId) return false
      if (ownerId !== "all" && asset.ownerId !== ownerId) return false
      if (collection !== "all" && asset.collection !== collection) return false
      return true
    })
    return matched.sort((left, right) => compareAssets(left, right, sort))
  }, [assets, campaignId, collection, ownerId, projectId, query, showArchived, sort, type])

  const active = assets.filter((asset) => !asset.archived)
  const recent = active.filter((asset) => asset.createdAt >= "2026-04-01").length
  const typeCount = new Set(active.map((asset) => asset.type)).size
  const projectItems = [
    { value: "all", label: "All projects" },
    ...projects.map((project) => ({ value: project.id, label: project.name })),
  ]
  const campaignItems = [
    { value: "all", label: "All campaigns" },
    ...campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name })),
  ]
  const ownerItems = [
    { value: "all", label: "All owners" },
    ...team.map((member) => ({ value: member.id, label: member.name })),
  ]
  const collectionItems = [
    { value: "all", label: "All collections" },
    ...collections.map((item) => ({ value: item, label: item })),
  ]

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageIntro
          title="Assets Library"
          description="One record for every shared file. Projects, campaigns, and deliverables point at the same asset."
        />
        <Button
          type="button"
          onClick={() => {
            setFormSession((current) => current + 1)
            setCreating(true)
          }}
         disabled={!canCreateRecords}>
          Add asset
        </Button>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Total assets"
          value={active.length}
          hint="Active records in the library"
          icon={Images}
        />
        <KpiCard
          label="Recently added"
          value={recent}
          hint="Added since April 2026"
          icon={Folder}
          accent="violet"
        />
        <KpiCard
          label="Asset types"
          value={typeCount}
          hint="Types currently in use"
          icon={Layers}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <Input
            value={query}
            placeholder="Search name, description, or tags"
            aria-label="Search assets"
            className="h-9 max-w-md"
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by type">
            {typeFilters.map((item) => (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={type === item ? "default" : "outline"}
                aria-pressed={type === item}
                className="rounded-full"
                onClick={() => setType(item)}
              >
                {item}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              items={projectItems}
              value={projectId}
              onValueChange={(value) => {
                if (value) setProjectId(value)
              }}
            >
              <SelectTrigger className="w-48" aria-label="Filter by project">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              items={campaignItems}
              value={campaignId}
              onValueChange={(value) => {
                if (value) setCampaignId(value)
              }}
            >
              <SelectTrigger className="w-52" aria-label="Filter by campaign">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All campaigns</SelectItem>
                {campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              items={ownerItems}
              value={ownerId}
              onValueChange={(value) => {
                if (value) setOwnerId(value)
              }}
            >
              <SelectTrigger className="w-44" aria-label="Filter by owner">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All owners</SelectItem>
                {team.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              items={collectionItems}
              value={collection}
              onValueChange={(value) => {
                if (value) setCollection(value)
              }}
            >
              <SelectTrigger className="w-48" aria-label="Filter by collection">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All collections</SelectItem>
                {collections.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              items={sortItems}
              value={sort}
              onValueChange={(value) => {
                if (isSort(value)) setSort(value)
              }}
            >
              <SelectTrigger className="w-36" aria-label="Sort assets">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              variant={showArchived ? "default" : "outline"}
              aria-pressed={showArchived}
              onClick={() => setShowArchived((current) => !current)}
            >
              {showArchived ? "Including archived" : "Show archived"}
            </Button>
            <div className="ml-auto flex gap-1" role="group" aria-label="Asset layout">
              <Button
                type="button"
                size="icon"
                variant={view === "grid" ? "default" : "outline"}
                aria-pressed={view === "grid"}
                aria-label="Grid view"
                onClick={() => setView("grid")}
              >
                <LayoutGrid />
              </Button>
              <Button
                type="button"
                size="icon"
                variant={view === "list" ? "default" : "outline"}
                aria-pressed={view === "list"}
                aria-label="List view"
                onClick={() => setView("list")}
              >
                <List />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{visibilityNote}</p>
        </div>

        {visible.length === 0 ? (
          <p className={`${surfaceClass} px-5 py-10 text-sm text-muted-foreground`}>
            No assets match these filters. Add one, or clear a filter to see the library.
          </p>
        ) : view === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                projectName={
                  asset.projectId ? getProjectName(projects, asset.projectId) : "No project"
                }
                campaignName={
                  campaigns.find((campaign) => campaign.id === asset.campaignId)?.name
                }
              />
            ))}
          </div>
        ) : (
          <ul className={surfaceClass}>
            {visible.map((asset) => (
              <AssetRow
                key={asset.id}
                asset={asset}
                projectName={
                  asset.projectId ? getProjectName(projects, asset.projectId) : "No project"
                }
              />
            ))}
          </ul>
        )}
      </section>

      <AssetFormDialog
        key={formSession}
        open={creating}
        onOpenChange={setCreating}
        projects={projects}
        campaigns={campaigns}
        initial={blankAsset(actorId)}
        title="Add asset"
        submitLabel="Add asset"
        onSubmit={createAsset}
      />
    </div>
  )
}

function AssetCard({
  asset,
  projectName,
  campaignName,
}: {
  asset: Asset
  projectName: string
  campaignName?: string
}) {
  const owner = getMember(asset.ownerId)
  return (
    <article className={`${surfaceClass} roaya-interactive flex flex-col p-4`}>
      <Link
        href={assetPath(asset.id)}
        className="rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <AssetMark type={asset.type} name={asset.name} url={asset.url} />
        <h2 className="mt-3 text-base font-semibold tracking-tight hover:underline">
          {asset.name}
        </h2>
      </Link>
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge variant="secondary">{asset.type}</Badge>
        <Badge variant="secondary">{visibilityLabel[asset.visibility]}</Badge>
        {asset.archived ? <Badge variant="secondary">Archived</Badge> : null}
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
        {asset.description || "No description yet."}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        {asset.collection} · {projectName}
        {campaignName ? ` · ${campaignName}` : ""}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {owner.name} · {formatStamp(asset.updatedAt)}
      </p>
      <div className="mt-4"><AssetDownloadButton asset={asset} /></div>
    </article>
  )
}

function AssetRow({ asset, projectName }: { asset: Asset; projectName: string }) {
  const owner = getMember(asset.ownerId)
  return (
    <li className="flex flex-col gap-3 border-b border-border px-5 py-4 last:border-b-0 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <Link
          href={assetPath(asset.id)}
          className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {asset.name}
        </Link>
        <p className="mt-1 text-sm text-muted-foreground">
          {asset.type} · {owner.name} · {projectName} · {asset.collection}
        </p>
      </div>
      <Badge variant="secondary">{visibilityLabel[asset.visibility]}</Badge>
      <AssetDownloadButton asset={asset} />
    </li>
  )
}

function compareAssets(left: Asset, right: Asset, sort: SortKey) {
  if (sort === "name") return left.name.localeCompare(right.name)
  if (sort === "type") return left.type.localeCompare(right.type) || left.name.localeCompare(right.name)
  return right.updatedAt.localeCompare(left.updatedAt)
}

function isSort(value: string | null): value is SortKey {
  return value === "newest" || value === "name" || value === "type"
}
