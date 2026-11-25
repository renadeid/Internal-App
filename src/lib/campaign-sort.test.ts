import {expect,it} from "vitest"
import {compareCampaigns} from "./campaign-sort"
const a={name:"Alpha",startsOn:"2026-11-20",endsOn:"2026-12-10"}
const b={name:"Beta",startsOn:"2026-12-01",endsOn:"2026-12-05"}
it("orders by end date independently of start date",()=>{expect([a,b].sort((a,b)=>compareCampaigns(a,b,"ending"))).toEqual([b,a])})
it("orders by start date independently of end date",()=>{expect([b,a].sort((a,b)=>compareCampaigns(a,b,"starting"))).toEqual([a,b])})
it.each(["ending","starting"])("puts missing dates last for %s",sort=>{const undated={name:"Aardvark",startsOn:"",endsOn:""};expect([undated,a].sort((a,b)=>compareCampaigns(a,b,sort))).toEqual([a,undated])})
it("breaks matching dates by name",()=>{expect(compareCampaigns({...a,name:"Beta"},a,"ending")).toBeGreaterThan(0)})
it("keeps past dates before future dates for explicitly earliest-first sorting",()=>{expect(compareCampaigns({...a,endsOn:"2026-11-01"},b,"ending")).toBeLessThan(0)})
