# Member project creation

Apply `supabase/migrations/20261125130000_project_creation_permissions.sql` before deploying the application change. Applied to the live application's `company-hub-test` database on 25 November 2026.

Settings → Project creation permissions → Manage access lets a Super admin or Team lead grant or revoke creation for individual Members in their workspace. Search by name or email, filter by allowed/not allowed, and use pagination (six members by default). Members & roles uses the same paginated directory so neither list grows the whole Settings page. The permission does not change their organization role. No initial grants are created. Admins and Viewers cannot use a stale Member grant. Role changes clear existing grants; removing organization membership cascades to its grant.

Super admins retain project creation. Team leads retain creation for departments they manage. Members need an explicit grant, including Members who manage a department. Delegated creation permits choosing the lead department, but does not grant access to existing projects. The existing project owner trigger gives the creator access to their new project.

The server checks the grant both when opening creation and on submission. The database applies the same rule to direct project inserts. Only the checked RPC can write grants; authenticated users have no direct grant-table write privileges. Refresh the Member's page after changing permission in another session.

Validation: 30 application tests, TypeScript, and ESLint passed. A database transaction verified denied Member self-grants, direct grant-table writes and ungranted project inserts; allowed Team lead/Super admin grants and revocation; successful granted Member creation; blocked creation after revocation and invalid cross-tenant targets. All test changes were rolled back.
