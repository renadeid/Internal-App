import { describe, expect, it, vi } from "vitest"
import sharp from "sharp"
import { normalizeEmployeePhoto } from "./normalize-employee-photo"
import { employeePhotoPath } from "./employee-photos"
vi.mock("server-only",()=>({}))

describe("employee photo processing",()=>{
 it("decodes, crops and re-encodes a photo at 512px",async()=>{
  const image=await sharp({create:{width:800,height:600,channels:3,background:"#3d5a80"}}).png().toBuffer()
  const result=await normalizeEmployeePhoto(new File([new Uint8Array(image)],"photo.png",{type:"image/png"}))
  const info=await sharp(result).metadata()
  expect(info).toMatchObject({width:512,height:512,format:"webp"})
  expect(info.exif).toBeUndefined()
 })
 it("rejects oversized images",async()=>{await expect(normalizeEmployeePhoto(new File([new Uint8Array(2*1024*1024+1)],"large.jpg",{type:"image/jpeg"}))).rejects.toThrow()})
 it("rejects disguised SVG content",async()=>{await expect(normalizeEmployeePhoto(new File(['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'],"fake.png",{type:"image/png"}))).rejects.toThrow()})
 it("rejects invalid image bytes",async()=>{await expect(normalizeEmployeePhoto(new File(["not an image"],"fake.jpg",{type:"image/jpeg"}))).rejects.toThrow()})
 it("rejects paths outside the expected organization and employee scope",()=>{expect(()=>employeePhotoPath("../other","employee")).toThrow()})
})
