import {Suspense} from "react"
import type {Metadata} from "next"
import {notFound} from "next/navigation"
import {SharedAssetDetail} from "@/components/assets/shared-assets-library"
export const metadata:Metadata={title:"Asset"}
type Props={params:Promise<{id:string}>}
export default function AssetPage({params}:Props){return <Suspense fallback={<p>Loading asset…</p>}><AssetRoute params={params}/></Suspense>}
async function AssetRoute({params}:Props){const {id}=await params;if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();return <SharedAssetDetail assetId={id}/>}
