"use client"

import { EmptyNote } from "@/components/projects/empty-note"
import { useWorkspace } from "@/components/workspace/workspace-provider"
import { getMember } from "@/lib/mock-data/team"
import { surfaceClass } from "@/lib/presentation"
import {
  filesForProject,
  type FileGroup,
  type ProjectFile,
} from "@/lib/project-records"
import Link from "next/link"

const groups: FileGroup[] = ["Designs", "Documents", "Presentations", "Links"]

export function ProjectFiles({ projectId }: { projectId: string }) {
  const { assets } = useWorkspace()
  const files = filesForProject(assets, projectId)

  if (files.length === 0) {
    return (
      <EmptyNote>
        No designs, documents, presentations, or links are attached to this
        project yet.
      </EmptyNote>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => {
        const items = files.filter((file) => file.group === group)
        if (items.length === 0) return null
        return (
          <section key={group}>
            <h2 className="text-base font-semibold tracking-tight">{group}</h2>
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {items.map((file) => (
                <FileCard key={file.id} file={file} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function FileCard({ file }: { file: ProjectFile }) {
  const className = `${surfaceClass} block p-4 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50`
  return (
    <li>
      {file.external ? (
        <a href={file.href} target="_blank" rel="noreferrer" className={className}>
          <FileBody file={file} />
        </a>
      ) : (
        <Link href={file.href} className={className}>
          <FileBody file={file} />
        </Link>
      )}
    </li>
  )
}

function FileBody({ file }: { file: ProjectFile }) {
  const owner = getMember(file.ownerId)
  return (
    <>
      <p className="text-xs text-muted-foreground">
        {file.kind}
        {file.external ? " · External link" : ""}
      </p>
      <p className="mt-1 font-medium text-foreground">{file.name}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {owner.name} · {file.updatedLabel}
      </p>
    </>
  )
}
