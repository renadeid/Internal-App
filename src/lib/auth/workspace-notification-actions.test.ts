import {beforeEach,expect,it,vi} from "vitest"
import {getWorkspaceNotifications,markWorkspaceNotificationRead} from "./workspace-notification-actions"
const org="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",id="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const state=vi.hoisted(()=>({allowed:true,signedIn:true,eq:vi.fn(),update:vi.fn(),error:null as null|{message:string}}))
vi.mock("./current-organizations",()=>({getAccessibleOrganizations:async()=>({status:"ready",organizations:state.allowed?[{id:org}]:[]})}))
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({auth:{getUser:async()=>({data:{user:state.signedIn?{id:"actor"}:null},error:null})},from:()=>{
 const query={select(){return query},update(value:unknown){state.update(value);return query},eq(...args:unknown[]){state.eq(...args);return query},is(){return query},order(){return query},limit(){return query},then(resolve:(value:unknown)=>unknown){return Promise.resolve({data:[],error:state.error}).then(resolve)}}
 return query
}})}))
beforeEach(()=>{state.allowed=true;state.signedIn=true;state.error=null;state.eq.mockClear();state.update.mockClear()})
it("scopes the inbox to both organization and authenticated recipient",async()=>{
 expect(await getWorkspaceNotifications(org)).toEqual({ok:true,rows:[]})
 expect(state.eq).toHaveBeenCalledWith("organization_id",org);expect(state.eq).toHaveBeenCalledWith("recipient_id","actor")
})
it("marks only the selected recipient's notification in this organization",async()=>{
 expect(await markWorkspaceNotificationRead(org,id)).toBe(true)
 expect(state.eq).toHaveBeenCalledWith("id",id);expect(state.eq).toHaveBeenCalledWith("organization_id",org);expect(state.eq).toHaveBeenCalledWith("recipient_id","actor")
 expect(state.update).toHaveBeenCalledWith({read_at:expect.any(String)})
})
it("denies foreign organizations before reading or writing rows",async()=>{
 state.allowed=false;expect(await getWorkspaceNotifications(org)).toEqual({ok:false});expect(await markWorkspaceNotificationRead(org,id)).toBe(false);expect(state.eq).not.toHaveBeenCalled()
})
it("denies signed-out users and invalid notification IDs",async()=>{
 state.signedIn=false;expect(await getWorkspaceNotifications(org)).toEqual({ok:false});expect(await markWorkspaceNotificationRead(org,id)).toBe(false);expect(await markWorkspaceNotificationRead(org,"invalid")).toBe(false);expect(state.update).not.toHaveBeenCalled()
})
it("does not report a failed read-state update as saved",async()=>{state.error={message:"Unavailable"};expect(await markWorkspaceNotificationRead(org,id)).toBe(false)})
