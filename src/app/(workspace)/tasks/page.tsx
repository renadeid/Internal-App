import type { Metadata } from "next"

import { OrganizationTasksView } from "@/components/tasks/organization-tasks-view"

export const metadata: Metadata = {
  title: "My Tasks",
}

export default function TasksPage() {
  return <OrganizationTasksView />
}
