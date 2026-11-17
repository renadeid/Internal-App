"use client"

import { useWorkspace } from "@/components/workspace/workspace-provider"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { team, workspaceRole } from "@/lib/mock-data/team"

const people = team.map((member) => ({
  value: member.id,
  label: member.name,
}))

export function ActingAs() {
  const { actorId, setActorId } = useWorkspace()
  const role = workspaceRole(actorId)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="secondary">{role}</Badge>
      <Select
        items={people}
        value={actorId}
        onValueChange={(value) => {
          if (value) setActorId(value)
        }}
      >
        <SelectTrigger className="w-44" aria-label="Acting as">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {team.map((member) => (
            <SelectItem key={member.id} value={member.id}>
              {member.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
