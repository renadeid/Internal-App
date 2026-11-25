import {beforeEach,describe,expect,it,vi} from "vitest"
import {getWorkspaceOverview,markWorkspaceNotificationsRead} from "./workspace-overview"
const state=vi.hoisted(()=>({allowed:true,signedIn:true,fail:false,calls:[] as string[],filters:[] as string[]}))
vi.mock("./current-organizations",()=>({getAccessibleOrganizations:async()=>({status:"ready",organizations:state.allowed?[{id:"org"}]:[]})}))
vi.mock("./get-organization-projects",()=>({getOrganizationProjects:async()=>({status:"ready",projects:[]})}))
vi.mock("./get-organization-tasks",()=>({getOrganizationTasks:async()=>({status:"ready",tasks:[]})}))
vi.mock("./get-organization-campaigns",()=>({getOrganizationCampaigns:async()=>({status:"ready",campaigns:[]})}))
vi.mock("./shared-asset-actions",()=>({getSharedAssets:async()=>({ok:true,assets:[]})}))
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({auth:{getUser:async()=>({error:null,data:{user:state.signedIn?{id:"user"}:null}})},from:(table:string)=>{state.calls.push(table);const q={select:()=>q,update:()=>q,eq:(key:string,value:string)=>{state.filters.push(table+":"+key+"="+value);return q},is:()=>q,order:()=>q,limit:()=>q,single:async()=>({data:{role:"member"},error:null}),then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({error:state.fail?{}:null,data:[]}).then(resolve)};return q}})}))
beforeEach(()=>{state.allowed=true;state.signedIn=true;state.fail=false;state.calls=[];state.filters=[]})
describe("live workspace overview",()=>{
 it("shows empty real data without injecting demo records",async()=>{expect(await getWorkspaceOverview("org")).toMatchObject({status:"ready",projects:[],tasks:[],campaigns:[],assets:[],activity:[],notifications:[]})})
 it("rejects another organization before querying work records",async()=>{state.allowed=false;expect(await getWorkspaceOverview("other")).toEqual({status:"error"});expect(state.calls).toEqual([])})
 it("requires a signed-in user",async()=>{state.signedIn=false;expect(await getWorkspaceOverview("org")).toEqual({status:"error"});expect(state.calls).toEqual([])})
 it("scopes notifications to the current recipient",async()=>{await getWorkspaceOverview("org");expect(state.filters).toContain("notifications:recipient_id=user");expect(state.filters).toContain("activity_events:organization_id=org")})
 it("reports failed reads rather than fabricated zero totals",async()=>{state.fail=true;expect(await getWorkspaceOverview("org")).toEqual({status:"error"})})
 it("only marks the current user's organization notifications read",async()=>{expect(await markWorkspaceNotificationsRead("org")).toBe(true);expect(state.filters).toContain("notifications:recipient_id=user");expect(state.filters).toContain("notifications:organization_id=org")})
})
