"use client"

import Link from "next/link"
import { useTransition } from "react"

import { signOut } from "@/lib/auth/sign-out"
import type { UserIdentity } from "@/lib/auth/user-identity"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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

export function UserMenu({ identity }: { identity: UserIdentity }) {
  const [pending, startTransition] = useTransition()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
            aria-label="Open profile menu"
          />
        }
      >
        <Avatar size="sm">
          {identity.avatarUrl ? <AvatarImage src={identity.avatarUrl} alt={identity.name} /> : null}
          <AvatarFallback
            className="text-[10px] font-semibold text-white"
            style={{ backgroundColor: identity.avatarColor }}
          >
            {identity.initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60!">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="py-2 font-normal">
            <span className="block text-sm font-medium text-foreground">
              {identity.name}
            </span>
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              {identity.email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/people" />}>
          People & onboarding
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/settings" />}>
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onClick={() => {
            startTransition(() => {
              void signOut()
            })
          }}
        >
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
