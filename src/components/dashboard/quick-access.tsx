import Link from "next/link"
import { Boxes, ChevronRight, Images, Megaphone } from "lucide-react"

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
    iconClass: "bg-purple-500/10 text-purple-600",
  },
  {
    href: "/assets",
    title: "Assets Library",
    description: "Logos, photography, and files shared with the company.",
    icon: Images,
    iconClass: "bg-navy-500/10 text-navy-600",
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
    <section aria-labelledby="quick-access-heading">
      <h2 id="quick-access-heading" className="mb-3 text-base font-semibold tracking-tight">Quick access</h2>
      <div className="grid gap-3 md:grid-cols-3">
        {shortcuts.map((shortcut) => {
          const Icon = shortcut.icon
          return (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className="group flex items-center gap-3 roaya-glass rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                  shortcut.iconClass
                )}
              >
                <Icon className="size-4" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground">
                  {shortcut.title}
                </span>
                <span className="sr-only">
                  {shortcut.description}
                </span>
              </span>
              <ChevronRight className="ms-auto size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden />
            </Link>
          )
        })}
      </div>
    </section>
  )
}
