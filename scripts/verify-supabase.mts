import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const scriptPath = fileURLToPath(import.meta.url)
const projectRoot = resolve(dirname(scriptPath), "..")
const envPath = resolve(projectRoot, ".env.local")

if (!hasReactServerCondition()) {
  const child = spawnSync(
    process.execPath,
    [
      "--conditions=react-server",
      "--experimental-strip-types",
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      `--env-file-if-exists=${envPath}`,
      scriptPath,
    ],
    { cwd: projectRoot, env: process.env, stdio: "inherit" }
  )
  process.exit(child.status ?? 1)
}

if (!existsSync(envPath)) {
  console.error(
    "Configuration: .env.local is missing. Create it beside package.json with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
  )
  process.exit(1)
}

const { verifySupabaseConnection } = await import(
  "../src/lib/supabase/connection-check.ts"
)

const result = await verifySupabaseConnection()

if (!result.ok) {
  const label =
    result.reason === "missing-env"
      ? "Configuration"
      : result.reason === "unreachable"
        ? "Network"
        : "Supabase API"
  console.error(`${label}: ${result.message}`)
  process.exit(1)
}

console.log("Supabase connection succeeded.")

function hasReactServerCondition() {
  const args = [
    ...process.execArgv,
    ...(process.env.NODE_OPTIONS ?? "").split(/\s+/),
  ]
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--conditions" || arg === "-C") {
      if (args[index + 1]?.split(",").includes("react-server")) return true
    }
    if (arg?.startsWith("--conditions=") && arg.slice("--conditions=".length).split(",").includes("react-server")) {
      return true
    }
  }
  return false
}
