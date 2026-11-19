import { Suspense } from "react"
import type { Metadata } from "next"
import { FolderKanban, ListTodo, ShieldCheck } from "lucide-react"

import { LoginForm } from "@/app/login/login-form"
import { BrandLogo } from "@/components/shared/brand-logo"

export const metadata: Metadata = {
  title: "Sign in",
}

export default function LoginPage() {
  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <section className="roaya-login-scene hidden flex-col justify-between gap-12 p-8 sm:p-12 lg:flex lg:p-16">
        <div aria-label="Roaya Connect" className="flex w-fit items-center gap-4 self-start rounded-2xl bg-white/95 px-4 py-3"><BrandLogo className="w-40" /><span className="border-s border-navy-200 ps-4 text-sm font-semibold text-navy-600">Connect</span></div>
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold tracking-[.04em] text-white/90 uppercase"><ShieldCheck className="size-4" aria-hidden />Your organisation workspace</span>
          <h2 className="mt-6 text-[clamp(2.25rem,4vw,4.5rem)] leading-[1.08] font-extrabold tracking-[-0.025em]">The work.<br />The team.<br /><span className="roaya-hero-accent">One shared place.</span></h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-slate-300">Keep projects, tasks and shared resources together, with the right access for every person.</p>
          <div className="mt-8 flex flex-wrap gap-4 text-sm text-slate-200"><span className="inline-flex items-center gap-2"><FolderKanban className="size-5 text-teal-300" aria-hidden />Projects & resources</span><span className="inline-flex items-center gap-2"><ListTodo className="size-5 text-teal-300" aria-hidden />Tasks & collaboration</span></div>
        </div>
        <p className="text-xs text-slate-400">Roaya Connect · Your team’s daily workspace</p>
      </section>
      <div className="flex items-center justify-center px-5 py-12 sm:px-12">
      <div className="w-full max-w-md">
        <div className="mb-6 grid gap-2">
          <div aria-label="Roaya Connect" className="flex items-center gap-4"><BrandLogo className="w-40" /><span className="border-s border-navy-200 ps-4 text-sm font-semibold text-navy-600">Connect</span></div>
          <span className="text-xs text-muted-foreground">Welcome to your workspace</span>
        </div>
        <section className="roaya-glass p-6 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Sign in
          </h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Use the email and password for your Roaya Connect account.
          </p>
          <div className="mt-5">
            <Suspense fallback={<p className="text-sm text-muted-foreground">Loading sign-in…</p>}><LoginForm /></Suspense>
          </div>
        </section>
      </div>
      </div>
    </main>
  )
}
