import type { SharedAsset } from "./shared-assets"

export function matchesAssetDepartment(asset: SharedAsset, department: string) {
  return department === "all" || !!asset.departmentIds?.includes(department) ||
    (asset.visibility === "company" && asset.departmentIds?.length === 0 && asset.projects.length === 0)
}

export function filterSharedAssets(assets: SharedAsset[], filters: {
  folderId: string | null
  query: string
  type: string
  project: string
  department: string
  departmentAssetIds: Set<string>
}) {
  const needle = filters.query.trim().toLowerCase()
  return assets.filter(asset =>
    (!filters.folderId || asset.folderId === filters.folderId) &&
    (filters.department === "all" || filters.departmentAssetIds.has(asset.id)) &&
    (filters.type === "all" || asset.type === filters.type) &&
    (filters.project === "all" || asset.projects.some(project => project.id === filters.project)) &&
    (!needle || [asset.name, asset.description, asset.collection, asset.ownerName, ...asset.tags].join(" ").toLowerCase().includes(needle))
  )
}
