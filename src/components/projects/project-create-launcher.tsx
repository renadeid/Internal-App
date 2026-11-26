"use client"

import { createContext, useContext } from "react"

type ProjectCreateLauncher = { canCreate: boolean; open: () => void }

const ProjectCreateLauncherContext = createContext<ProjectCreateLauncher>({ canCreate: false, open: () => {} })

/** Lets any page open the shell's "Create project" dialog (the same one as Quick create). */
export const ProjectCreateLauncherProvider = ProjectCreateLauncherContext.Provider

export function useProjectCreateLauncher() {
  return useContext(ProjectCreateLauncherContext)
}
