# Admin: view and edit existing work

The new organization role `admin` is separate from `org_admin`, which remains the Super admin role. No existing account is promoted or changed automatically.

| Capability | Super admin | Admin |
| --- | --- | --- |
| Read organization projects and project history | Yes | Yes |
| Edit existing project, campaign, task, asset and deliverable metadata | Yes | Yes |
| Change existing task and campaign status | Yes | Yes |
| Add new work or departments | Yes | No |
| Add asset versions through the RPC | Yes | No |
| Delete, archive or restore work | Yes | No |
| Manage users, roles, invitations or project permission flags | Yes | No |

Admin access is scoped to its own organization. It can read and edit existing work without an individual project membership; organization-wide Admin access also takes precedence over a restricted project membership. Other organizations remain inaccessible. The role does not automatically acquire deliverable approval authority. Existing approval workflows remain enforced. An Admin can still accept or decline its own invitations and mark its own notifications read.

## Activation

Apply these forward-only migrations in order, as separate migration steps:

1. `supabase/migrations/20261119120000_admin_role_value.sql`
2. `supabase/migrations/20261119120100_admin_edit_only_permissions.sql`

The first adds the enum value. The second adds the authorization helpers, restrictive policies, and create/delete/archive guards. Apply them after the existing history-access migration. These migrations have been tested locally and have not been applied automatically to hosted Supabase.

After activation, sign in as a Super admin, open Settings, and choose Admin in an existing member's Organization role selector. No new credential is required and the role does not grant user-administration rights.

## Enforcement

The UI separates task editing from creation and archival. Project archive/restore controls are absent for Admin. Creation server actions reject Admin directly, and database restrictive policies deny direct inserts, deletes and permission changes even when an old department-manager or project-manager membership would otherwise grant them. Work-row triggers also reject insertion, deletion or changes to archived_at, including calls through the campaign archive/restore RPCs. The asset-version RPC rejects Admin explicitly. Preview components disable create/archive controls and guard their local mutations too.

## Validation

Run `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`. The isolated PostgreSQL runner `node scripts/test-super-admin.mjs <PGlite runtime directory>` applies all migrations and tests real RLS, direct writes, privileged RPCs, cross-organization isolation, and preserved Super admin capabilities. It does not connect to the hosted database.
