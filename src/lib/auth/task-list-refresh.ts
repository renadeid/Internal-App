const listeners = new Set<() => void>()

export function subscribeTaskListRefresh(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function refreshOrganizationTasks() {
  listeners.forEach((listener) => listener())
}
