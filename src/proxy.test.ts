import {beforeEach,expect,it,vi} from "vitest"
import {NextRequest,NextResponse} from "next/server"
import {proxy} from "./proxy"
import {updateSession} from "@/lib/supabase/update-session"

vi.mock("@/lib/supabase/update-session",()=>({updateSession:vi.fn()}))
beforeEach(()=>vi.mocked(updateSession).mockReset())
it("serves the bundled sign-in film without requiring a session",async()=>{
 const response=await proxy(new NextRequest("https://roaya-connect.vercel.app/brand/login/option-2.mp4"))
 expect(response.headers.get("x-middleware-next")).toBe("1")
 expect(updateSession).not.toHaveBeenCalled()
})
it.each(["/assets/example/file","/brand/login/private.mp4","/brand/login/option-2.mp4/private","/projects"])("keeps session protection for %s",async path=>{
 const redirect=NextResponse.redirect("https://roaya-connect.vercel.app/login")
 vi.mocked(updateSession).mockResolvedValue(redirect)
 expect(await proxy(new NextRequest("https://roaya-connect.vercel.app"+path))).toBe(redirect)
 expect(updateSession).toHaveBeenCalledOnce()
})
