# Database implementation

Status: the schema and authorization migrations were applied to the isolated project `company-hub-test`. They have not been executed against a local database in this session. `20261110100200_campaign_update_requires_active_rows.sql`, `20261110102200_campaign_insert_requires_active_rows.sql`, and `20261110110000_campaign_slug_update_revoked.sql` were later applied and verified on `company-hub-test` only. No production database has received these migrations.

The mock frontend and `company-hub.records.v1` localStorage behavior are unchanged. Northline is the first organization row, not a special case in the schema. The same tables can hold more than one organization.

## Files

| File | Purpose |
| --- | --- |
| `supabase/migrations/20261104170000_schema.sql` | Types, tables, keys, integrity triggers, forced RLS, revoked grants |
| `supabase/migrations/20261104170100_authorization.sql` | Helper functions, grants, policies, approval functions |
| `supabase/migrations/20261110100200_campaign_update_requires_active_rows.sql` | Campaign update requires an active campaign and an active parent project. Applied and verified on `company-hub-test` only. |
| `supabase/migrations/20261110102200_campaign_insert_requires_active_rows.sql` | Campaign insert requires an active campaign and an active parent project, with column-level `INSERT` for `authenticated`. Applied and verified on `company-hub-test` only. |
| `supabase/migrations/20261110110000_campaign_slug_update_revoked.sql` | Authenticated `UPDATE` on `campaigns.slug` is revoked. `INSERT` and `SELECT` on `slug` remain. Applied and verified on `company-hub-test` only. |
| `supabase/tests/security.sql` | Rollback-only local security checks |
| `supabase/tests/security-cloud.sql` | Rollback-only hosted security checks |

Apply the five migrations in that order on a disposable database. They were applied to the isolated project `company-hub-test`. The two SQL files are rollback-only tests, not migrations. Production has not received these migrations.

## Decisions recorded here

- Projects are shared. Campaigns belong to one project. Tasks belong to a project and may belong to a campaign.
- Assets are one row each. `asset_project_links` and `asset_campaign_links` attach that row to many projects and campaigns.
- Department managers do not read a project unless they are project members or organization admins.
- `review_deliverable` allows an organization admin, or a project member whose `can_approve_deliverables` flag is true. A department title does not approve work.
- Users archive work by setting `archived_at`. Authenticated users are not granted `DELETE` on projects, campaigns, tasks, deliverables, or assets.
- Actor and author columns are taken from `auth.uid()` when a session is present. Client-supplied user ids that disagree are rejected.
- `organization_id` cannot be changed after insert. Child rows must match the parent organization through composite foreign keys or triggers.

## Schema

`20261104170000_schema.sql` creates `private` and these public tables:

`organizations`, `departments`, `profiles`, `organization_memberships`, `department_memberships`, `projects`, `project_departments`, `project_members`, `campaigns`, `tasks`, `deliverables`, `approval_requests`, `assets`, `asset_access`, `asset_project_links`, `asset_campaign_links`, `asset_versions`, `asset_comments`, `activity_events`, `notifications`.

Primary keys are UUIDs. Demo routes are preserved with `slug`, unique per organization, matching the current ids such as `spring` and `campaign-launch`.

`profiles.id` references `auth.users`. A trigger on `auth.users` inserts the profile. Organization membership is not created automatically.

`projects`, `campaigns`, `tasks`, `deliverables`, and `assets` have `archived_at`. Null means active. Progress is not stored.

`deliverables.project_id` must match the campaign row. The foreign key is `(campaign_id, project_id, organization_id)`. A task with a campaign is checked by a trigger for the same match. Deleting a campaign sets `tasks.campaign_id` to null and does not delete the task. Deleting a campaign or project is restricted while deliverables still point at it.

Campaign owners and task assignees must already be members of that project. The project owner is inserted as a `project_manager`. That membership cannot be removed until the owner changes. A `viewer` project role forces every permission flag off.

External asset URLs, when present, must be `http` or `https`. An `external_link` asset requires a URL. Version storage paths stay empty. A later upload function has to open `private.operation_guard` for that version, then close it. The path must then be `{organization_id}/{asset_id}/v{number}/{filename}`. Setting `app.allow_storage_path` does not authorize a path.

## Authorization

RLS is enabled and forced on all twenty tables in the schema migration, and grants to `anon` and `authenticated` are revoked there. The authorization migration grants only the commands each role needs and adds policies. There is no policy for `anon`.

Helpers in `private` are `security definer`, use an empty `search_path`, and read `auth.uid()`. They do not take an actor id:

- `is_org_member`, `is_org_admin`, `is_department_manager`
- `can_read_project`, `can_write_project`, `project_flag`
- `can_read_asset`, `can_manage_asset`, `can_comment_on_asset`, `can_resolve_comment`

`can_read_project` is organization admin or any project member. `can_write_project` excludes organization viewers and project viewers. `project_flag` ignores flags on viewer rows. Organization admins receive edit, member, asset, and comment rights through that helper. They do not receive `approve_deliverables` from it.

Asset read rules:

- `company`: any member of that organization
- `project_members`: a member of a linked project, or of the project that owns a linked campaign
- `restricted`: the owner, an organization admin, or a row in `asset_access`

A campaign link alone does not reveal the asset.

Authenticated clients cannot insert `approval_requests`, `activity_events`, `notifications`, or `asset_versions`. Those rows are written by `security definer` functions. Notification fan-out goes to the other members of the event's project. The actor does not get a copy. Recipients can update only `read_at` on their own rows.

## Approval functions

