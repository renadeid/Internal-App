# Phase 5 Step C closure

Status: manual testing and the H1, H2, and H3 SQL regressions are complete on `company-hub-test`. H1, H2, and H3 are deployed and verified there only. The local mocked campaign server-action suite is closed. The browser-created preview campaign route is closed locally and browser verified. No production database has received any of these migrations or the route fix, and the mocked suite did not access a database. Security hardening is not fully closed.

`supabase/migrations/20261110100200_campaign_update_requires_active_rows.sql` was applied and committed on `company-hub-test`. The live `campaigns_update` policy uses `private.campaign_row_is_editable` in both `USING` and `WITH CHECK`. At that H1 verification, `campaigns_select` and `campaigns_insert` were unchanged.

`supabase/migrations/20261110102200_campaign_insert_requires_active_rows.sql` was later applied and committed on `company-hub-test`. The live `campaigns_insert` policy uses `private.campaign_row_is_editable(project_id, archived_at)` in `WITH CHECK`. Authenticated table-level `INSERT` is revoked. Authenticated column `INSERT` is limited to `id`, `organization_id`, `project_id`, `slug`, `name`, `description`, `goals`, `owner_id`, `type`, `status`, `starts_on`, and `ends_on`. The H1 update policy and helper remain unchanged.

`supabase/migrations/20261110110000_campaign_slug_update_revoked.sql` was later applied and committed on `company-hub-test`. Authenticated `UPDATE` on `campaigns.slug` is revoked. Authenticated `INSERT` and `SELECT` on `slug` remain. No authenticated table-level `UPDATE` grant exists. The other authenticated campaign `UPDATE` columns remain `name`, `description`, `goals`, `owner_id`, `type`, `status`, `starts_on`, `ends_on`, and `archived_at`. The H1 update policy and the H2 insert policy remain unchanged.

This file records Campaign editing and status updates on `company-hub-test`. Persistent Campaigns 001–004 and Marketing Test Project `118e73b3-e9be-4649-88b9-c43227247a8b` matched the pre-deployment baseline after the H1 run, again after the H2 run, and again after the H3 run.

## Result

| Area | Result | Evidence |
| --- | --- | --- |
| Manual UI, Tests 210–219 | Pass | Signed-in checks reported by the tester |
| Test 220 date discrepancy | Closed, cause unknown | Accepted Campaign 004 baseline |
| Test 221 preview isolation | Pass | Preview edits stayed in browser storage |
| `supabase/tests/security-cloud.sql` after H1 | Pass on `company-hub-test` | `ALL SECURITY TESTS PASSED`, then `rollback`. That earlier run does not include the H2 assertions. |
| `supabase/tests/security-cloud.sql` after H2 | Pass on `company-hub-test` | `ALL SECURITY TESTS PASSED`, then `rollback`. This earlier run includes the H2 insert assertions and does not include the H3 slug assertions. |
| `supabase/tests/security-cloud.sql` after H3 | Pass on `company-hub-test` | `ALL SECURITY TESTS PASSED`, then `rollback`. This run includes the H3 slug assertions. |
| Post-deployment integrity | Pass on `company-hub-test` | After H1, H2, and H3, Campaigns 001–004 and Marketing Test Project 0012 matched the pre-deployment baseline. Zero disposable campaigns and organizations remained. |
| H1 archived-campaign RLS | Deployed and verified on `company-hub-test` | `supabase/migrations/20261110100200_campaign_update_requires_active_rows.sql` |
| H2 archived-campaign insert | Deployed and verified on `company-hub-test` | `supabase/migrations/20261110102200_campaign_insert_requires_active_rows.sql` |
| H3 campaign slug update | Deployed and verified on `company-hub-test` | `supabase/migrations/20261110110000_campaign_slug_update_revoked.sql` |
| Campaign server-action authorization tests | Closed, local mocked suite | Vitest 4.1.12, `npm test`, 89 passed, 0 failed. The final review inspected the source and did not re-run the suite. |
| Browser-created preview campaign route | Closed locally, browser verified | 27 route tests. Combined `npm test`: 116 passed, 0 failed. The route fix is not deployed to production. |
| Production | Not updated | H1, H2, H3, the mocked server-action suite, and the preview route fix are not production verification. Production deployment remains pending. |
| Security hardening | Open | The local mocked server-action suite and the local preview route are closed. Privileged campaign archive/unarchive and calendar validation remain open. |

