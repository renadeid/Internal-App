"use client"
import {useCallback,useEffect,useState} from "react"
import Link from "next/link"
import {Bell} from "lucide-react"
import {ProjectInvitationNotificationItems,useProjectInvitations} from "@/components/projects/project-invitations"
import {markWorkspaceNotificationsRead} from "@/lib/auth/workspace-overview"
import {getWorkspaceNotifications,markWorkspaceNotificationRead} from "@/lib/auth/workspace-notification-actions"
import {notificationHref,type WorkspaceNotification} from "@/lib/workspace-notifications"
import {useOrganization} from "@/components/auth/organization-provider"
import {Button} from "@/components/ui/button"
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuSeparator,DropdownMenuTrigger} from "@/components/ui/dropdown-menu"

export function NotificationsMenu(){
 const {invitations,refresh}=useProjectInvitations(),{activeOrganization}=useOrganization(),org=activeOrganization?.id
 const [snapshot,setSnapshot]=useState<{org:string;rows:WorkspaceNotification[];failed:boolean}|null>(null),[generation,setGeneration]=useState(0)
 const reload=useCallback(()=>setGeneration(g=>g+1),[])
 const current=snapshot?.org===org?snapshot:null,rows=current?.rows??[],unread=rows.filter(n=>!n.read_at).length,count=unread+invitations.length
 useEffect(()=>{if(!org)return;let active=true
  getWorkspaceNotifications(org).then(result=>{if(active)setSnapshot(result.ok?{org,rows:result.rows,failed:false}:{org,rows:[],failed:true})}).catch(()=>{if(active)setSnapshot({org,rows:[],failed:true})})
  return()=>{active=false}
 },[org,generation])
 useEffect(()=>{const check=()=>{if(document.visibilityState==="visible")reload()},timer=window.setInterval(check,30000);window.addEventListener("focus",check);document.addEventListener("visibilitychange",check);return()=>{window.clearInterval(timer);window.removeEventListener("focus",check);document.removeEventListener("visibilitychange",check)}},[reload])
 async function read(id:string){if(!org)return;if(await markWorkspaceNotificationRead(org,id))reload()}
 return <DropdownMenu onOpenChange={open=>{if(open){void refresh();reload()}}}>
  <DropdownMenuTrigger render={<Button type="button" variant="outline" size="icon" className="relative" aria-label={"Notifications, "+count+" unread"}/>}><Bell/>{count>0?<span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-purple-500 px-1 text-[10px] font-semibold text-white">{count}</span>:null}</DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="max-h-[75svh] w-80! overflow-y-auto"><div className="flex items-center justify-between px-2 py-2"><span className="text-sm font-semibold">Notifications</span>{unread>0?<button className="text-xs text-primary" onClick={async()=>{if(org&&await markWorkspaceNotificationsRead(org))reload()}}>Mark all read</button>:null}</div><DropdownMenuSeparator/><ProjectInvitationNotificationItems/><DropdownMenuSeparator/>
   {!current?<p className="p-3 text-sm text-muted-foreground">Loading notifications…</p>:current.failed?<div className="p-3"><p className="text-sm text-muted-foreground">Notifications could not be loaded.</p><Button variant="ghost" size="sm" onClick={reload}>Retry</Button></div>:rows.length?rows.map(n=><DropdownMenuItem key={n.id} render={<Link href={notificationHref(n)} onClick={()=>{if(!n.read_at)void read(n.id)}}/>}><span className="grid min-w-0 gap-1 py-1"><span className={"whitespace-normal break-words leading-5 "+(n.read_at?"text-muted-foreground":"font-medium")}>{n.title}</span><span className="text-[11px] text-muted-foreground">{new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Cairo"}).format(new Date(n.created_at))}</span></span></DropdownMenuItem>):<p className="p-3 text-sm text-muted-foreground">No other notifications.</p>}
  </DropdownMenuContent>
 </DropdownMenu>
}
