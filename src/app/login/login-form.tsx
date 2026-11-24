"use client"

import { useState } from "react"
import { ArrowRight, Eye, EyeOff } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { safeReturnPath } from "@/lib/auth/safe-return-path"
import { createClient } from "@/lib/supabase/client"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setError("Enter your email and password.")
      return
    }

    setPending(true)
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    })

    if (signInError) {
      setPending(false)
      setError(messageForSignInError(signInError.message))
      return
    }

    setPending(false)
    router.push(safeReturnPath(searchParams.get("next")))
    router.refresh()
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          className="h-11"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={pending}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
        <Input
          id="password"
          className="h-11 pe-12"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={pending}
        />
          <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} aria-controls="password" disabled={pending} onClick={()=>setShowPassword(value=>!value)} className="absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-e-lg text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50">{showPassword?<EyeOff className="size-4" aria-hidden/>:<Eye className="size-4" aria-hidden/>}</button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Signing in…" : <>Sign in <ArrowRight className="size-[18px]" aria-hidden /></>}
      </Button>
    </form>
  )
}

function messageForSignInError(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes("invalid login credentials")) {
    return "The email or password is incorrect."
  }

  if (normalized.includes("email not confirmed")) {
    return "Confirm your email before signing in."
  }

  if (
    normalized.includes("too many requests") ||
    normalized.includes("rate limit")
  ) {
    return "Too many sign-in attempts. Wait a moment and try again."
  }

  return "Sign-in did not complete. Try again."
}
