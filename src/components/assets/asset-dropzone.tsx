"use client"

import {useId,useRef,useState,type DragEvent} from "react"
import {UploadCloud} from "lucide-react"
import {sharedFileKinds} from "@/lib/shared-assets"

export function AssetDropzone({multiple=false,disabled=false,onFiles}:{multiple?:boolean;disabled?:boolean;onFiles:(files:File[])=>void}){
 const id=useId();const depth=useRef(0);const [dragging,setDragging]=useState(false)
 const hasFiles=(event:DragEvent)=>Array.from(event.dataTransfer.types).includes("Files")
 return <div className={"relative rounded-2xl border-2 border-dashed p-6 text-center transition-colors "+(disabled?"opacity-50":dragging?"border-primary bg-primary/10":"border-border bg-muted/20 hover:border-primary/50")} onDragEnter={event=>{if(!hasFiles(event))return;event.preventDefault();depth.current++;if(!disabled)setDragging(true)}} onDragOver={event=>{if(!hasFiles(event))return;event.preventDefault();event.dataTransfer.dropEffect=disabled?"none":"copy"}} onDragLeave={event=>{event.preventDefault();depth.current=Math.max(0,depth.current-1);if(!depth.current)setDragging(false)}} onDrop={event=>{event.preventDefault();depth.current=0;setDragging(false);if(!disabled&&hasFiles(event))onFiles(Array.from(event.dataTransfer.files))}}>
  <UploadCloud className="mx-auto mb-3 size-8 text-primary" aria-hidden/>
  <label htmlFor={id} className="block text-sm font-semibold">{dragging?"Drop to select files":multiple?"Drag & drop files here":"Drag & drop a file here"}</label>
  <p id={id+"-hint"} className="mt-1 text-xs leading-5 text-muted-foreground">{multiple?"Up to 25 files · 20 MB each":"One file · Up to 20 MB"}. Or browse your device below.</p>
  <input id={id} aria-describedby={id+"-hint"} type="file" multiple={multiple} disabled={disabled} accept={Object.keys(sharedFileKinds).map(extension=>"."+extension).join(",")} className="mt-4 w-full min-w-0 text-sm file:me-3 file:cursor-pointer file:rounded-lg file:border file:border-border file:bg-card file:px-3 file:py-2 focus-visible:outline-2 focus-visible:outline-primary" onChange={event=>{const files=Array.from(event.target.files??[]);if(files.length)onFiles(files);event.target.value=""}}/>
 </div>
}
