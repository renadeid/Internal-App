"use client"

import Link from "next/link"
import { Bell } from "lucide-react"

import { useWorkspace } from "@/components/workspace/workspace-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export function NotificationsMenu() {
  const {
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = useWorkspace()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="relative"
            aria-label={
              unreadCount > 0
                ? `Notifications, ${unreadCount} unread`
                : "Notifications"
            }
          />
        }
      >
        <Bell />
        {unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#8B5CF6] px-1 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80!">
        <div className="flex items-center justify-between gap-3 px-1.5 py-1">
          <DropdownMenuLabel className="p-0 text-sm text-foreground">
            Notifications
          </DropdownMenuLabel>
          {unreadCount > 0 ? (
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={markAllNotificationsRead}
            >
              Mark all read
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">Caught up</span>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {notifications.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Nothing new in the workspace.
            </p>
          ) : (
            notifications.slice(0, 6).map((item) => (
              <DropdownMenuItem
                key={item.id}
                className="items-start py-2"
                render={<Link href={item.href} />}
                onClick={() => markNotificationRead(item.id)}
              >
                <span
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    item.read ? "bg-transparent" : "bg-[#8B5CF6]"
                  )}
                  aria-hidden
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm leading-5 font-medium text-foreground">
                    {capitalize(item.title)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.detail}, {item.timeLabel}
                  </span>
                </span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
