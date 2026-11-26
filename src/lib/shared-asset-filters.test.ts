import { expect, it } from "vitest"
import { filterSharedAssets, matchesAssetDepartment } from "./shared-asset-filters"
import type { SharedAsset } from "./shared-assets"

const assets: SharedAsset[] = [
  { id: "root", folderId: null, name: "Company guide", type: "document", projects: [] },
  { id: "design", folderId: "brand", name: "Logo", type: "image", projects: [{ id: "website", name: "Website" }] },
  { id: "marketing", folderId: "social", name: "Social plan", type: "document", projects: [] },
].map(asset => ({ description: "", collection: "General", tags: [], ownerName: "Employee", ownerId: "owner", visibility: "company", createdAt: "2026-11-25", updatedAt: "2026-11-25", externalUrl: null, canEdit: false, canDelete: false, hasFile: true, versionId: "version", fileName: "file", mime: "application/pdf", size: 100, ...asset }))
const filters = { folderId: null, query: "", type: "all", project: "all", department: "all", departmentAssetIds: new Set<string>() }

it("includes root assets and files from every folder in All assets", () => {
  expect(filterSharedAssets(assets, filters).map(asset => asset.id)).toEqual(["root", "design", "marketing"])
})
it("includes department assets across folders", () => {
  expect(filterSharedAssets(assets, { ...filters, department: "design", departmentAssetIds: new Set(["root", "design"]) }).map(asset => asset.id)).toEqual(["root", "design"])
})
it("keeps folder navigation scoped to that folder", () => {
  expect(filterSharedAssets(assets, { ...filters, folderId: "social" }).map(asset => asset.id)).toEqual(["marketing"])
})
it("combines department, type, project and search filters", () => {
  expect(filterSharedAssets(assets, { ...filters, department: "design", departmentAssetIds: new Set(["design", "marketing"]), type: "image", project: "website", query: "logo" }).map(asset => asset.id)).toEqual(["design"])
})
it("shows no assets for a department without files", () => {
  expect(filterSharedAssets(assets, { ...filters, department: "empty" })).toEqual([])
})

 it("keeps general company logos visible in department filters without including other departments or restricted files", () => {
 const logo = { ...assets[0], departmentIds: [] }
 expect(matchesAssetDepartment(logo, "marketing")).toBe(true)
 expect(matchesAssetDepartment({ ...logo, departmentIds: ["sales"] }, "marketing")).toBe(false)
 expect(matchesAssetDepartment({ ...logo, visibility: "project_members" }, "marketing")).toBe(false)
 expect(matchesAssetDepartment({ ...logo, projects: [{ id: "sales-project", name: "Sales" }] }, "marketing")).toBe(false)
 expect(filterSharedAssets([logo], { ...filters, department: "marketing", departmentAssetIds: new Set([logo.id]) })).toEqual([logo])
 })
