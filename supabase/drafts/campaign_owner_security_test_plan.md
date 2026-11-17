# Campaign Owner Migration - Security Test Plan

STATUS: DRAFT - NOT EXECUTED

## Preconditions
- Disposable PostgreSQL database only.
- Never run against production or Supabase Cloud.
- Confirm database identity before any test.
- Review and approve SQL before execution.

## Role Security
- Verify validator role is NOLOGIN.
- Verify validator role has NOBYPASSRLS.
- Verify validator role has no table write privileges.
- Verify no unexpected role memberships.

## Function Security
- Verify function owner is campaign_owner_validator.
- Verify SECURITY DEFINER is enabled.
- Verify search_path is empty.
- Verify function EXECUTE grants.

## Campaign Owner Validation
- Accept valid project member as owner.
- Reject non-member owner.
- Reject member of another project.
- Reject member of another organization.

## RLS
- Verify FORCE ROW LEVEL SECURITY remains enabled.
- Verify validator SELECT policy.
- Verify ordinary authenticated users cannot inherit validator privileges.

## Deployment Blockers
- Confirm Supabase CREATE ROLE compatibility.
- Confirm ALTER FUNCTION OWNER compatibility.
- Confirm migration executor privileges.
- Confirm rollback strategy.

No SQL tests have been executed.

## Campaign Owner Test Matrix

| ID | Scenario | Expected Result |
|---|---|---|
| CO-01 | Assign an active member of the same project and organization | ALLOW |
| CO-02 | Assign a user who is not a project member | REJECT |
| CO-03 | Assign a member belonging only to another project | REJECT |
| CO-04 | Assign a member belonging only to another organization | REJECT |
| CO-05 | Change an existing campaign owner to a valid member | ALLOW |
| CO-06 | Change an existing campaign owner to a non-member | REJECT |
| CO-07 | Change the campaign project without valid owner membership in the new project | REJECT |
| CO-08 | Change the campaign organization without matching owner membership | REJECT |
| CO-09 | Attempt to insert a campaign with an invalid owner | REJECT |
| CO-10 | Verify invalid owner rejection does not persist changes | NO CHANGES |

## Test Execution Rules

- Use a disposable database only.
- Confirm database name, host and port before testing.
- Prepare isolated test fixtures.
- Execute under the intended application roles.
- Verify trigger behavior and RLS independently.
- Record actual results against expected results.
- Do not run these tests against Supabase Cloud without separate approval.

STATUS: TEST CASES PREPARED - NOT EXECUTED
## Deployment Readiness Checklist

- [ ] Verify CREATE ROLE permissions in target environment.
- [ ] Verify ALTER FUNCTION OWNER permissions.
- [ ] Confirm migration executor role and membership grant compatibility.
- [ ] Confirm validator role cannot be assumed by untrusted roles.
- [ ] Confirm validator has no unintended table or column privileges.
- [ ] Confirm SECURITY DEFINER function owner and search_path.
- [ ] Confirm project_members FORCE RLS remains enabled.
- [ ] Confirm temporary CREATE privilege is revoked.
- [ ] Confirm temporary role membership is revoked.
- [ ] Review function EXECUTE privileges.
- [ ] Execute inspection queries on an approved disposable database.
- [ ] Execute all Campaign Owner test cases on an approved disposable database.
- [ ] Record actual test results and resolve failures.
- [ ] Review rollback and deployment procedure.
- [ ] Obtain explicit approval before any deployment.

STATUS: NOT READY FOR DEPLOYMENT