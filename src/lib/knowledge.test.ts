import { expect, it } from "vitest"
import { validateArticle, type ArticleDraft } from "./knowledge"

const draft: ArticleDraft = {title:" Welcome ",summary:" Read this ",body:" Real company content ",category:"Getting started",departmentId:"",status:"draft",sourceUrl:""}
it("normalizes article text and keeps company-wide categories unassigned",()=>{expect(validateArticle({...draft,departmentId:"ignored"})).toMatchObject({title:"Welcome",summary:"Read this",body:"Real company content",department_id:null,status:"draft"})})
it.each(["javascript:alert(1)","http://example.com","https://user:password@example.com"])("rejects unsafe resource URL %s",sourceUrl=>{expect(()=>validateArticle({...draft,sourceUrl})).toThrow()})
it("requires a department for department guides",()=>{expect(()=>validateArticle({...draft,category:"Department guides"})).toThrow("Choose a department")})
it("accepts a department guide with an HTTPS resource",()=>{expect(validateArticle({...draft,category:"Department guides",departmentId:"11111111-1111-4111-8111-111111111111",sourceUrl:"https://example.com/document"})).toMatchObject({department_id:"11111111-1111-4111-8111-111111111111",source_url:"https://example.com/document"})})
it.each([{title:" "},{body:" "},{title:"a".repeat(161)},{summary:"a".repeat(401)},{body:"a".repeat(30001)}])("rejects missing or oversized content",change=>{expect(()=>validateArticle({...draft,...change})).toThrow()})
