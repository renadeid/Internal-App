export function safeReturnPath(value: string | null | undefined): string {
 if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return "/"
 try {
  const decoded = decodeURIComponent(value)
  if (decoded.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decoded)) return "/"
  const parsed = new URL(value, "https://company-hub.invalid")
  if (parsed.origin !== "https://company-hub.invalid" || parsed.pathname === "/login") return "/"
  return parsed.pathname + parsed.search + parsed.hash
 } catch { return "/" }
}
