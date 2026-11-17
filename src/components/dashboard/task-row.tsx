import { dueText } from "@/lib/mock-data/tasks"
import { getProjectName } from "@/lib/mock-data/projects"
import { getMember } from "@/lib/mock-data/team"
import { Badge } from "@/components/ui/badge"
import { priorityClass, taskStatusClass } from "@/lib/presentation"
import type { Campaign, Project, Task } from "@/lib/types"

export function TaskRow({
  task,
  projects,
  campaigns = [],
  showAssignee = false,
  showProject = true,
}: {
  task: Task
  projects: Project[]
  campaigns?: Campaign[]
  showAssignee?: boolean
  showProject?: boolean
}) {
  const assignee = getMember(task.assigneeId)
  const campaign = campaigns.find((item) => item.id === task.campaignId)

  return (
    <li className="flex gap-3 border-b border-border py-3.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="font-medium text-foreground">{task.title}</p>
          <Badge variant="secondary" className={taskStatusClass[task.status]}>
            {task.status}
          </Badge>
        </div>
        {showProject || campaign ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {showProject ? getProjectName(projects, task.projectId) : null}
            {showProject && campaign ? " · " : null}
            {campaign ? campaign.name : null}
          </p>
        ) : null}
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className={priorityClass[task.priority]}>{task.priority} priority</span>
          <span className="text-muted-foreground">{dueText(task.dueLabel)}</span>
          {showAssignee ? (
            <span className="text-muted-foreground">{assignee.name}</span>
          ) : null}
        </p>
      </div>
    </li>
  )
}
