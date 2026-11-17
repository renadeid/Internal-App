"use client"

import { createContext, useContext } from "react"

import type { CurrentIdentity } from "@/lib/auth/user-identity"

const CurrentIdentityContext = createContext<CurrentIdentity | null>(null)

export function CurrentIdentityProvider({
  identity,
  children,
}: {
  identity: CurrentIdentity
  children: React.ReactNode
}) {
  return (
    <CurrentIdentityContext.Provider value={identity}>
      {children}
    </CurrentIdentityContext.Provider>
  )
}

export function useCurrentIdentity() {
  const identity = useContext(CurrentIdentityContext)
  if (!identity) {
    throw new Error(
      "Current identity is only available inside the signed-in workspace."
    )
  }
  return identity
}
