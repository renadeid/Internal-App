import { SuperAdminPanel } from "@/components/settings/super-admin-panel"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { OrganizationCompanyName } from "@/components/auth/organization-provider"
import { getCurrentIdentity } from "@/lib/auth/current-identity"
import { PageIntro } from "@/components/shared/page-intro"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export const metadata: Metadata = {
  title: "Settings",
}

export default async function SettingsPage() {
  const identity = await getCurrentIdentity()
  if (!identity) redirect("/login")

  return (
    <div className="flex flex-col gap-8">
      <PageIntro
        title="Settings"
        description="Manage your profile and organization access."
      />
      <SuperAdminPanel />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="text-sm font-semibold">Profile</h2>
          <div className="mt-4 flex items-center gap-3">
            <Avatar className="size-12">
              <AvatarFallback
                className="font-semibold text-white"
                style={{ backgroundColor: identity.avatarColor }}
              >
                {identity.initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{identity.name}</p>
              <p className="text-sm text-muted-foreground">
                {identity.jobTitle ?? identity.email}
              </p>
            </div>
          </div>
          <dl className="mt-5 grid gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="mt-0.5">{identity.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Department</dt>
              <dd className="mt-0.5">Not set</dd>
            </div>
          </dl>
        </section>
        <section className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="text-sm font-semibold">Workspace</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Company</dt>
              <dd className="mt-0.5">
                <OrganizationCompanyName />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Workspace</dt>
              <dd className="mt-0.5">Roaya Connect</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Active department</dt>
              <dd className="mt-0.5">Marketing</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  )
}
