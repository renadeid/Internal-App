import { knowledgeGuides } from "@/lib/knowledge-guides"
import { createClient } from "@/lib/supabase/server"

/**
 * Ask Connect: answers questions about using Roaya Connect.
 * Server-only. Set ONE of these in Vercel → Settings → Environment Variables:
 *   GEMINI_API_KEY     Google Gemini (free key from aistudio.google.com). Optional GEMINI_MODEL (tried first; busy models fall back to others).
 *   ANTHROPIC_API_KEY  Anthropic Claude (console.anthropic.com). Optional ANTHROPIC_MODEL.
 * If both are set, Gemini is used.
 */

type ChatMessage = { role: "user" | "assistant"; content: string }

const MAX_MESSAGES = 20
const MAX_CHARS = 4000
const DEFAULT_CLAUDE_MODEL = "claude-sonnet-5-5"
/** Tried in order; a busy or unavailable model falls through to the next. */
const GEMINI_FALLBACK_MODELS = ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-2.5-flash-lite", "gemini-2.5-flash"]

class BusyError extends Error {}

const APP_GUIDE = `Roaya Connect is Roaya's internal workspace. Its sections, all in the left sidebar:
- Dashboard (/): summary cards, quick access, your open tasks, recent activity and projects.
- Projects (/projects): every project with owner, status (planning, in progress, in review, on hold) and due date. Quick create in the header starts a new project for people allowed to create one.
- My tasks (/tasks): tasks assigned to you, sorted by due date.
- Activity (/activity): what changed across the workspace.
- Assets library (/assets): shared files, linked to projects and campaigns.
- Artifact hub (/artifacts): finished deliverables and shareable outputs.
- Knowledge base (/knowledge): guides on how the team works.
- Workspaces → Marketing (/workspaces/marketing): campaigns and their stages.
- People & onboarding (/people): teammates, roles and onboarding.
- Settings (/settings): account, members and access.
The header has search, Quick create, notifications (including project invitations) and the profile menu (which can replay the welcome tour).`

function knowledgeText() {
  return knowledgeGuides
    .map((g) => `## ${g.title} (${g.category}) — open ${g.href}\n${g.summary}\n${g.steps.map((s) => `- ${s}`).join("\n")}`)
    .join("\n\n")
}

function systemPrompt(name: string) {
  return `You are Ask Connect, the built-in guide for Roaya Connect. You help ${name || "a team member"}, who may be new, learn and use the app.

How to answer:
- Be brief and practical: two to six short sentences or a short list of steps. Plain text only, no markdown headings, tables or bold.
- Name the exact place in the app (for example "Projects → Quick create") and the path in brackets, like (/projects), so it can be opened.
- Use only the app guide and knowledge base below. If something is not covered, say you are not sure and suggest asking a Super admin or checking the Knowledge base. Never invent features, numbers, people or policies.
- You cannot see the person's projects, tasks, files or messages. If they ask about their own data, explain where in the app to find it.
- British spelling. No emoji. Stay on Roaya Connect and how to work in it; politely decline unrelated requests.

APP GUIDE
${APP_GUIDE}

KNOWLEDGE BASE
${knowledgeText()}`
}

function parseMessages(body: unknown): ChatMessage[] | null {
  if (!body || typeof body !== "object") return null
  const raw = (body as { messages?: unknown }).messages
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) return null
  const out: ChatMessage[] = []
  for (const m of raw) {
    if (!m || typeof m !== "object") return null
    const role = (m as { role?: unknown }).role
    const content = (m as { content?: unknown }).content
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null
    const text = content.trim().slice(0, MAX_CHARS)
    if (!text) return null
    out.push({ role, content: text })
  }
  // The API expects the conversation to start with the user and end with the user.
  while (out.length && out[0].role !== "user") out.shift()
  if (!out.length || out[out.length - 1].role !== "user") return null
  return out
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 })
  }
  const messages = parseMessages(body)
  if (!messages) return Response.json({ error: "bad_request" }, { status: 400 })

  const geminiKey = process.env.GEMINI_API_KEY
  const claudeKey = process.env.ANTHROPIC_API_KEY
  if (!geminiKey && !claudeKey) return Response.json({ error: "not_configured" }, { status: 503 })

  const name =
    typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.split(" ")[0] : ""

  try {
    const reply = geminiKey
      ? await askGemini(geminiKey, systemPrompt(name), messages)
      : await askClaude(claudeKey as string, systemPrompt(name), messages)
    if (!reply) return Response.json({ error: "upstream" }, { status: 502 })
    return Response.json({ reply })
  } catch (error) {
    if (error instanceof BusyError) return Response.json({ error: "busy" }, { status: 503 })
    console.error("Ask Connect: model request error", error)
    return Response.json({ error: "upstream" }, { status: 502 })
  }
}

async function askGemini(apiKey: string, system: string, messages: ChatMessage[]) {
  const preferred = process.env.GEMINI_MODEL?.trim()
  const models = [...new Set([preferred, ...GEMINI_FALLBACK_MODELS].filter(Boolean) as string[])]
  let busy = false
  for (const [i, model] of models.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 400))
    let res: Response
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
            generationConfig: { maxOutputTokens: 1024, temperature: 0.3 },
          }),
          signal: AbortSignal.timeout(10_000),
        }
      )
    } catch {
      busy = true // timed out: try the next model
      continue
    }
    if (res.status === 503 || res.status === 429 || res.status === 404 || res.status === 500) {
      if (res.status !== 404) busy = true
      console.warn("Ask Connect: Gemini model unavailable, trying next", model, res.status)
      continue
    }
    if (!res.ok) {
      console.error("Ask Connect: Gemini request failed", model, res.status, (await res.text()).slice(0, 300))
      return ""
    }
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] }
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .filter((p) => p.text && !p.thought)
      .map((p) => p.text)
      .join("")
      .trim()
    if (text) return text
  }
  if (busy) throw new BusyError("All Gemini models are busy")
  return ""
}

async function askClaude(apiKey: string, system: string, messages: ChatMessage[]) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_CLAUDE_MODEL,
      max_tokens: 600,
      system,
      messages,
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    console.error("Ask Connect: Claude request failed", res.status)
    return ""
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] }
  return (data.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n")
    .trim()
}
