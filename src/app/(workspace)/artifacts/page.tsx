import type { Metadata } from "next"

import { PageIntro } from "@/components/shared/page-intro"
import { Badge } from "@/components/ui/badge"
import { artifacts } from "@/lib/mock-data/library"
import { initialProjects, getProjectName } from "@/lib/mock-data/projects"
import { getMember } from "@/lib/mock-data/team"

export const metadata: Metadata = {
  title: "Artifact Hub",
}

export default function ArtifactsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageIntro
        title="Artifact Hub"
        description="Finished deliverables attached to a project: decks, briefs, guidelines, and checklists."
      />
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {artifacts.map((artifact) => {
          const owner = getMember(artifact.ownerId)
          return (
            <li
              key={artifact.id}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold">{artifact.name}</h2>
                  <Badge variant="outline">{artifact.kind}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {getProjectName(initialProjects, artifact.projectId)}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                {owner.name}, {artifact.updatedLabel.toLowerCase()}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
