import {beforeEach,expect,it,vi} from "vitest"
import {getEmployeeProfile} from "./employee-profile-actions"
import {getOrganizationProjects} from "./get-organization-projects"
import {getOrganizationTasks} from "./get-organization-tasks"
const state=vi.hoisted(()=>({role:"member",signedIn:true,targetBelongs:true,allowed:true,tables:[] as string[]}))
vi.mock("./current-organizations",()=>({getAccessibleOrganizations:async()=>({status:"ready",organizations:state.allowed?[{id:"roaya"}]:[]})}))
vi.mock("./get-organization-people",()=>({getOrganizationPeople:async()=>({status:"ready",people:[{profileId:"employee",name:"Employee",role:"member"},{profileId:"actor",name:"Me",role:state.role}]})}))
vi.mock("./get-organization-projects",()=>({getOrganizationProjects:vi.fn(async()=>({status:"ready",projects:[{id:"visible-project",ownerId:"employee",archivedAt:null}]}))}))
vi.mock("./get-organization-tasks",()=>({getOrganizationTasks:vi.fn(async()=>({status:"ready",tasks:[{id:"their-task",assigneeId:"employee",projectId:"visible-project"},{id:"another-task",assigneeId:"someone-else",projectId:"visible-project"}]}))}))
vi.mock("@/lib/employee-photos",()=>({employeePhotoAdmin:vi.fn(),employeePhotoBucket:"employee-photos",employeePhotoPath:vi.fn()}))
vi.mock("@/lib/normalize-employee-photo",()=>({normalizeEmployeePhoto:vi.fn()}))
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({
 auth:{getUser:async()=>({data:{user:state.signedIn?{id:"actor"}:null},error:null})},
 from(table:string){state.tables.push(table);const filters:Record<string,string>={};const q={select(){return q},eq(key:string,value:string){filters[key]=value;return q},order(){return q},async maybeSingle(){return {error:null,data:table==="organization_memberships"?(filters.profile_id==="actor"?{role:state.role,created_at:"2026-01-01"}:state.targetBelongs?{role:"member",created_at:"2026-01-01"}:null):{job_title:"Designer"}}},then(resolve:(value:unknown)=>unknown){return Promise.resolve({data:[],error:null}).then(resolve)}};return q},
})}))
beforeEach(()=>{state.role="member";state.signedIn=true;state.targetBelongs=true;state.allowed=true;state.tables=[];vi.clearAllMocks()})
it.each(["member","viewer","admin"])("blocks %s from another employee's profile before loading work",async role=>{
 state.role=role;expect(await getEmployeeProfile("roaya","employee")).toEqual({status:"missing"});expect(getOrganizationProjects).not.toHaveBeenCalled();expect(getOrganizationTasks).not.toHaveBeenCalled();expect(state.tables.every(t=>t==="organization_memberships")).toBe(true)
})
it.each(["org_admin","team_lead"])("allows %s to inspect work returned by existing project permissions",async role=>{
 state.role=role;const result=await getEmployeeProfile("roaya","employee");expect(result.status).toBe("ready");if(result.status==="ready"){expect(result.profile.tasks.map(t=>t.id)).toEqual(["their-task"]);expect(result.profile.projects.map(p=>p.id)).toEqual(["visible-project"]);expect(result.profile.canManage).toBe(role==="org_admin")}
})
it.each(["member","viewer","admin"])("keeps own profile available to %s",async role=>{state.role=role;const result=await getEmployeeProfile("roaya","actor");expect(result.status).toBe("ready");if(result.status==="ready")expect(result.profile.isSelf).toBe(true)})
it("rejects cross-organization targets and signed-out requests",async()=>{state.role="org_admin";state.targetBelongs=false;expect(await getEmployeeProfile("roaya","employee")).toEqual({status:"missing"});state.targetBelongs=true;state.signedIn=false;expect(await getEmployeeProfile("roaya","employee")).toEqual({status:"missing"});expect(getOrganizationTasks).not.toHaveBeenCalled()})
