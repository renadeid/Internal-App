const listeners = new Set<() => void>()

export function subscribeCampaignListRefresh(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function refreshOrganizationCampaigns() {
  listeners.forEach((listener) => listener())
}
