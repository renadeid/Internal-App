import { describe, expect, it } from "vitest"
import { safeReturnPath } from "@/lib/auth/safe-return-path"
describe("safe invitation login redirects", () => {
 it("preserves an internal invitation path and fragment", () => {
  expect(safeReturnPath("/projects?invitation=123#project-invitations")).toBe("/projects?invitation=123#project-invitations")
 })
 it.each([undefined, null, "", "https://evil.example", "//evil.example", "/\\evil.example", "/%2Fevil.example", "/%5Cevil.example", "/projects%0d%0a", "/login?next=/projects", "%", "javascript:alert(1)"])("rejects an unsafe return path %s", value => {
  expect(safeReturnPath(value)).toBe("/")
 })
})