## What each kind of test covers

Manual UI coverage exercises the signed-in pages. Tests 210–219 passed that way: admin edit, member edit with `can_edit` false, status changes, viewer and outsider denial, invalid owner, end date before start, archived campaign, archived parent project, and user or organization switching. Tests 217 and 218 also confirmed the disposable fixtures were removed. Those passes are manual evidence. They are not an automated suite.

SQL RLS coverage is `supabase/tests/security-cloud.sql`. After the H1 migration was committed on `company-hub-test`, the whole file as it stood then was run in the Supabase SQL Editor. It returned `ALL SECURITY TESTS PASSED` and completed `rollback`. After the H2 migration was committed, the whole file was run again on `company-hub-test`, including the H2 insert assertions. That run returned `ALL SECURITY TESTS PASSED` and completed `rollback`. After the H3 migration was committed, the whole file was run again on `company-hub-test`, including the H3 slug assertions. That run returned `ALL SECURITY TESTS PASSED` and completed `rollback`. These runs use disposable organizations and projects created inside the transaction. They do not name Campaigns 001–004 or Marketing Test Project 0012.

The verified H3 run showed these results on disposable rows:

- An organization admin can update the granted campaign fields and cannot update `organization_id` or `project_id` (`42501`).
- An owner who is not already a project member is rejected by `campaigns_enforce_owner` (`P0001`) on insert and on update.
- A project member with `can_edit = false` can still update a campaign. `can_write_project` does not read `can_edit`.
- A project viewer and an organization outsider update `0` rows under `campaigns_update`. The viewer insert fails with `42501`.
- The outsider campaign insert still fails with `P0001`, because the owner trigger runs before the insert policy.
- An authenticated writer cannot update an archived campaign, cannot update a campaign while its parent project is archived, and cannot set or clear `campaigns.archived_at`. Setting `archived_at` on an active disposable campaign returned `42501`. The other denied updates affected `0` rows. An authorized reader can still select an archived campaign. Editing succeeds again after the disposable project is restored.
- An organization admin and a project member can insert a campaign into an active disposable project. The new row has `archived_at` null.
- An authenticated insert that names `archived_at` fails with `42501`, and no row remains.
- An authenticated insert into an archived disposable project, omitting `archived_at`, fails with `42501`, and no row remains. Restoring that project allows a normal campaign edit again.
- A cross-organization campaign insert fails with `P0001`, because `campaigns_enforce_owner` runs before the insert policy, and no row remains.
- An admin, a project viewer, and an organization outsider who name `slug` in an update of the active disposable campaign receive `42501`. The original disposable slug remains. Admin and member updates that omit `slug` still succeed.

Server-action coverage is the local mocked suite recorded below. `npm test` calls the eight exported campaign actions through an in-memory Supabase client. That run is separate from the hosted `security-cloud.sql` evidence above. Tests 217 and 218 remain manual UI evidence: the page hides Edit and status when the access check returns `canEdit: false`. Those two manual tests did not submit the write actions.

## Campaign 004 baseline

Campaign 004 is the designated editable test campaign.

| Field | Accepted value |
| --- | --- |
| Id | `daa0a593-3f54-43e4-8962-65a1b54d357b` |
| Slug | `marketing-test-campaign-002-2` |
| `starts_on` | `2026-11-05` |
| `ends_on` | `2026-11-12` |

Test 210 intended to save `2026-11-12` through `2026-12-05`. A later read showed the accepted pair above, with `updated_at` of `2026-11-09 13:01:30.51752+00` at the time of that audit. The original cause was not established. The edit path stores the `YYYY-MM-DD` strings it receives and does not shift them. No script in the repository names this campaign. `updated_at` changes on any successful update, including a status-only update, so the timestamp does not identify which columns changed. The H1, H2, and H3 regressions left this persistent baseline in place. The historical difference remains unresolved. Do not edit Campaign 004 to reconstruct the intended Test 210 dates.

## Known gaps

### H1 archived campaign updates — deployed and verified on company-hub-test

`supabase/migrations/20261110100200_campaign_update_requires_active_rows.sql` is applied on `company-hub-test`. `private.campaign_row_is_editable(project_id, archived_at)` requires `private.can_write_project(project_id)`, a null campaign `archived_at`, and a null parent `projects.archived_at`. The live `campaigns_update` policy uses that function for both `USING` and `WITH CHECK`.

