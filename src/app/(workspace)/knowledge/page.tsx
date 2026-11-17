import type { Metadata } from "next"
import { ChevronRight } from "lucide-react"

import { PageIntro } from "@/components/shared/page-intro"
import { articles } from "@/lib/mock-data/library"

export const metadata: Metadata = {
  title: "Knowledge Base",
}

export default function KnowledgePage() {
  return (
    <div className="flex flex-col gap-8">
      <PageIntro
        title="Knowledge Base"
        description="Answers the team asks more than once. Open a note to read the working agreement."
      />
      <div className="grid gap-3">
        {articles.map((article) => (
          <details
            key={article.id}
            className="group rounded-xl border border-border bg-card px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-5"
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
              <span>
                <span className="block text-sm font-semibold text-foreground">
                  {article.title}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {article.summary}
                </span>
              </span>
              <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
            </summary>
            <p className="max-w-3xl pt-4 text-sm leading-6 text-foreground">
              {article.body}
            </p>
          </details>
        ))}
      </div>
    </div>
  )
}
