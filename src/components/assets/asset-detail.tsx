"use client"

import { useState } from "react"
import Link from "next/link"

import { AssetFormDialog } from "@/components/assets/asset-form-dialog"
import { AssetDownloadButton } from "@/components/assets/asset-download-button"
import { PublicShare } from "@/components/shared/public-share"
import { AssetMark } from "@/components/assets/asset-mark"
import { useWorkspace } from "@/components/workspace/workspace-provider"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatStamp } from "@/lib/dates"
import { visibilityLabel, visibilityNote } from "@/lib/mock-data/assets"
import { campaignPath } from "@/lib/mock-data/campaigns"
import { getProjectName } from "@/lib/mock-data/projects"
import { getMember } from "@/lib/mock-data/team"
import { deliverableStatusClass, surfaceClass } from "@/lib/presentation"
import type { Asset, AssetInput } from "@/lib/types"

export function AssetDetail({ assetId }: { assetId: string }) {
  const workspace = useWorkspace()
  const asset = workspace.assets.find((item) => item.id === assetId)
  const [editing, setEditing] = useState(false)
  const [editSession, setEditSession] = useState(0)
  const [comment, setComment] = useState("")
  const [versionLabel, setVersionLabel] = useState("")
  const [versionNotes, setVersionNotes] = useState("")
  const [versionError, setVersionError] = useState<string | null>(null)

  if (!asset) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-start gap-3 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Asset not found</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          This asset is not in the library. Assets saved in this browser stay
          in local storage.
        </p>
        <Link href="/assets" className={buttonVariants({ variant: "outline" })}>
          Back to the library
        </Link>
      </div>
    )
  }

  const owner = getMember(asset.ownerId)
  const project = workspace.projects.find((item) => item.id === asset.projectId)
  const campaign = workspace.campaigns.find((item) => item.id === asset.campaignId)
  const comments = workspace.assetComments.filter((item) => item.assetId === asset.id)
  const versions = workspace.assetVersions
    .filter((item) => item.assetId === asset.id)
    .sort((left, right) => right.number - left.number)
  const deliverables = workspace.deliverables.filter((item) => item.assetId === asset.id)

  return (
    <div className="flex flex-col gap-6">
      <section className={`${surfaceClass} p-5 sm:p-6`}>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <AssetMark type={asset.type} name={asset.name} url={asset.url} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{asset.type}</Badge>
              <Badge variant="secondary">{visibilityLabel[asset.visibility]}</Badge>
              {asset.archived ? <Badge variant="secondary">Archived</Badge> : null}
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">{asset.name}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {asset.description || "No description yet."}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">{visibilityNote}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <AssetDownloadButton asset={asset} />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditSession((current) => current + 1)
                  setEditing(true)
                }}
              >
                Edit asset
              </Button>
              {asset.archived ? (
                <Button type="button" disabled={!workspace.canArchiveRecords} onClick={() => workspace.setAssetArchived(asset.id, false)}>
                  Restore
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={!workspace.canArchiveRecords}
                  onClick={() => workspace.setAssetArchived(asset.id, true)}
                >
                  Archive
                </Button>
              )}
              {asset.url ? (
                <a
                  href={asset.url}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: "outline" })}
                >
                  Open link
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <PublicShare key={asset.id} resourceId={asset.id} kind="asset" asset={{ title: asset.name, description: asset.description, url: asset.url ?? "", type: asset.type }} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
        <section className={`${surfaceClass} p-5`}>
          <h2 className="text-sm font-medium">Details</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <Detail label="Owner" value={owner.name} />
            <Detail label="Collection" value={asset.collection} />
            <Detail label="Created" value={formatStamp(asset.createdAt)} />
            <Detail label="Updated" value={formatStamp(asset.updatedAt)} />
            <div>
              <dt className="text-muted-foreground">Project</dt>
              <dd className="mt-1">
                {project ? (
                  <Link href={`/projects/${project.id}`} className="hover:underline">
                    {project.name}
                  </Link>
                ) : (
                  "No project"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Campaign</dt>
              <dd className="mt-1">
                {campaign ? (
                  <Link href={campaignPath(campaign.id)} className="hover:underline">
                    {campaign.name}
                  </Link>
                ) : (
                  "No campaign"
                )}
              </dd>
            </div>
          </dl>
          <h3 className="mt-5 text-sm font-medium">Tags</h3>
          {asset.tags.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No tags yet.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {asset.tags.map((tag) => (
                <li key={tag}>
                  <Badge variant="secondary">{tag}</Badge>
                </li>
              ))}
            </ul>
          )}
          {asset.url ? (
            <p className="mt-4 break-all text-sm text-muted-foreground">{asset.url}</p>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No file is stored. This record is metadata
              {asset.type === "External Link" ? "" : " and can point at an external URL"}.
            </p>
          )}
        </section>

        <section className={`${surfaceClass} p-5`}>
          <h2 className="text-sm font-medium">Related deliverables</h2>
          {deliverables.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No deliverable points at this asset yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {deliverables.map((item) => (
                <li key={item.id} className="text-sm">
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-muted-foreground">
                    <span className={deliverableStatusClass[item.status]}>{item.status}</span>
                    {" · "}
                    {getProjectName(workspace.projects, item.projectId)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className={`${surfaceClass} p-5`}>
        <h2 className="text-sm font-medium">Version history</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Versions record who changed the metadata. Binary files are not stored.
        </p>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]"
          onSubmit={(event) => {
            event.preventDefault()
            if (!versionLabel.trim()) {
              setVersionError("Enter a version label.")
              return
            }
            workspace.addAssetVersion(asset.id, versionLabel, versionNotes)
            setVersionLabel("")
            setVersionNotes("")
          }}
        >
          <Input
            value={versionLabel}
            placeholder="Version label"
            aria-label="Version label"
            aria-invalid={versionError ? true : undefined}
            className="h-9"
            onChange={(event) => {
              setVersionLabel(event.target.value)
              if (versionError) setVersionError(null)
            }}
          />
          <Input
            value={versionNotes}
            placeholder="Change notes"
            aria-label="Change notes"
            className="h-9"
            onChange={(event) => setVersionNotes(event.target.value)}
          />
          <Button type="submit" disabled={!workspace.canCreateRecords}>Add version</Button>
        </form>
        {versionError ? <p className="mt-2 text-xs text-destructive">{versionError}</p> : null}
        <ol className="mt-4 space-y-4">
          {versions.map((version) => (
            <li key={version.id} className="border-t border-border pt-4 first:border-t-0 first:pt-0">
              <p className="text-sm font-medium">
                v{version.number} · {version.label}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {getMember(version.authorId).name} · {formatStamp(version.date)}
              </p>
              {version.notes ? (
                <p className="mt-1 text-sm text-muted-foreground">{version.notes}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section className={`${surfaceClass} p-5`}>
        <h2 className="text-sm font-medium">Comments</h2>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (!comment.trim()) return
            workspace.addAssetComment(asset.id, comment)
            setComment("")
          }}
        >
          <Textarea
            value={comment}
            rows={3}
            placeholder="Leave feedback"
            aria-label="Comment"
            onChange={(event) => setComment(event.target.value)}
          />
          <div>
            <Button type="submit" disabled={!workspace.canCreateRecords}>Add comment</Button>
          </div>
        </form>
        {comments.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {comments.map((item) => (
              <li key={item.id} className="border-t border-border pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">
                    <span className="font-medium">{getMember(item.authorId).name}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {formatStamp(item.createdAt)}
                    </span>
                  </p>
                  {item.resolved ? (
                    <Badge className="bg-emerald-600 text-white">Resolved</Badge>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => workspace.setAssetCommentResolved(item.id, true)}
                    >
                      Resolve
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AssetFormDialog
        key={editSession}
        open={editing}
        onOpenChange={setEditing}
        projects={workspace.projects}
        campaigns={workspace.campaigns}
        initial={toAssetInput(asset)}
        title="Edit asset"
        submitLabel="Save changes"
        onSubmit={(input) => workspace.updateAsset(asset.id, input)}
      />
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  )
}

function toAssetInput(asset: Asset): AssetInput {
  return {
    name: asset.name,
    description: asset.description,
    type: asset.type,
    url: asset.url ?? "",
    tags: asset.tags,
    ownerId: asset.ownerId,
    projectId: asset.projectId ?? "",
    campaignId: asset.campaignId ?? "",
    visibility: asset.visibility,
    collection: asset.collection,
  }
}
