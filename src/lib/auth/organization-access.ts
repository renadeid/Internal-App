export type AccessibleOrganization = {
  id: string
  name: string
}

export type OrganizationAccess =
  | { status: "ready"; organizations: AccessibleOrganization[] }
  | { status: "unavailable" }
