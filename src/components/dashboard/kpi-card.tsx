import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { AppRoute } from "@/lib/types"
import { cn } from "@/lib/utils"

export function KpiCard({
  label,
  value,
  hint,
  href,
  icon: Icon,
  accent = "blue",
}: {
  label: string
  value: number
  hint: string
  href?: AppRoute
  icon: LucideIcon
  accent?: "blue" | "violet"
}) {
  const card = (
    <Card className={cn("h-full", href && "roaya-interactive")}>
        <CardHeader>
          <CardDescription className="text-sm font-medium">{label}</CardDescription>
          <CardTitle className="text-3xl font-semibold tracking-tight tabular-nums">
            {value}
          </CardTitle>
          <CardAction>
            <span
              className={cn(
                "roaya-icon-tile flex size-10 items-center justify-center rounded-xl",
                accent === "violet"
                  ? "bg-purple-500/10 text-purple-600"
                  : "bg-navy-500/10 text-navy-600"
              )}
            >
              <Icon className="size-5" aria-hidden />
            </span>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </CardContent>
      </Card>
  )

  if (!href) return card

  return (
    <Link
      href={href}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {card}
    </Link>
  )
}