`public.start_deliverable`, `public.submit_deliverable`, and `public.review_deliverable` call `private.transition_deliverable`.

| Function | Who | Transition |
| --- | --- | --- |
| `start_deliverable` | Creator who can write the project | `draft` or `changes_requested` to `in_progress` |
| `submit_deliverable` | Same creator | `draft`, `in_progress`, or `changes_requested` to `submitted` |
| `review_deliverable` | Organization admin, or `can_approve_deliverables` | `submitted` to `approved` or `changes_requested` |

Each call locks the deliverable, sets the status through a guarded update, and inserts one `approval_requests` row plus one `activity_events` row. `actor_id` is `auth.uid()`. A second review fails because the row is no longer `submitted`.

`authenticated` is not granted `UPDATE` on `deliverables.status`. Inserts are stored as `draft` unless `private.transition_deliverable` has opened `private.operation_guard` for that deliverable. The same guard covers the approval row, the activity row, and the notification fan-out. Each guard is closed before the function returns. `anon` and `authenticated` cannot read, write, or open that table, so `set_config` of `app.allow_status_change`, `app.allow_approval`, `app.allow_activity`, or `app.allow_notification` does not authorize those writes.

Only an organization admin may set `can_approve_deliverables`. A project manager with `can_manage_members` can add members, and cannot turn that flag on. An organization viewer who still owns an asset can read it when visibility allows. Ownership does not let that viewer update the asset, comment on it, change `asset_access`, or add or remove project and campaign links. `private.owner_can_write_asset` is the shared owner write check. A member who owns an asset can still do those writes. Project and campaign ownership do not grant writes to an organization viewer; those policies use `project_flag` and `can_write_project`, which already exclude organization viewers.

`public.add_asset_version` allocates the next version number and sets the author from `auth.uid()`. It does not accept a storage path.

## Security test

`supabase/tests/security.sql` starts a transaction and ends with `rollback`. It checks:

- RLS is forced and work tables are not deletable by `authenticated` or `anon`
- `deliverables.status` is not directly updatable
- A department manager who is not a project member cannot read the project
- A user in another organization cannot read Northline's rows
- A company asset is visible to an organization member, and a project asset is not
- A restricted asset stays hidden from a project member who is not on `asset_access`
- Viewer permission flags are cleared, and a viewer cannot insert a task
- A task cannot use another project's campaign or a non-member assignee
- A deliverable cannot point at a different project than its campaign
- The creator can submit and cannot approve
- A direct status update, a forged activity row, and a forged notification fail
- `app.allow_status_change`, `app.allow_approval`, `app.allow_activity`, `app.allow_notification`, and `app.allow_storage_path` do not authorize those writes
- A finished review does not leave status, approval, or notification writes open
- `authenticated` cannot call `private.open_operation`
- A project manager who is not an organization admin cannot grant `can_approve_deliverables`; an organization admin can
- An organization viewer cannot manage, comment on, grant access to, or link an asset they own
- An organization member who owns an asset can grant access and link that asset
- The reviewer recorded on the approval is the signed-in admin, and a second review fails

Run `supabase/tests/security.sql` only on a disposable local database. It inserts `auth.users` and must not be pasted into the hosted SQL Editor.

```bash
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security.sql
```

`supabase/tests/security-cloud.sql` is the hosted counterpart. Run the whole file once in the SQL Editor. It reads five profiles created beforehand in Authentication, writes only disposable public rows, and ends with `rollback`. `SET LOCAL ROLE` and `RESET ROLE` are top-level statements. The organization-viewer asset update is checked with `UPDATE ... RETURNING`: zero rows, and the original name still present. A false `USING` policy skips that row without `42501`. The approval notification is counted by the receiving member, because `notifications_select` shows a row only to its recipient.

The current file passed on `company-hub-test` after `20261110110000_campaign_slug_update_revoked.sql` was applied. That run includes the H1 campaign-update assertions, the H2 campaign-insert assertions, and the H3 slug-update assertions. It returned `ALL SECURITY TESTS PASSED` and completed `rollback`. Post-run checks found no disposable campaigns or organizations, and the persistent campaign and project rows matched their pre-deployment baseline. Campaign 004 remains `2026-11-05` through `2026-11-12`. The Test 210 intended pair, `2026-11-12` through `2026-12-05`, remains an unresolved historical discrepancy. That pass is the isolated test project only. Earlier passes after H1 and H2 did not include the later assertions. Authenticated `UPDATE` on `campaigns.slug` is revoked on `company-hub-test`. `postgres` and the table owner can still update `slug`, and a future table-level `UPDATE` grant would reopen that column.

## Validation

The cloud security script has passed on `company-hub-test`, including the H1 campaign-update assertions, the H2 campaign-insert assertions, and the H3 slug-update assertions. It has not been run against a production database. `supabase/tests/security.sql` remains the local script and still inserts `auth.users`. Its viewer asset update still expects `42501`.

Local campaign server-action coverage is a separate mocked suite. `npm test` runs Vitest 4.1.12. The latest local run passed 116 tests and failed 0. That total includes the 89 authorization tests in `src/lib/auth/campaign-authorization.test.ts` and 27 preview-route tests. The authorization suite replaces the Supabase server client in memory. It does not connect to `company-hub-test` or production, and it is not evidence for the live H1, H2, or H3 policies. The preview-route tests classify campaign ids locally. They do not change database campaigns. The route fix is browser verified and has not been deployed to production. The closure record is `docs/testing/phase-5-step-c-closure.md`.

Storage bucket policies, seed data, and the frontend data gateway are not part of this phase.