An authenticated update of an archived campaign is denied. An authenticated update of a campaign whose parent project is archived is denied. Setting `archived_at` on an active campaign fails `WITH CHECK` with `42501`. Clearing `archived_at` affects `0` rows. Campaign archive and unarchive require a future dedicated privileged operation. No archive action was added in H1.

`campaigns_select` and `campaigns_insert` were verified unchanged at the H1 deployment. `can_write_project` is unchanged, so task and deliverable policies are unchanged. This H1 verification is the isolated test project only. Production has not been updated. H2 later replaced `campaigns_insert` on that same test project; the H2 record below is the current insert policy.

The application guards in `getOrganizationCampaignUpdateAccess` and `readyToUpdate` are unchanged. Tests 217 and 218 remain manual UI evidence. The SQL regression is the database verification for the policy.

### H2 archived campaign insert — deployed and verified on company-hub-test

`supabase/migrations/20261110102200_campaign_insert_requires_active_rows.sql` is applied and committed on `company-hub-test`. The live `campaigns_insert` policy has one `WITH CHECK`: `private.campaign_row_is_editable(project_id, archived_at)`. A new row must have `archived_at` null and an active parent project. Authenticated table-level `INSERT` is revoked. Authenticated column `INSERT` is limited to `id`, `organization_id`, `project_id`, `slug`, `name`, `description`, `goals`, `owner_id`, `type`, `status`, `starts_on`, and `ends_on`.

The whole `supabase/tests/security-cloud.sql` file was run after that commit. It returned `ALL SECURITY TESTS PASSED` and completed `rollback`. On disposable rows, an insert that supplies `archived_at` fails with `42501`, an insert into an archived parent project fails with `42501`, and a cross-organization insert fails with `P0001`. No row remained after those denials. Admin and member inserts into an active disposable project succeeded. The H1 update assertions in the same run passed. `campaigns_select`, `campaigns_update`, and `private.campaign_row_is_editable` are unchanged by this migration.

The post-deployment integrity check passed. Campaigns 001–004 and Marketing Test Project 0012 matched the pre-deployment baseline. Campaign 004 remains `2026-11-05` through `2026-11-12`. Zero disposable campaigns and organizations remained. This verification is the isolated test project only. Production has not been updated.

`createOrganizationCampaign` already omits `archived_at` and does not use `RETURNING` or `ON CONFLICT`. No application change was required.

### H3 campaign slug update — deployed and verified on company-hub-test

`supabase/migrations/20261110110000_campaign_slug_update_revoked.sql` is applied and committed on `company-hub-test`. Authenticated `UPDATE` on `public.campaigns.slug` is revoked. Authenticated `INSERT` and `SELECT` on `slug` remain. The live grant check found no authenticated table-level `UPDATE` on `public.campaigns`. Authenticated `UPDATE` remains on `name`, `description`, `goals`, `owner_id`, `type`, `status`, `starts_on`, `ends_on`, and `archived_at`. The migration adds no trigger. `campaigns_update`, `campaigns_insert`, and `private.campaign_row_is_editable` are unchanged.

The whole `supabase/tests/security-cloud.sql` file was run after that commit. It returned `ALL SECURITY TESTS PASSED` and completed `rollback`. On the active disposable campaign, an admin, a viewer, and an outsider update that names `slug` failed with `42501`, and the original slug remained. Admin and member updates that omit `slug` succeeded. Inserts that supply `slug` succeeded. The H1 and H2 assertions in the same run passed.

The post-deployment integrity check passed. Campaigns 001–004 and Marketing Test Project 0012 matched the pre-deployment baseline. Campaign 004 remains `2026-11-05` through `2026-11-12`. Zero disposable campaigns and organizations remained. This verification is the isolated test project only. Production has not been updated.

`postgres` and the table owner can still update `slug`. A future table-level `UPDATE` grant would allow `slug` changes again. `updateOrganizationCampaign` and `setOrganizationCampaignStatus` already omit `slug`. No application change was required.

### Campaign Server-Action Authorization Tests — CLOSED (LOCAL MOCKED SUITE)

