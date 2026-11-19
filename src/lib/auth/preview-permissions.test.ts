import { describe, expect, it, vi } from "vitest"
import { guardPreviewMutation } from "@/lib/auth/preview-permissions"
describe("Admin preview mutation limits", () => {
 it("blocks a create operation before it can change preview data", () => {
  const create = vi.fn()
  expect(() => guardPreviewMutation(false, create)("new record")).toThrow("view and edit existing work only")
  expect(create).not.toHaveBeenCalled()
 })
 it("blocks an archive operation before it can change preview data", () => {
  const archive = vi.fn()
  expect(() => guardPreviewMutation(false, archive)("existing", true)).toThrow()
  expect(archive).not.toHaveBeenCalled()
 })
 it("preserves return values and arguments for other roles", () => {
  const create = vi.fn((name: string) => ({ name }))
  expect(guardPreviewMutation(true, create)("Allowed")).toEqual({ name: "Allowed" })
  expect(create).toHaveBeenCalledWith("Allowed")
 })
})
