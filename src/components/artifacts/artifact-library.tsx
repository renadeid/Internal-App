"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Download, FileCheck2, FileText, Search, ShieldCheck, Users } from "lucide-react"
import { workspaceArtifacts, artifactHtml, type WorkspaceArtifact } from "@/lib/workspace-artifacts"
import { PageIntro } from "@/components/shared/page-intro"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

const categories = ["All documents", "Access & roles", "Project delivery", "Sharing & files"]

function downloadDocument(artifact: WorkspaceArtifact) {
 const url=URL.createObjectURL(new Blob([artifactHtml(artifact)],{type:"text/html;charset=utf-8"}))
 const anchor=document.createElement("a")
 anchor.href=url; anchor.download=`roaya-connect-${artifact.id}.html`
 document.body.appendChild(anchor); anchor.click(); anchor.remove()
 setTimeout(()=>URL.revokeObjectURL(url),60000)
}

export function ArtifactLibrary() {
 const [query,setQuery]=useState("")
 const [category,setCategory]=useState("All documents")
 const [selected,setSelected]=useState<WorkspaceArtifact|null>(null)
 const needle=query.trim().toLowerCase()
 const visible=workspaceArtifacts.filter(item=>(category==="All documents"||item.category===category)&&`${item.title} ${item.summary} ${item.sections.flatMap(section=>section.items).join(" ")}`.toLowerCase().includes(needle))
 return <div className="flex flex-col gap-6">
  <PageIntro title="Artifact hub" description="Workspace documents and handover checklists for the way we work in Roaya Connect." />
  <section className="roaya-handbook-banner grid gap-6 border p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center">
   <div className="max-w-2xl"><div className="mb-3 flex items-center gap-2 text-sm font-medium text-navy-600"><FileCheck2 className="size-4" aria-hidden />Roaya Connect · Workspace documents</div><h2 className="text-2xl font-semibold tracking-tight">The work, ready to hand over.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Open a document, check the agreed workflow, or download a copy for your team. These references cover the features configured in this workspace.</p></div>
   <div className="flex items-center gap-4 rounded-2xl border border-white/60 bg-white/60 p-4"><span className="roaya-icon-tile flex size-12 items-center justify-center"><FileText className="size-6" aria-hidden /></span><div><p className="text-2xl font-semibold tabular-nums">{workspaceArtifacts.length}</p><p className="text-xs text-muted-foreground">Workspace documents</p></div></div>
  </section>
  <div className="flex flex-col gap-3"><div className="relative max-w-lg"><Search className="absolute start-3 top-3 size-4 text-muted-foreground" aria-hidden /><Input className="h-10 ps-9" aria-label="Search artifact documents" placeholder="Find a document, permission or workflow…" value={query} onChange={e=>setQuery(e.target.value)} /></div><div className="flex flex-wrap items-center gap-2" role="group" aria-label="Document categories">{categories.map(item=><Button key={item} size="sm" variant={category===item?"default":"outline"} aria-pressed={category===item} onClick={()=>setCategory(item)}>{item}</Button>)}<p role="status" className="text-xs text-muted-foreground sm:ms-auto">{visible.length} {visible.length===1?"document":"documents"}</p></div></div>
  <section aria-label="Workspace artifacts" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visible.map(artifact=>{
   const Icon=artifact.category==="Access & roles"?Users:artifact.category==="Sharing & files"?ShieldCheck:FileCheck2
   return <article key={artifact.id} className="roaya-glass roaya-interactive flex flex-col p-5"><div className="flex items-start justify-between gap-3"><span className="roaya-icon-tile flex size-12 items-center justify-center"><Icon className="size-6" aria-hidden /></span><Badge variant="outline">{artifact.kind}</Badge></div><p className="mt-5 text-xs font-medium text-purple-600">{artifact.category}</p><h2 className="mt-2 text-lg font-semibold tracking-tight">{artifact.title}</h2><p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{artifact.summary}</p><div className="mt-5 flex flex-wrap items-center gap-2 border-t pt-4"><Button variant="outline" onClick={()=>setSelected(artifact)} aria-label={`Open ${artifact.title}`}>Open document<ArrowUpRight className="size-3.5 rtl-flip" aria-hidden /></Button><Button variant="ghost" onClick={()=>downloadDocument(artifact)} aria-label={`Download ${artifact.title}`}><Download className="size-4" aria-hidden />Download</Button></div></article>
  })}</section>
  {!visible.length?<div className="roaya-glass p-8 text-center"><h2 className="font-semibold">No matching documents</h2><p className="mt-2 text-sm text-muted-foreground">Try another search or browse all categories.</p><Button className="mt-4" variant="outline" onClick={()=>{setQuery("");setCategory("All documents")}}>Clear filters</Button></div>:null}
  <p className="max-w-3xl text-xs leading-5 text-muted-foreground">This collection contains workspace reference documents. Downloads are standalone HTML files you can open in a browser or print. Adding project files and editing documents here are not available yet.</p>
  <Dialog open={selected!==null} onOpenChange={open=>{if(!open)setSelected(null)}}><DialogContent className="max-h-[85svh] overflow-y-auto p-5 sm:max-w-3xl sm:p-7">{selected?<><DialogHeader className="pe-6"><p className="text-xs font-medium text-purple-600">{selected.category} · {selected.kind}</p><DialogTitle className="text-2xl">{selected.title}</DialogTitle><DialogDescription>{selected.summary}</DialogDescription></DialogHeader><div className="grid gap-6 border-y py-5">{selected.sections.map(section=><section key={section.title}><h3 className="font-semibold text-navy-600">{section.title}</h3><ul className="mt-3 grid gap-3">{section.items.map(item=><li key={item} className="flex gap-3 text-sm leading-7"><span className="mt-3 size-1 shrink-0 rounded-full bg-teal-700" aria-hidden /><span>{item}</span></li>)}</ul></section>)}</div><div className="flex flex-wrap items-center justify-between gap-3"><Link href={selected.href} className="inline-flex items-center gap-1 rounded text-sm font-medium text-primary hover:underline">{selected.action}<ArrowUpRight className="size-4 rtl-flip" aria-hidden /></Link><Button onClick={()=>downloadDocument(selected)}><Download className="size-4" aria-hidden />Download document</Button></div></>:null}</DialogContent></Dialog>
 </div>
}
