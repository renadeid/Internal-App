import { describe, expect, it } from "vitest"
import { requestStatusLabel, validateDepartmentRequest, type DepartmentRequestDraft } from "./department-requests"
const draft:DepartmentRequestDraft={title:"  Launch design  ",brief:"  Create the approved launch artwork.  ",departmentId:"2529044e-c32c-442f-8d92-56580b7d01ef",referenceUrl:"https://example.com/brief",priority:"high",dueOn:"2026-12-01"}
describe("department request brief",()=>{
 it("normalizes text without altering its department, date or priority",()=>{expect(validateDepartmentRequest(draft)).toEqual({...draft,title:"Launch design",brief:"Create the approved launch artwork."})})
 it.each([{title:" "},{title:"x".repeat(161)},{brief:""},{brief:"x".repeat(6001)},{departmentId:"bad"},{dueOn:"2026-02-30"},{dueOn:"2026-13-01"},{referenceUrl:"javascript:alert(1)"},{referenceUrl:"http://example.com"},{referenceUrl:"https://user:password@example.com"}])("rejects invalid request details %j",change=>{expect(()=>validateDepartmentRequest({...draft,...change})).toThrow()})
 it("allows no requested date or reference link",()=>{expect(validateDepartmentRequest({...draft,dueOn:"",referenceUrl:""})).toMatchObject({dueOn:"",referenceUrl:""})})
})
describe("request progress",()=>{
 it.each([
  ["submitted",null,false,"Awaiting triage"],["declined",null,false,"Declined"],["cancelled",null,false,"Cancelled"],
  ["accepted","todo",false,"Scheduled"],["accepted","in_progress",false,"In progress"],["accepted","in_review",false,"In review"],
  ["accepted","done",false,"Completed"],["accepted","todo",true,"Task archived"],["accepted",null,false,"Task unavailable"],
 ] as const)("describes %s / %s",(status,taskStatus,taskArchived,label)=>{expect(requestStatusLabel({status,taskStatus,taskArchived})).toBe(label)})
})
