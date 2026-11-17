"use client"

import { useWorkspace } from "@/components/workspace/workspace-provider"
import { Button } from "@/components/ui/button"

export function CreatedBanner() {
  const { lastCreated, dismissLastCreated } = useWorkspace()
  if (!lastCreated) return null

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-xl border border-[#2563EB]/20 bg-[#2563EB]/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-foreground">
        <span className="font-medium">{lastCreated.name}</span> was added to
        projects.
      </p>
      <Button type="button" variant="ghost" size="sm" onClick={dismissLastCreated}>
        Dismiss
      </Button>
    </div>
  )
}
