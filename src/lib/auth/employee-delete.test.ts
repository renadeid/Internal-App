import { beforeEach, describe, expect, it, vi } from "vitest"
import { deleteEmployee } from "./employee-profile-actions"
const state=vi.hoisted(()=>({role:"org_admin",targetRole:"member",target:true,otherOrg:false,otherAdmin:true,blocked:false,countError:false,deleteError:false,photoError:false,calls:[] as unknown[][],privileged:0,transfers:[] as unknown[],transferError:false}))
vi.mock("./current-organizations",()=>({getAccessibleOrganizations:async()=>({status:"ready",organizations:[{id:"roaya"}]})}))
vi.mock("./get-organization-people",()=>({getOrganizationPeople:vi.fn()}))
vi.mock("./get-organization-projects",()=>({getOrganizationProjects:vi.fn()}))
vi.mock("./get-organization-tasks",()=>({getOrganizationTasks:vi.fn()}))
vi.mock("@/lib/normalize-employee-photo",()=>({normalizeEmployeePhoto:vi.fn()}))
vi.mock("@/lib/employee-photos",()=>({employeePhotoBucket:"employee-photos",employeePhotoPath:(org:string,id:string)=>org+"/"+id+".webp",employeePhotoAdmin:vi.fn()}))
vi.mock("@/lib/supabase/public-env",()=>({readSupabasePublicEnv:()=>({url:"https://example.invalid"})}))
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({
 auth:{getUser:async()=>({data:{user:{id:"actor"}},error:null})},
 from:(table:string)=>{const f:Record<string,string>={};const q={select:()=>q,eq:(k:string,v:string)=>{f[k]=v;return q},maybeSingle:async()=>({error:null,data:table==="profiles"?{email:"employee@example.invalid"}:f.profile_id==="actor"?{role:state.role,created_at:"2026-01-01"}:state.target?{role:state.targetRole,created_at:"2026-01-01"}:null})};return q},
})}))
vi.mock("@supabase/supabase-js",()=>({createClient:()=>{
 state.privileged++
 return {
  rpc:async(_name:string,args:unknown)=>{state.transfers.push(args);return {error:state.blocked?{message:"work history"}:state.countError?{message:"unavailable"}:state.transferError?{message:"full access"}:null}},
  auth:{admin:{deleteUser:async(...args:unknown[])=>{state.calls.push(args);return {error:state.deleteError?{message:"foreign key"}:null}}}},
  storage:{from:()=>({remove:async()=>({error:state.photoError?{}:null})})},
  from:(table:string)=>{const filters:Record<string,string>={};const q={select:()=>q,eq:(key:string,value:string)=>{filters[key]=value;return q},then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(table==="organization_memberships"?{error:null,data:filters.role?state.otherAdmin?[{profile_id:"actor"},{profile_id:"employee"}]:[{profile_id:"employee"}]:[{organization_id:"roaya"},...(state.otherOrg?[{organization_id:"other"}]:[])]}:{error:state.countError?{}:null,count:state.countError?null:state.blocked&&table==="projects"?1:0}).then(resolve)};return q},
 }
}}))
beforeEach(()=>{state.role="org_admin";state.targetRole="member";state.target=true;state.otherOrg=false;state.otherAdmin=true;state.blocked=false;state.countError=false;state.deleteError=false;state.photoError=false;state.calls=[];state.privileged=0;state.transfers=[];state.transferError=false;vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY","test-secret")})
const remove=(id="employee",email="employee@example.invalid")=>deleteEmployee("roaya",id,email)
describe("permanent employee deletion",()=>{
 it.each(["admin","team_lead","member","viewer"])("denies %s without privileged access",async role=>{state.role=role;expect((await remove()).ok).toBe(false);expect(state.privileged).toBe(0)})
 it("blocks self-deletion",async()=>{expect((await remove("actor")).ok).toBe(false);expect(state.calls).toEqual([])})
 it("blocks a target outside the workspace",async()=>{state.target=false;expect((await remove()).ok).toBe(false);expect(state.privileged).toBe(0)})
 it("requires the actual employee email",async()=>{expect((await remove("employee","wrong@example.invalid")).ok).toBe(false);expect(state.privileged).toBe(0)})
 it("blocks deleting an account shared with another workspace",async()=>{state.otherOrg=true;expect((await remove()).ok).toBe(false);expect(state.calls).toEqual([])})
 it("protects the last Super admin",async()=>{state.targetRole="org_admin";state.otherAdmin=false;expect((await remove()).ok).toBe(false);expect(state.calls).toEqual([])})
 it("retains authors referenced by historical records",async()=>{state.blocked=true;expect((await remove()).ok).toBe(false);expect(state.calls).toEqual([])})
 it("fails closed when references cannot be checked",async()=>{state.countError=true;expect((await remove()).ok).toBe(false);expect(state.calls).toEqual([])})
 it("does not claim success when a concurrent foreign key blocks deletion",async()=>{state.deleteError=true;expect((await remove()).ok).toBe(false)})
 it("defaults transfer to the current Super admin",async()=>{await remove();expect(state.transfers).toEqual([{actor:"actor",target_organization:"roaya",departing_employee:"employee",recipient:"actor"}])})
 it("passes an explicitly chosen recipient",async()=>{await deleteEmployee("roaya","employee","employee@example.invalid","recipient");expect(state.transfers).toEqual([expect.objectContaining({recipient:"recipient"})])})
 it("requires recipient project access before deletion",async()=>{state.transferError=true;expect(await remove()).toMatchObject({ok:false,message:expect.stringContaining("full access")});expect(state.calls).toEqual([])})
 it("explains when transfer succeeded but Auth deletion failed",async()=>{state.deleteError=true;expect(await remove()).toMatchObject({ok:false,message:expect.stringContaining("Work was transferred")})})
 it("explicitly requests permanent Auth deletion, with no soft deletion",async()=>{expect((await remove()).ok).toBe(true);expect(state.calls).toEqual([["employee",false]])})
 it("reports photo cleanup separately after account deletion",async()=>{state.photoError=true;expect(await remove()).toMatchObject({ok:true,message:expect.stringContaining("cleanup")});expect(state.calls).toHaveLength(1)})
})
