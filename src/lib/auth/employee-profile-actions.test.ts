import { beforeEach, describe, expect, it, vi } from "vitest"
import { updateEmployeeDetails, uploadEmployeePhoto } from "./employee-profile-actions"

vi.mock("@/lib/employee-photos",()=>({employeePhotoBucket:"employee-photos",employeePhotoPath:(org:string,id:string)=>org+"/"+id+".webp",employeePhotoAdmin:()=>{state.adminCalls++;return {storage:{getBucket:async()=>({data:{public:false},error:null}),from:()=>({upload:async()=>({error:null})})}}}}))
vi.mock("@/lib/normalize-employee-photo",()=>({normalizeEmployeePhoto:async()=>Buffer.from("validated-image")}))
const state = vi.hoisted(() => ({ allowed: true, signedIn: true, role: "org_admin", targetBelongs: true, adminCalls: 0, payload: null as unknown, profile: "" }))
vi.mock("./current-organizations", () => ({ getAccessibleOrganizations: async () => ({ status: "ready", organizations: state.allowed ? [{id:"roaya"}] : [] }) }))
vi.mock("./get-organization-people", () => ({ getOrganizationPeople: vi.fn() }))
vi.mock("./get-organization-projects", () => ({ getOrganizationProjects: vi.fn() }))
vi.mock("./get-organization-tasks", () => ({ getOrganizationTasks: vi.fn() }))
vi.mock("@/lib/supabase/public-env", () => ({ readSupabasePublicEnv: () => ({url:"https://example.invalid",publishableKey:"public"}) }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
 auth: {getUser: async () => ({data:{user:state.signedIn?{id:"actor"}:null},error:null})},
 from: () => {const filters:Record<string,string>={};const q={select:()=>q,eq:(k:string,v:string)=>{filters[k]=v;return q},maybeSingle:async()=>({error:null,data:filters.profile_id==="actor"?{role:state.role}:state.targetBelongs?{created_at:"2026-11-01"}:null})};return q},
}) }))
vi.mock("@supabase/supabase-js", () => ({
 createClient: () => {
  state.adminCalls++
  return {
   from: () => ({
    update: (payload: unknown) => {
     state.payload = payload
     return {
      eq: (_key: string, value: string) => {
       state.profile = value
       return { select: async () => ({ data: [{ id: value }], error: null }) }
      },
     }
    },
   }),
  }
 },
}))

beforeEach(()=>{state.allowed=true;state.signedIn=true;state.role="org_admin";state.targetBelongs=true;state.adminCalls=0;state.payload=null;state.profile="";vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY","test-server-only")})
const input={name:"  Ada Lovelace  ",jobTitle:"  Designer  ",avatarColor:"#3D5A80"}
describe("employee profile updates",()=>{
 it.each(["admin","team_lead","member","viewer"])("denies privileged writes for %s",async role=>{state.role=role;expect((await updateEmployeeDetails("roaya","employee",input)).ok).toBe(false);expect(state.adminCalls).toBe(0)})
 it("rejects a target outside the organization before creating a privileged client",async()=>{state.targetBelongs=false;expect((await updateEmployeeDetails("roaya","outsider",input)).ok).toBe(false);expect(state.adminCalls).toBe(0)})
 it("rejects an unavailable organization",async()=>{state.allowed=false;expect((await updateEmployeeDetails("other","employee",input)).ok).toBe(false);expect(state.adminCalls).toBe(0)})
 it("rejects signed-out requests",async()=>{state.signedIn=false;expect((await updateEmployeeDetails("roaya","employee",input)).ok).toBe(false);expect(state.adminCalls).toBe(0)})
 it("validates values before privileged writes",async()=>{expect((await updateEmployeeDetails("roaya","employee",{...input,avatarColor:"url(evil)"})).ok).toBe(false);expect(state.adminCalls).toBe(0)})
 it("writes only employee presentation fields for the verified target",async()=>{expect((await updateEmployeeDetails("roaya","employee",input)).ok).toBe(true);expect(state.profile).toBe("employee");expect(state.payload).toEqual({full_name:"Ada Lovelace",job_title:"Designer",avatar_color:"#3D5A80",initials:"AL"})})
})

describe("employee photo authorization",()=>{
 it.each(["admin","team_lead","member","viewer"])("rejects %s before storage access",async role=>{state.role=role;expect((await uploadEmployeePhoto("roaya","employee",new FormData())).ok).toBe(false);expect(state.adminCalls).toBe(0)})
 it("rejects an employee outside the organization before storage access",async()=>{state.targetBelongs=false;expect((await uploadEmployeePhoto("roaya","outsider",new FormData())).ok).toBe(false);expect(state.adminCalls).toBe(0)})
 it("rejects a missing upload without accessing storage",async()=>{expect((await uploadEmployeePhoto("roaya","employee",new FormData())).ok).toBe(false);expect(state.adminCalls).toBe(0)})
 it("uploads an authorized employee photo",async()=>{const data=new FormData();data.set("photo",new File(["image"],"photo.png",{type:"image/png"}));expect((await uploadEmployeePhoto("roaya","employee",data)).ok).toBe(true);expect(state.adminCalls).toBe(1)})
})
