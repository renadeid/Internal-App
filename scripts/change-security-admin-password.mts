import { stdin, stdout } from "node:process"

import { createClient } from "@supabase/supabase-js"

import { readSupabasePublicEnv } from "../src/lib/supabase/public-env.ts"

const adminEmail = "security-admin@company-hub-test.invalid"
const projectRef = "xegkavnxtlneorpfptze"

const { url, publishableKey } = readSupabasePublicEnv()

if (new URL(url).hostname !== `${projectRef}.supabase.co`) {
  console.error(
    "Configuration: NEXT_PUBLIC_SUPABASE_URL is not the company-hub-test project."
  )
  process.exit(1)
}

let currentPassword = ""
let nextPassword = ""
let confirmedPassword = ""
let exitCode = 0

try {
  currentPassword = await readHidden("Current password: ")
  nextPassword = await readHidden("New password: ")
  confirmedPassword = await readHidden("Confirm new password: ")

  if (!currentPassword || !nextPassword || !confirmedPassword) {
    console.error("A password was empty.")
    exitCode = 1
  } else if (nextPassword !== confirmedPassword) {
    console.error("The new passwords did not match.")
    exitCode = 1
  } else if (nextPassword === currentPassword) {
    console.error("The new password must be different from the current password.")
    exitCode = 1
  } else {
    const supabase = createClient(url, publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: currentPassword,
    })

    if (signInError) {
      console.error("Sign-in was rejected.")
      exitCode = 1
    } else {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || userData.user?.email !== adminEmail) {
        console.error("getUser() did not return the security-admin account.")
        exitCode = 1
      } else {
        const { error: updateError } = await supabase.auth.updateUser({
          password: nextPassword,
        })
        if (updateError) {
          console.error("Password update was rejected.")
          exitCode = 1
        } else {
          console.log(`Password updated for ${adminEmail}.`)
        }
      }

      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) {
        console.error("Sign-out did not complete.")
        exitCode = 1
      }
    }
  }
} catch (error) {
  const message = error instanceof Error ? error.message : ""
  console.error(message === "Cancelled." ? "Cancelled." : "Password update did not complete.")
  exitCode = 1
} finally {
  currentPassword = ""
  nextPassword = ""
  confirmedPassword = ""
}

process.exit(exitCode)

function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY || !stdout.isTTY) {
      reject(new Error("Run this script in an interactive terminal so the password is not echoed."))
      return
    }

    stdout.write(prompt)
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding("utf8")

    let value = ""
    let settled = false

    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      stdin.off("data", onData)
      stdin.setRawMode(false)
      stdin.pause()
      stdout.write("\n")
      callback()
    }

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\u0003") {
          finish(() => reject(new Error("Cancelled.")))
          return
        }
        if (char === "\r" || char === "\n") {
          finish(() => resolve(value))
          return
        }
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1)
          continue
        }
        if (char < " ") continue
        value += char
      }
    }

    stdin.on("data", onData)
  })
}