Vitest 4.1.12 runs the isolated suite in `src/lib/auth/campaign-authorization.test.ts`. The test command is `npm test`. The previous local run passed 89 tests and failed 0. The final independent review inspected the test and action source, did not re-run the suite, and returned ready for documentation closure. All three earlier important findings are resolved: strict `select` column projection, post-write count and permission-error coverage, and fail-closed membership and project-relationship coverage. No blocker remained.

The suite mocks `@/lib/supabase/server` with an in-memory client. `server-only` is stubbed. Each test resets the session, call log, write scripts, and fixture rows. The fixtures use synthetic ids. The suite does not open a network connection, load a service-role key, or read persistent campaigns, projects, or organizations.

The eight exported actions covered are `getOrganizationCampaigns`, `getOrganizationProjectCampaigns`, `getOrganizationCampaign`, `getCampaignCreationAccess`, `createOrganizationCampaign`, `getOrganizationCampaignUpdateAccess`, `updateOrganizationCampaign`, and `setOrganizationCampaignStatus`.

The authorization cases assert the action result and whether a write occurred:

- An unauthenticated caller receives `rejected`, and the client records no query.
- A cross-organization outsider receives `rejected`, with no campaign query and no write.
- An organization admin can create, update, and change status.
- A project member with `can_edit = false` can create, update, and change status. The membership reads request `role` or `profile_id`.
- A project viewer is denied before insert, update, and status change.
- An archived campaign and a campaign on an archived project are rejected before a write.
- An archived project is rejected before insert.
- An owner who is not a project member is rejected before a write.
- Invalid ids, names, types, statuses, and date shapes stop before a client is created.
- A user with no organization membership receives `rejected`.
- Two organization memberships return `error`.
- A non-admin with zero project memberships, or two project memberships, receives `denied`.
- A project that belongs to another organization, and a missing project id, return `unavailable` for create and update.

`select()` returns only the requested columns. A campaign read of `id, project_id` does not include `archived_at`. A read that requests `archived_at` returns the stored value. `*`, an embedded relationship, an empty list, and an unknown column fail the query.

An authorized update and an authorized status update return `unavailable` when the scripted count is `0`, `error` when the scripted count is `2`, and `denied` when the scripted PostgreSQL code is `42501`. An authorized insert with `42501` returns `denied`. The scripts apply to the following insert or update, after the authorization reads, and they reset between tests. None of those cases reports success.

The successful create assertion expects the twelve insert fields, a slug derived from the name, and no `archived_at`, `created_at`, or `updated_at`. The successful update assertion expects exactly `name`, `description`, `goals`, `owner_id`, `type`, `status`, `starts_on`, and `ends_on`, with filters on `id`, `organization_id`, and `archived_at IS NULL`, and `{ count: "exact" }`. The successful status assertion expects the payload `{ status }` only, with the same three filters. A caller-supplied slug is absent from the update payload. That is slug immutability at the server-action payload layer. The hosted column revoke remains the H3 database record above.

This suite is local mocked application evidence. Hosted database evidence remains the `company-hub-test` runs of `supabase/tests/security-cloud.sql` recorded for H1, H2, and H3. Production is unchanged and unverified for those migrations and for this suite.

Remaining limitations of this suite:

- `2026-02-31` passes the current `YYYY-MM-DD` check and is sent on create and update. The characterization test records that behavior. Calendar validation is still open.
- Slug-conflict retry paths are untested.
- PostgreSQL codes `23505`, `23514`, `23503`, and `P0001` are not independently exercised.
- The post-write count and permission tests do not individually repeat the three update filter assertions. The successful update and status tests still assert those filters.
- The browser-created preview campaign route is closed in the section below.
- A future privileged campaign archive/unarchive operation remains open.
- Production deployment remains pending.

### Browser-Created Preview Campaign Route — CLOSED (LOCAL FIX + BROWSER VERIFIED)

Browser preview campaigns are stored by `createCampaign` in `src/components/workspace/workspace-provider.tsx`. The id is `campaign-<uuid>`, written through `updateRecords` to `company-hub.records.v1`. That path does not call a campaign server action. Test 221 remains the isolation evidence: the preview card stayed in the preview list, it did not appear in the real list, and it was not inserted into `public.campaigns`.

