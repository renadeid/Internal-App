"use client"
import {createContext,useContext,useEffect,useState,useCallback} from "react"
import {usePathname} from "next/navigation"
import {useOrganization} from "@/components/auth/organization-provider"
import {getWorkspaceOverview} from "@/lib/auth/workspace-overview"
type Result=Awaited<ReturnType<typeof getWorkspaceOverview>>
const Context=createContext<{result:Result|null;refresh:()=>void}>({result:null,refresh:()=>{}})
export function LiveWorkspaceProvider({children}:{children:React.ReactNode}){const {activeOrganization}=useOrganization();return <LiveWorkspace key={activeOrganization?.id??"none"} organizationId={activeOrganization?.id}>{children}</LiveWorkspace>}
function LiveWorkspace({organizationId,children}:{organizationId?:string;children:React.ReactNode}){
 const [result,setResult]=useState<Result|null>(null);const [generation,setGeneration]=useState(0);const path=usePathname();const refresh=useCallback(()=>setGeneration(v=>v+1),[])
 useEffect(()=>{if(!organizationId)return;let active=true;getWorkspaceOverview(organizationId).then(r=>{if(active)setResult(r)}).catch(()=>{if(active)setResult({status:"error"})});return()=>{active=false}},[organizationId,path,generation])
 useEffect(()=>{window.addEventListener("focus",refresh);return()=>window.removeEventListener("focus",refresh)},[refresh])
 return <Context.Provider value={{result,refresh}}>{children}</Context.Provider>
}
export function useLiveWorkspace(){return useContext(Context)}
