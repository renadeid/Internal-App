import { expect, it } from "vitest"
import { viewerHtml } from "./viewer-html"
it("escapes shared text and rejects executable asset URLs", () => {
 const html = viewerHtml({kind:"asset",content:{title:'<script>alert(1)</script>',description:'<img src=x onerror=alert(1)>',url:'javascript:alert(1)'}})
 expect(html).not.toContain('<script>')
 expect(html).not.toContain('href="javascript:')
 expect(html).toContain('&lt;script&gt;')
})
it("renders only public task fields, without identities or internal routes", () => {
 const html=viewerHtml({kind:"project",content:{title:"Shared project",tasks:[{title:"Task",description:"Details",status:"todo",assignee_email:"private@example.test"}],members:["secret"]}})
 expect(html).toContain("Task")
 expect(html).not.toContain("private@example.test")
 expect(html).not.toContain("secret")
 expect(html).not.toContain("/projects/")
})
it("shows unavailable links without private data",()=>{
 expect(viewerHtml(null)).toContain("expired, was revoked")
})
