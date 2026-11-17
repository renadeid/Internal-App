import type { Metadata } from "next"

import { LoginForm } from "@/app/login/login-form"

export const metadata: Metadata = {
  title: "Sign in",
}

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
            CH
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-tight text-foreground">
              Company Hub
            </span>
            <span className="block text-xs text-muted-foreground">Northline</span>
          </span>
        </div>
        <section className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h1 className="text-base font-semibold tracking-tight text-foreground">
            Sign in
          </h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Use the email and password for your Company Hub account.
          </p>
          <div className="mt-5">
            <LoginForm />
          </div>
        </section>
      </div>
    </main>
  )
}
