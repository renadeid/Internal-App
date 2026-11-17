import { getMember } from "@/lib/mock-data/team"
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar"

export function MemberAvatars({
  ids,
  max = 4,
}: {
  ids: string[]
  max?: number
}) {
  const visible = ids.slice(0, max)
  const extra = ids.length - visible.length
  const names = ids.map((id) => getMember(id).name).join(", ")

  return (
    <AvatarGroup aria-label={`Team: ${names}`}>
      {visible.map((id) => {
        const member = getMember(id)
        return (
          <Avatar key={id} size="sm">
            <AvatarFallback
              className="text-[10px] font-semibold text-white"
              style={{ backgroundColor: member.color }}
            >
              {member.initials}
            </AvatarFallback>
          </Avatar>
        )
      })}
      {extra > 0 ? <AvatarGroupCount>+{extra}</AvatarGroupCount> : null}
    </AvatarGroup>
  )
}