The original route recognized only `campaign-launch`, `campaign-harbor`, `campaign-demand`, and `campaign-webinar`. Any other id, including a new `campaign-<uuid>`, rendered `OrganizationCampaignRecord`. `getOrganizationCampaign` then returned `missing` before creating a client because the id is not a bare UUID. The page title was **Campaign not available**.

`src/app/(workspace)/workspaces/marketing/campaigns/[id]/preview-campaign-id.ts` classifies the four seed ids and an exact `campaign-<uuid>` as preview ids. `CampaignPage` renders `CampaignDetail` for those ids and `OrganizationCampaignRecord` for a bare UUID and every other id. `public.campaigns.id` is a UUID, so a database campaign id stays on the organization record. The changed files are the helper, `page.tsx`, and `preview-campaign-id.test.ts`.

The route file adds 27 tests. The latest local `npm test` run passed 116 tests and failed 0. That total includes the unchanged 89 authorization tests. The independent source review returned ready for browser verification.

Browser verification passed. A browser-created preview campaign opened in `CampaignDetail`. Refresh preserved the record. Reopening the same browser preserved it. An incognito window without the local record showed **Campaign not found** after authentication. An existing database campaign opened through `OrganizationCampaignRecord`.

During a preview refresh, Chrome showed one POST to the preview URL with status 200. The initiator was `project-creation-actions.ts:19`, and the payload was one organization id. Source inspection identifies that export as `getProjectCreationAccess`. `AppShell` calls it through `useProjectCreationAccess` for the active organization on every workspace page, including this route. The action selects membership, department, and member rows and returns creation permission. It does not insert, update, or delete. That review traced the reported POST. It did not inventory every other network request.

Remaining limitations:

- Preview records stay in this browser’s `localStorage`.
- A different browser without the record shows **Campaign not found**.
- A full refresh can briefly render that fallback before the client storage snapshot replaces the server seed.
- Metadata for a new preview id remains the generic title **Campaign**.
- The network review traced the reported POST, not every request.
- Production has not received this route fix.

## Next actions

These are the remaining recommendations. H1, H2, and H3 are verified on `company-hub-test`. The local mocked campaign server-action suite is closed. The browser-created preview campaign route is closed locally and browser verified. Production deployment remains pending.

1. Leave Campaign 004 on `2026-11-05` through `2026-11-12` unless a later product decision changes that baseline. The historical difference from the Test 210 dates has no established cause.
2. Campaign archive and unarchive still need a future privileged operation. Do not implement that operation by weakening `campaigns_update` or `campaigns_insert`.
3. Production has not received H1, H2, H3, or the preview route fix. A production deployment needs its own review, apply step, and verification.
4. Calendar validation for `2026-02-31`, slug-conflict retries, and the untested database codes `23505`, `23514`, `23503`, and `P0001` remain follow-up test work. They are outside this closure.

## Files inspected for this record

- `src/lib/auth/campaign-update-actions.ts`
- `src/components/marketing/organization-campaign-record.tsx`
- `src/app/(workspace)/workspaces/marketing/campaigns/[id]/page.tsx`
- `src/app/(workspace)/workspaces/marketing/campaigns/[id]/preview-campaign-id.ts`
- `src/app/(workspace)/workspaces/marketing/campaigns/[id]/preview-campaign-id.test.ts`
- `src/components/layout/app-shell.tsx`
- `src/components/projects/project-creation-access.ts`
- `src/lib/auth/project-creation-actions.ts`
- `src/components/marketing/campaign-detail.tsx`
- `src/components/workspace/workspace-provider.tsx`
- `src/lib/records-store.ts`
- `src/lib/mock-data/campaigns.ts`
- `supabase/migrations/20261104170000_schema.sql`
- `supabase/migrations/20261104170100_authorization.sql`
- `supabase/migrations/20261110100200_campaign_update_requires_active_rows.sql`
- `supabase/migrations/20261110102200_campaign_insert_requires_active_rows.sql`
- `supabase/migrations/20261110110000_campaign_slug_update_revoked.sql`
- `supabase/tests/security-cloud.sql`
- `docs/database-implementation.md`
- `src/lib/auth/campaign-authorization.test.ts`
- `src/lib/auth/campaign-creation-actions.ts`
- `src/lib/auth/get-organization-campaigns.ts`
- `src/lib/auth/current-organizations.ts`
- `vitest.config.mts`
