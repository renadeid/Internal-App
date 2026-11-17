import Link from "next/link"

import { getMember } from "@/lib/mock-data/team"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { ActivityItem } from "@/lib/types"

export function ActivityFeedItem({ item }: { item: ActivityItem }) {
  const actor = getMember(item.actorId)

  return (
    <li>
      <Link
        href={item.href}
        className="-mx-2 flex gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Avatar size="sm">
          <AvatarFallback
            className="text-[10px] font-semibold text-white"
            style={{ backgroundColor: actor.color }}
          >
            {actor.initials}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0">
          <span className="block text-sm leading-5 text-foreground">
            <span className="font-medium">{actor.name}</span> {item.summary}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {item.context}, {item.timeLabel}
          </span>
        </span>
      </Link>
    </li>
  )
}
