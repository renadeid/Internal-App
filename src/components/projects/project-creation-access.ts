"use client"

import { useMemo, useSyncExternalStore } from "react"

import { getProjectCreationAccess } from "@/lib/auth/project-creation-actions"
import type { ProjectCreationAccess } from "@/lib/auth/project-creation"

export type ProjectCreationSnapshot =
  | { status: "loading" }
  | ProjectCreationAccess

const idleAccess: ProjectCreationSnapshot = {
  status: "ready",
  canCreate: false,
  reason: "Select an organization before creating a project.",
}

export function useProjectCreationAccess(organizationId: string | null) {
  const store = useMemo(
    () => createAccessStore(organizationId),
    [organizationId]
  )
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  )
}

export function projectCreationLabel(access: ProjectCreationSnapshot) {
  if (access.status === "loading") return "Checking whether you can create a project."
  if (access.status === "error") return "Project creation could not be checked."
  if (access.status === "rejected") {
    return "This organization is not available for your account."
  }
  if (!access.canCreate) return access.reason
  return "Create a project"
}

function createAccessStore(organizationId: string | null) {
  const initial: ProjectCreationSnapshot = organizationId
    ? { status: "loading" }
    : idleAccess
  let current = initial
  let generation = 0
  const listeners = new Set<() => void>()

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      if (!organizationId) return () => listeners.delete(listener)
      const requestGeneration = ++generation
      void getProjectCreationAccess(organizationId)
        .then((result) => {
          if (requestGeneration !== generation) return
          current = result
          listeners.forEach((item) => item())
        })
        .catch(() => {
          if (requestGeneration !== generation) return
          current = { status: "error" }
          listeners.forEach((item) => item())
        })
      return () => {
        listeners.delete(listener)
        generation += 1
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
