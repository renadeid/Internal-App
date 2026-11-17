import Link from "next/link"

import type { AppRoute } from "@/lib/types"

export function SectionHeading({
  title,
  meta,
  href,
  action,
}: {
  title: string
  meta?: string
  href?: AppRoute
  action?: string
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <div className="flex items-baseline gap-3">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {meta ? <p className="text-sm text-muted-foreground">{meta}</p> : null}
      </div>
      {href && action ? (
        <Link
          href={href}
          className="shrink-0 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {action}
        </Link>
      ) : null}
    </div>
  )
}
