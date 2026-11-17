const listeners = new Set<() => void>()

export function subscribeProjectListRefresh(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function refreshOrganizationProjects() {
  listeners.forEach((listener) => listener())
}
