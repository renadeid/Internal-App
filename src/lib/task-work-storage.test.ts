import {afterAll,beforeAll,expect,it} from "vitest"
import {readWorkTicket,signWorkTicket,taskWorkPath,type WorkTicket} from "./task-work-storage"
const previous=process.env.SUPABASE_SERVICE_ROLE_KEY
beforeAll(()=>{process.env.SUPABASE_SERVICE_ROLE_KEY="isolated-ticket-test-secret"})
afterAll(()=>{if(previous===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=previous})
const ticket:WorkTicket={id:"11111111-1111-4111-8111-111111111111",taskId:"22222222-2222-4222-8222-222222222222",organizationId:"33333333-3333-4333-8333-333333333333",actorId:"44444444-4444-4444-8444-444444444444",note:"Draft",link:"",fileName:"draft.txt",size:5,mime:"text/plain",expires:Date.now()+60000}
it("binds the upload to its actor, task and work details",()=>expect(readWorkTicket(signWorkTicket(ticket))).toEqual(ticket))
it("rejects tampered and expired upload tickets",()=>{
 const signed=signWorkTicket(ticket);const [body,sig]=signed.split(".");const altered=Buffer.from(JSON.stringify({...ticket,actorId:"another actor"})).toString("base64url")
 expect(()=>readWorkTicket(altered+"."+sig)).toThrow();expect(()=>readWorkTicket(body+".invalid")).toThrow();expect(()=>readWorkTicket(signWorkTicket({...ticket,expires:0}))).toThrow()
})
it("rejects file addresses outside the exact organization/task/submission path",()=>{
 expect(taskWorkPath(ticket.organizationId,ticket.taskId,ticket.id)).toBe(`${ticket.organizationId}/${ticket.taskId}/${ticket.id}`)
 expect(()=>taskWorkPath(ticket.organizationId,"../other",ticket.id)).toThrow()
})
