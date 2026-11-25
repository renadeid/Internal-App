import { NextResponse, type NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/update-session"

export async function proxy(request: NextRequest) {
  // This bundled login background must load before authentication.
  if (request.nextUrl.pathname === "/brand/login/option-2.mp4") return NextResponse.next()
  return updateSession(request)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
