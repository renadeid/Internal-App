import { EmptyNote } from "@/components/projects/empty-note"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { getMember } from "@/lib/mock-data/team"
import { departmentClass, surfaceClass } from "@/lib/presentation"
import type { Project } from "@/lib/types"

export function ProjectTeam({ project }: { project: Project }) {
  if (project.team.length === 0) {
    return <EmptyNote>No one is assigned to this project yet.</EmptyNote>
  }

  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {project.team.map((assignment) => {
        const member = getMember(assignment.memberId)
        return (
          <li key={assignment.memberId} className={`${surfaceClass} flex gap-3 p-4`}>
            <Avatar>
              <AvatarFallback
                className="font-semibold text-white"
                style={{ backgroundColor: member.color }}
              >
                {member.initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium text-foreground">{member.name}</p>
              <p className="text-sm text-muted-foreground">{member.role}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge
                  variant="secondary"
                  className={departmentClass[member.department]}
                >
                  {member.department}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {assignment.projectRole}
                </span>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
