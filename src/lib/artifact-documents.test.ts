import {expect,it} from "vitest"
import {validateArtifactFile,artifactMaxBytes} from "./artifact-documents"
it.each(["brief.md","brief.markdown","notes.txt"])("accepts %s",name=>{expect(validateArtifactFile(name,"# Brief"," Brief ")).toMatchObject({file_name:name,title:"Brief"})})
it.each(["page.html","script.js","file.pdf"])("rejects executable or unsupported %s",name=>{expect(()=>validateArtifactFile(name,"content","Title")).toThrow()})
it("enforces byte size for non-ASCII content",()=>{expect(()=>validateArtifactFile("large.md","ا".repeat(artifactMaxBytes/2+1),"Title")).toThrow("512 KB")})
it("rejects empty files and null bytes",()=>{expect(()=>validateArtifactFile("a.md"," ","A")).toThrow();expect(()=>validateArtifactFile("a.md","a\u0000b","A")).toThrow()})
