import {Suspense} from "react"
import type {Metadata} from "next"
import {notFound} from "next/navigation"
import {OrganizationCampaignRecord} from "@/components/marketing/organization-campaign-record"
export const metadata:Metadata={title:"Campaign"}
type Props={params:Promise<{id:string}>}
export default function CampaignPage({params}:Props){return <Suspense fallback={<p>Loading campaign…</p>}><CampaignRoute params={params}/></Suspense>}
async function CampaignRoute({params}:Props){const {id}=await params;if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();return <OrganizationCampaignRecord campaignId={id}/>}
