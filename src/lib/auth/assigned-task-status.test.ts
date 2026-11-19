import { beforeEach, expect, it, vi } from "vitest"
import { createOrganizationTask, updateOrganizationTask, setOrganizationTaskStatus } from "./task-creation-actions"
const org="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", project="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", task="cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const state=vi.hoisted(()=>({ rpc:vi.fn(), allowed:true, signedIn:true, result:{data:true as boolean,error:null as null|{code:string}} }))
vi.mock("@/lib/auth/current-organizations",()=>({getAccessibleOrganizations:async()=>({status:"ready",organizations:state.allowed?[{id:org}]:[]})}))
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({
 auth:{getUser:async()=>({data:{user:state.signedIn?{id:"member"}:null}})},
 from(table:string){const q={select(){return q},eq(){return q},async maybeSingle(){return {data:table==="organization_memberships"?{role:"member"}:table==="project_members"?{role:"project_member",history_access:"assigned_only"}:{id:project,archived_at:null},error:null}}};return q},
 rpc:async(...args:unknown[])=>{state.rpc(...args);return state.result},
})}))
const input={organizationId:org,projectId:project,taskId:task,status:"in_progress" as const}
beforeEach(()=>{state.rpc.mockClear();state.allowed=true;state.signedIn=true;state.result={data:true,error:null}})
it("uses the status-only RPC for restricted members with exact tenant/task scope",async()=>{
 expect(await setOrganizationTaskStatus(input)).toEqual({status:"updated"})
 expect(state.rpc).toHaveBeenCalledWith("set_assigned_task_status",{target_organization:org,target_project:project,target_task:task,next_status:"in_progress"})
})
it("preserves database denial and no-match results",async()=>{
 state.result={data:false,error:{code:"42501"}}
 expect(await setOrganizationTaskStatus(input)).toEqual({status:"denied"})
 state.result={data:false,error:null}
 expect(await setOrganizationTaskStatus(input)).toEqual({status:"unavailable"})
})
it("rejects invalid input and unauthorised organizations without calling the RPC",async()=>{
 expect(await setOrganizationTaskStatus({...input,taskId:"invalid"})).toMatchObject({status:"invalid"})
 state.allowed=false
 expect(await setOrganizationTaskStatus(input)).toEqual({status:"rejected"})
 expect(state.rpc).not.toHaveBeenCalled()
})
it("does not turn status-only permission into task creation or detail editing",async()=>{
 const details={...input,title:"Forbidden",description:"Details",assigneeId:null,priority:"medium" as const,dueOn:null}
 expect(await createOrganizationTask(details)).toEqual({status:"denied"})
 expect(await updateOrganizationTask(details)).toEqual({status:"denied"})
 expect(state.rpc).not.toHaveBeenCalled()
})
