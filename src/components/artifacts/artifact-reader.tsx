"use client"
import {useEffect,useState} from "react"
import Link from "next/link"
import {ArrowLeft,Check,Copy,Download,FileText} from "lucide-react"
import {useOrganization} from "@/components/auth/organization-provider"
import {getArtifactDocument} from "@/lib/auth/artifact-actions"
import {workspaceArtifacts,artifactMarkdown} from "@/lib/workspace-artifacts"
import type {ArtifactDocument} from "@/lib/artifact-documents"
import {Button} from "@/components/ui/button"
import {MarkdownDocument} from "./markdown-document"

export function downloadArtifact(fileName:string,content:string){const url=URL.createObjectURL(new Blob([content],{type:/\.txt$/i.test(fileName)?"text/plain;charset=utf-8":"text/markdown;charset=utf-8"}));const anchor=document.createElement("a");anchor.href=url;anchor.download=fileName;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export function ArtifactReader({id}:{id:string}){const {activeOrganization}=useOrganization();return activeOrganization?<Reader key={activeOrganization.id+id} organizationId={activeOrganization.id} id={id}/>:<p>Select your workspace to read this artifact.</p>}
function Reader({organizationId,id}:{organizationId:string;id:string}){
 const reference=workspaceArtifacts.find(item=>"reference-"+item.id===id)
 const [document,setDocument]=useState<ArtifactDocument|null>(reference?{id,title:reference.title,fileName:reference.id+".md",content:artifactMarkdown(reference),createdAt:null,authorName:"Roaya Connect",reference:true}:null)
 const [error,setError]=useState("");const [source,setSource]=useState(false);const [copied,setCopied]=useState(false);const [copyError,setCopyError]=useState("")
 useEffect(()=>{if(reference)return;let active=true;getArtifactDocument(organizationId,id).then(result=>{if(!active)return;if(result.ok)setDocument(result.document);else setError(result.message)}).catch(()=>{if(active)setError("Artifact could not be loaded.")});return()=>{active=false}},[organizationId,id,reference])
 return <div className="grid gap-6"><Link href="/artifacts" className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" aria-hidden />Artifact hub</Link>{error?<section className="roaya-glass rounded-2xl p-8"><h1 className="text-xl font-semibold">Artifact unavailable</h1><p role="alert" className="mt-3 text-sm text-muted-foreground">{error}</p></section>:!document?<p role="status">Loading artifact…</p>:<>
 <header className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><FileText className="size-4" aria-hidden /><span className="break-all">{document.fileName}</span></div><h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{document.title}</h1><p className="mt-2 text-xs text-muted-foreground">{document.reference?"Workspace reference":"Shared with your workspace"}{document.createdAt?" · Added "+new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeZone:"Africa/Cairo"}).format(new Date(document.createdAt)):""}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={async()=>{try{setCopyError("");await navigator.clipboard.writeText(window.location.href);setCopied(true)}catch{setCopyError("Could not copy the link. Copy the page address from your browser.")}}}>{copied?<Check className="size-4" aria-hidden />:<Copy className="size-4" aria-hidden />}{copied?"Copied":"Copy link"}</Button><Button size="sm" onClick={()=>downloadArtifact(document.fileName,document.content??"")}><Download className="size-4" aria-hidden />Download {document.fileName.toLowerCase().endsWith(".txt")?"TXT":"MD"}</Button></div></header>
 {copyError?<p role="status" className="text-sm text-muted-foreground">{copyError}</p>:null}
 <div className="flex gap-1 border-b border-border" role="group" aria-label="Artifact view"><Button variant="ghost" aria-pressed={!source} onClick={()=>setSource(false)} className={!source?"border-b-2 border-primary rounded-none":""}>Document</Button><Button variant="ghost" aria-pressed={source} onClick={()=>setSource(true)} className={source?"border-b-2 border-primary rounded-none":""}>Source</Button></div>
 <section aria-label="Artifact document" className="roaya-glass min-w-0 rounded-2xl border border-border p-5 sm:p-9"><div className="mx-auto max-w-4xl">{source||/\.txt$/i.test(document.fileName)?<pre className="whitespace-pre-wrap break-words font-mono text-sm leading-7 [overflow-wrap:anywhere]">{document.content}</pre>:<MarkdownDocument content={document.content??""}/>}</div></section>
 </>}</div>
}
