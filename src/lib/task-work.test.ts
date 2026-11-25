import {describe,it,expect} from "vitest"
import {taskWorkDetails,reviewDetails} from "./task-work"
describe("submitted work validation",()=>{
 it("normalizes notes and accepts HTTPS references",()=>expect(taskWorkDetails(" Draft "," https://example.com/work ")).toEqual({note:"Draft",link:"https://example.com/work"}))
 it.each(["http://example.com","javascript:alert(1)","https://user:pass@example.com","//example.com","not a link"])("rejects unsafe work link %s",link=>expect(()=>taskWorkDetails("",link)).toThrow())
 it("limits notes and link size",()=>{expect(()=>taskWorkDetails("x".repeat(4001),"")).toThrow();expect(()=>taskWorkDetails("","https://example.com/"+"x".repeat(2000))).toThrow()})
 it("requires useful feedback when requesting changes",()=>{expect(()=>reviewDetails("changes_requested","  ")).toThrow();expect(reviewDetails("changes_requested"," Fix the title ")).toBe("Fix the title")})
 it("allows approval without a comment and rejects invented decisions",()=>{expect(reviewDetails("approved","")).toBe("");expect(()=>reviewDetails("done","")).toThrow()})
})
