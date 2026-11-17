import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import type { Database } from "@/lib/supabase/database"
import { readSupabasePublicEnv } from "@/lib/supabase/public-env"

/**
 * Refreshes the Supabase session from request cookies and returns the response
 * that must be sent to the browser. Identity is `getUser()`, which checks the
 * token with Supabase Auth.
 */
export async function updateSession(request: NextRequest) {
  const { url, publishableKey } = readSupabasePublicEnv()
  let response = NextResponse.next({ request })
  const pendingCookies: {
    name: string
    value: string
    options?: Parameters<NextResponse["cookies"]["set"]>[2]
  }[] = []

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        pendingCookies.splice(0, pendingCookies.length, ...cookiesToSet)
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const { data } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname
  const isLogin = pathname === "/login"

  if (!data.user && !isLogin) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/login"
    redirectUrl.search = ""
    return applyCookies(NextResponse.redirect(redirectUrl), pendingCookies)
  }

  if (data.user && isLogin) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/"
    redirectUrl.search = ""
    return applyCookies(NextResponse.redirect(redirectUrl), pendingCookies)
  }

  return response
}

function applyCookies(
  response: NextResponse,
  cookies: {
    name: string
    value: string
    options?: Parameters<NextResponse["cookies"]["set"]>[2]
  }[]
) {
  cookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })
  return response
}
