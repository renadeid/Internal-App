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
    <Card className="h-full shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
        <CardHeader>
          <CardDescription className="text-sm font-medium">{label}</CardDescription>
          <CardTitle className="text-3xl font-semibold tracking-tight tabular-nums">
            {value}
          </CardTitle>
          <CardAction>
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-lg",
                accent === "violet"
                  ? "bg-[#8B5CF6]/10 text-[#6D28D9]"
                  : "bg-[#2563EB]/10 text-[#1D4ED8]"
              )}
            >
              <Icon className="size-4" />
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
