import Link from "next/link"
import { Boxes, Images, Megaphone } from "lucide-react"

import type { AppRoute } from "@/lib/types"
import { cn } from "@/lib/utils"

const shortcuts: {
  href: AppRoute
  title: string
  description: string
  icon: typeof Megaphone
  iconClass: string
}[] = [
  {
    href: "/workspaces/marketing",
    title: "Marketing workspace",
    description: "Campaigns and the work in flight for the active department.",
    icon: Megaphone,
    iconClass: "bg-[#8B5CF6]/10 text-[#6D28D9]",
  },
  {
    href: "/assets",
    title: "Assets Library",
    description: "Logos, photography, and files shared with the company.",
    icon: Images,
    iconClass: "bg-[#2563EB]/10 text-[#1D4ED8]",
  },
  {
    href: "/artifacts",
    title: "Artifact Hub",
    description: "Decks, briefs, and checklists attached to projects.",
    icon: Boxes,
    iconClass: "bg-slate-100 text-slate-700",
  },
]

export function QuickAccess() {
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold tracking-tight">Quick access</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {shortcuts.map((shortcut) => {
          const Icon = shortcut.icon
          return (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className="flex gap-4 rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_8px_20px_rgba(15,23,42,0.06)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-lg",
                  shortcut.iconClass
                )}
              >
                <Icon className="size-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground">
                  {shortcut.title}
                </span>
                <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                  {shortcut.description}
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
