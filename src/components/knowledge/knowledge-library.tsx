"use client"
import { useState } from "react"
import Link from "next/link"
import { ArrowRight, BookOpen, ChevronDown, Search } from "lucide-react"
import { knowledgeCategories, knowledgeGuides } from "@/lib/knowledge-guides"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function KnowledgeLibrary() {
 const [query, setQuery] = useState("")
 const [category, setCategory] = useState<string>("All guides")
 const needle = query.trim().toLowerCase()
 const guides = knowledgeGuides.filter(g => (category === "All guides" || g.category === category) && `${g.title} ${g.summary} ${g.steps.join(" ")}`.toLowerCase().includes(needle))
 return <div className="flex flex-col gap-6">
  <section className="roaya-handbook-banner border p-5 sm:p-7">
   <div className="flex items-center gap-2 text-sm font-medium text-navy-600"><BookOpen className="size-4" aria-hidden />Roaya Connect handbook</div>
   <h2 className="mt-3 text-2xl font-semibold tracking-tight">How we work in Roaya Connect</h2>
   <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Start with access, assign the work, and share only what people need. Find practical answers for your workspace.</p>
   <div className="relative mt-5 max-w-xl"><Search className="absolute start-3 top-3 size-4 text-muted-foreground" aria-hidden /><Input className="h-10 bg-white ps-9" aria-label="Search knowledge guides" placeholder="Search roles, invitations, downloads…" value={query} onChange={e => setQuery(e.target.value)} /></div>
  </section>
  <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
   <aside><h2 className="mb-3 text-sm font-semibold">Browse topics</h2><div role="group" aria-label="Guide topics" className="flex flex-wrap gap-1 lg:flex-col">
    {knowledgeCategories.map(item => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)} className={`flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-start text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${category === item ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted"}`}><span>{item}</span><span className="text-xs">{item === "All guides" ? knowledgeGuides.length : knowledgeGuides.filter(g => g.category === item).length}</span></button>)}
   </div><div className="mt-5 rounded-lg border bg-card p-4 text-xs leading-5 text-muted-foreground"><p className="font-medium text-foreground">About this handbook</p><p className="mt-1">Guides to the current workspace. Article editing is not available yet.</p></div></aside>
   <section aria-label="Knowledge guides" className="min-w-0"><div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-semibold">{category}</h2><p role="status" className="text-xs text-muted-foreground">{guides.length} {guides.length === 1 ? "guide" : "guides"}</p></div>
    <div className="grid gap-3">{guides.map(g => <details key={g.id} className="roaya-glass group rounded-2xl border bg-card p-5" open={needle ? true : undefined}>
     <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"><span><span className="text-xs font-medium text-primary">{g.category}</span><span className="mt-1.5 block font-semibold">{g.title}</span><span className="mt-1 block text-sm leading-6 text-muted-foreground">{g.summary}</span></span><ChevronDown className="mt-5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden /></summary>
     <div className="mt-5 border-t pt-4"><ul className="max-w-3xl space-y-3">{g.steps.map(step => <li key={step} className="flex gap-3 text-sm leading-7"><span className="mt-3 size-1 shrink-0 rounded-full bg-primary" aria-hidden /><span>{step}</span></li>)}</ul><Link href={g.href} className="mt-5 inline-flex items-center gap-2 rounded text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{g.linkLabel}<ArrowRight className="size-4" aria-hidden /></Link></div>
    </details>)}</div>
    {!guides.length ? <div className="rounded-xl border bg-card p-8 text-center"><h3 className="font-medium">No matching guides</h3><p className="mt-2 text-sm text-muted-foreground">Try another search or browse all topics.</p><Button className="mt-4" variant="outline" onClick={() => { setQuery(""); setCategory("All guides") }}>Clear filters</Button></div> : null}
   </section>
  </div>
 </div>
}
