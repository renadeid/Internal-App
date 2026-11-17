export type UserIdentity = {
  name: string
  email: string
  initials: string
  jobTitle: string | null
  avatarColor: string
}

export type CurrentIdentity = UserIdentity & {
  profileId: string
}

const fallbackAvatarColor = "#2563EB"

export function toUserIdentity(input: {
  authEmail: string | null
  fullName: string | null
  profileEmail: string | null
  jobTitle: string | null
  avatarColor: string | null
  initials: string | null
}): UserIdentity {
  const email = firstText(input.profileEmail) ?? firstText(input.authEmail) ?? ""
  const fullName = firstText(input.fullName)
  const name = fullName ?? (email ? nameFromEmail(email) : "Signed-in user")
  const storedInitials = firstText(input.initials)

  return {
    name,
    email: email || "No email on this account",
    initials: storedInitials ? clipInitials(storedInitials) : deriveInitials(name),
    jobTitle: firstText(input.jobTitle),
    avatarColor: hexColor(input.avatarColor) ?? fallbackAvatarColor,
  }
}

function firstText(value: string | null | undefined) {
  const text = value?.trim() ?? ""
  return text.length > 0 ? text : null
}

function nameFromEmail(email: string) {
  const local = email.split("@")[0] ?? ""
  const words = local.split(/[._-]+/).filter((word) => word.length > 0)
  if (words.length === 0) return email
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
}

function deriveInitials(name: string) {
  const words = name.split(/\s+/).filter((word) => word.length > 0)
  if (words.length === 0) return "?"
  if (words.length === 1) return clipInitials(words[0])
  return clipInitials(`${words[0].charAt(0)}${words[1].charAt(0)}`)
}

function clipInitials(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?"
}

function hexColor(value: string | null) {
  const color = value?.trim() ?? ""
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? color : null
}
