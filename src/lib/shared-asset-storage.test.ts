import {beforeEach,describe,expect,it,vi} from "vitest"
import sharp from "sharp"
import {readAssetUpload,signAssetUpload,sharedStoragePath,validateSharedFile,type AssetUploadTicket} from "./shared-asset-storage"
import {sharedFileKind,validateSharedDraft} from "./shared-assets"
vi.mock("server-only",()=>({}))
const id="11111111-1111-4111-8111-111111111111"
const ticket:AssetUploadTicket={organizationId:id,actorId:id,assetId:id,versionId:id,fileName:"logo.png",mime:"image/png",type:"image",size:100,expires:Date.now()+600000,draft:{name:"Logo",description:"",tags:[],collection:"General",visibility:"company",projectId:""}}
beforeEach(()=>vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY","test-secret"))
describe("shared file validation and tickets",()=>{
 it("rejects executable and active document formats",()=>{for(const name of ["page.html","script.js","logo.svg","app.exe","macro.docm"])expect(sharedFileKind(name)).toBeUndefined()})
 it("requires a project for project-only files",()=>{expect(()=>validateSharedDraft({...ticket.draft,visibility:"project_members"})).toThrow()})
 it("validates and normalizes asset metadata",()=>{expect(validateSharedDraft({...ticket.draft,name:" Logo ",tags:[" brand ","brand"],collection:""})).toMatchObject({name:"Logo",tags:["brand"],collection:"General"})})
 it("rejects a tampered upload capability",()=>{const signed=signAssetUpload(ticket);const [body,signature]=signed.split(".");const changed=Buffer.from(JSON.stringify({...ticket,actorId:"other"})).toString("base64url");expect(()=>readAssetUpload(changed+"."+signature)).toThrow();expect(readAssetUpload(body+"."+signature)).toEqual(ticket)})
 it("rejects expired upload capabilities",()=>{expect(()=>readAssetUpload(signAssetUpload({...ticket,expires:Date.now()-1}))).toThrow()})
 it("keeps storage paths inside their exact tenant and asset",()=>{expect(sharedStoragePath(id,id,id)).toBe(`${id}/${id}/v1/${id}`);expect(()=>sharedStoragePath("../other",id,id)).toThrow()})
 it("validates image contents rather than trusting the extension",async()=>{await expect(validateSharedFile(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'),"fake.png")).rejects.toThrow()})
 it("accepts a real image",async()=>{const image=await sharp({create:{width:16,height:16,channels:3,background:"#3d5a80"}}).png().toBuffer();await expect(validateSharedFile(image,"logo.png")).resolves.toMatchObject({mime:"image/png"})})
 it("rejects files above the bucket limit",async()=>{await expect(validateSharedFile(Buffer.alloc(20*1024*1024+1),"large.pdf")).rejects.toThrow()})
 it("rejects a disguised PDF or archive",async()=>{await expect(validateSharedFile(Buffer.from("<html>bad</html>"),"fake.pdf")).rejects.toThrow();await expect(validateSharedFile(Buffer.from("not a zip"),"fake.docx")).rejects.toThrow()})
})
