"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { breadcrumbLabel } from "@/components/layout/navigation"
import { useWorkspace } from "@/components/workspace/workspace-provider"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export function HeaderBreadcrumbs() {
  const pathname = usePathname()
  const { campaigns, assets } = useWorkspace()
  if (pathname === "/") return null

  const campaignRoute = pathname.match(
    /^\/workspaces\/marketing\/campaigns\/([^/]+)$/
  )
  if (campaignRoute) {
    const campaign = campaigns.find(
      (item) => item.id === decodeURIComponent(campaignRoute[1])
    )
    return (
      <Breadcrumb className="hidden min-w-0 md:block">
        <BreadcrumbList className="flex-nowrap">
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/" />}>Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/workspaces/marketing" />}>
              Marketing
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-48 truncate">
              {campaign?.name ?? "Campaign"}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  const assetRoute = pathname.match(/^\/assets\/([^/]+)$/)
  if (assetRoute) {
    const asset = assets.find((item) => item.id === decodeURIComponent(assetRoute[1]))
    return (
      <Breadcrumb className="hidden min-w-0 md:block">
        <BreadcrumbList className="flex-nowrap">
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/" />}>Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/assets" />}>
              Assets Library
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-48 truncate">
              {asset?.name ?? "Asset"}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  const detail = pathname.match(/^\/projects\/([^/]+)$/)
  if (detail) {
    return (
      <Breadcrumb className="hidden min-w-0 md:block">
        <BreadcrumbList className="flex-nowrap">
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/" />}>Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/projects" />}>
              Projects
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-48 truncate">
              Project
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  return (
    <Breadcrumb className="hidden min-w-0 md:block">
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/" />}>Dashboard</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="truncate">
            {breadcrumbLabel(pathname)}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
