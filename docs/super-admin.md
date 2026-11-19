# Super admin

The existing organization role `org_admin` is presented as **Super admin**. It controls its own organization, including every project in that organization. It is not a platform-wide administrator. A separate Admin role can view and edit existing work without creation, deletion or archive rights; see [Admin role](./admin-role.md). Existing member and viewer behavior is preserved.

## Setup

Apply `supabase/migrations/20261117120000_super_admin_project_access.sql` after the existing schema and authorization migrations, through your normal database deployment process. This change has not been applied to the hosted database. Review deployment status of earlier migrations separately: the existing SEC-01 migration is marked as a local draft.

Existing `org_admin` accounts immediately use the new controls. If there are no administrators, an operator must bootstrap the first organization membership in the database; the app does not let users promote themselves.

For **Create user**, configure `SUPABASE_SERVICE_ROLE_KEY` in the server environment and restart the app. Never use a `NEXT_PUBLIC_` prefix or expose this credential to the browser. Only account creation uses privileged Auth, after authenticating and authorizing the caller with their normal session. Membership writes continue through session-based RLS. User creation accepts a name, email, and initial password (12-character minimum, plus the Auth provider's password requirements). Accounts are created with a verified email and can sign in through the existing password login. No email is sent. If membership creation fails after Auth account creation, the screen explains how to finish with Add existing member.

## Controls

- **Settings → Super admin**: create users, add existing users by email, change organization roles, create departments, and add department members.
- **Projects → Create project**: select specific members, the lead department, all organization employees, custom permissions, or invitations.
- **Project details → Project access**: add or remove project memberships, change permissions, send and cancel invitations. The owner's membership remains protected. Super admins retain access even without a project membership.
- **Settings → Your pending invitations**: employees accept or decline project invitations. Pending invitations grant no project access; the invitation recipient must accept.
- **Project details → Tasks**: existing task creation and assignment use the project's saved members. Selected department and organization employees are materialized as project members at creation time, so they are immediately assignable.

Department and organization audience selections are snapshots of current membership at project creation. Future employees must be added through Project access. The owner and the creating administrator remain project members. Custom permission flags apply to selected members; organization viewers remain read-only. Existing project members can work on tasks; the edit flag controls project metadata rather than task participation. Invitation-based access is available to existing organization members.

## Validation

Run `npx tsc --noEmit`, `npm run lint`, `npm test`, and `npm run build`.

For isolated PostgreSQL migration and RLS checks, install `@electric-sql/pglite` in a separate temporary directory, then run `node scripts/test-super-admin.mjs <temporary-directory>`. The runner applies all migrations to an in-memory PostgreSQL instance with minimal Supabase Auth shims. It never reads environment credentials or connects to hosted Supabase. It checks tenant isolation, all five audience modes, custom permissions, read-only viewers, atomic failures, invitation ownership and acceptance, task assignment, and last-admin protection. This does not verify Auth network calls or concurrent transactions on hosted Supabase.


## Per-member project history access

Apply the forward migration `supabase/migrations/20261117150000_project_history_access.sql` after the Super admin migration. This migration has not been applied automatically to the hosted database.

Project creation, Project access, and project invitations now offer:

- **Full project history**: all project work and history, subject to the existing role and capability flags.
- **Assigned tasks only**: the project header and tasks currently assigned to that member. Other tasks, campaigns, deliverables, approvals, project activity, private project assets, and other memberships are hidden through database policies. Assigned tasks are visible regardless of their creation date. Reassignment or membership removal revokes that task visibility immediately. This mode grants read access; it does not enable project-wide writes or task edits.

New organization/department employees still receive no implicit project membership. A Super admin must explicitly grant membership or send a project invitation. A pending invitation grants no project access; acceptance preserves the visibility mode selected by the administrator. New additions from Project access default to Assigned tasks only. Existing members and existing invitations keep Full project history. Project creation defaults to Full project history, and the owner and Super admins retain full access.

The Super admin can change an existing member's visibility in Project access. Assigned-only membership clears broad edit, membership-management, approval, asset-management, and commenting flags. A restricted member cannot upgrade their own visibility. Resources shared separately with the whole company, personally owned assets, and explicit asset grants retain their independent access rules.

The PostgreSQL regression runner now checks both history modes, private work and file isolation, invitation visibility, acceptance, reassignment, old assigned tasks, attempts to upgrade access, full-history preservation, and administrator access. Campaign authorization tests also reject assigned-only members before any write.


## In-app invitation inbox

Pending invitations appear in a workspace-wide banner (including Projects, project details, and Settings) and in the notification bell. The inbox gathers invitations from all organizations the signed-in user belongs to, even before they select an organization. It refreshes every 15 seconds while the page is visible, on window focus, when opening the notification menu, and through Refresh invitations. Settings uses the same inbox instead of a separate one-time snapshot.

Accepting an invitation selects its organization, refreshes the project list, and opens the project. Declining removes the pending invitation. Neither preview notifications nor pending invitations grant project access. Existing project members cannot receive a new invitation; use Save member access to change their permissions. Invitations are delivered inside the application only. Email delivery is disabled.
