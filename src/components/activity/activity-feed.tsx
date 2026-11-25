"use client"
import Link from "next/link"
import {useLiveWorkspace} from "@/components/workspace/live-workspace-provider"
import {Button} from "@/components/ui/button"
export function LiveActivityList({limit=100}:{limit?:number}){
 const {result,refresh}=useLiveWorkspace();if(!result)return <p role="status" className="text-sm">Loading activity…</p>
 if(result.status!=="ready")return <div className="grid gap-3 text-sm"><p>Activity could not be loaded.</p><Button className="w-fit" variant="outline" onClick={refresh}>Retry</Button></div>
 if(!result.activity.length)return <p className="py-4 text-sm text-muted-foreground">No activity to show yet.</p>
 return <ul className="divide-y divide-border">{result.activity.slice(0,limit).map(a=><li key={a.id} className="py-3"><Link className="text-sm leading-6 hover:text-primary" href={a.asset_id?"/assets/"+a.asset_id:a.campaign_id?"/workspaces/marketing/campaigns/"+a.campaign_id:a.project_id?"/projects/"+a.project_id:"/activity"}>{a.summary}</Link><p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Cairo",dateStyle:"medium",timeStyle:"short"}).format(new Date(a.created_at))}</p></li>)}</ul>
}
export function ActivityFeed(){return <div className="roaya-glass p-5"><LiveActivityList/></div>}
