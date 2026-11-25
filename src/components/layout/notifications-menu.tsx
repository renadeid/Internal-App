"use client"
import Link from "next/link"
import {Bell} from "lucide-react"
import {ProjectInvitationNotificationItems,useProjectInvitations} from "@/components/projects/project-invitations"
import {useLiveWorkspace} from "@/components/workspace/live-workspace-provider"
import {markWorkspaceNotificationsRead} from "@/lib/auth/workspace-overview"
import {useOrganization} from "@/components/auth/organization-provider"
import {Button} from "@/components/ui/button"
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuSeparator,DropdownMenuTrigger} from "@/components/ui/dropdown-menu"
export function NotificationsMenu(){
 const {invitations,refresh}=useProjectInvitations();const live=useLiveWorkspace();const {activeOrganization}=useOrganization();const rows=live.result?.status==="ready"?live.result.notifications:[];const unread=rows.filter(n=>!n.read_at).length;const count=unread+invitations.length
 return <DropdownMenu onOpenChange={open=>{if(open){void refresh();live.refresh()}}}><DropdownMenuTrigger render={<Button type="button" variant="outline" size="icon" className="relative" aria-label={"Notifications, "+count+" unread"}/>}><Bell/>{count>0?<span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-purple-500 px-1 text-[10px] font-semibold text-white">{count}</span>:null}</DropdownMenuTrigger><DropdownMenuContent align="end" className="w-80!"><div className="flex items-center justify-between px-2 py-2"><span className="text-sm font-semibold">Notifications</span>{unread>0?<button className="text-xs text-primary" onClick={async()=>{if(activeOrganization&&await markWorkspaceNotificationsRead(activeOrganization.id))live.refresh()}}>Mark all read</button>:null}</div><DropdownMenuSeparator/><ProjectInvitationNotificationItems/><DropdownMenuSeparator/>{!live.result?<p className="p-3 text-sm text-muted-foreground">Loading notifications…</p>:live.result.status!=="ready"?<p className="p-3 text-sm text-muted-foreground">Notifications could not be loaded.</p>:rows.length?rows.map(n=><DropdownMenuItem key={n.id} render={<Link href="/activity"/>}><span className={n.read_at?"text-muted-foreground":"font-medium"}>{n.title}</span></DropdownMenuItem>):<p className="p-3 text-sm text-muted-foreground">No other notifications.</p>}</DropdownMenuContent></DropdownMenu>
}
