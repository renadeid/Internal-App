-- Campaign Owner Security Inspection
-- STATUS: DRAFT - NOT EXECUTED
-- READ-ONLY QUERIES ONLY

-- 1. Validator role attributes
SELECT rolname, rolcanlogin, rolbypassrls,
       rolsuper, rolcreaterole, rolcreatedb
FROM pg_roles
WHERE rolname = 'campaign_owner_validator';

-- 2. Function owner and security configuration
SELECT p.proname,
       pg_get_userbyid(p.proowner) AS function_owner,
       p.prosecdef AS security_definer,
       p.proconfig AS function_settings,
       p.proacl AS execute_acl
FROM pg_proc p
WHERE p.oid = to_regprocedure('private.enforce_campaign_owner()');

-- 3. Project membership RLS settings
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE oid = to_regclass('public.project_members');

-- 4. Project membership policies
SELECT policyname, roles, cmd, permissive,
       qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'project_members';

-- 5. Validator role memberships
SELECT member_role.rolname AS member,
       granted_role.rolname AS granted_role,
       membership.admin_option,
       membership.inherit_option,
       membership.set_option
FROM pg_auth_members membership
JOIN pg_roles member_role
  ON member_role.oid = membership.member
JOIN pg_roles granted_role
  ON granted_role.oid = membership.roleid
WHERE member_role.rolname = 'campaign_owner_validator'
   OR granted_role.rolname = 'campaign_owner_validator';

-- 6. Validator table privileges
-- Run only after the validator role has been created.
SELECT
  has_table_privilege('campaign_owner_validator',
    'public.project_members', 'SELECT') AS can_select,
  has_table_privilege('campaign_owner_validator',
    'public.project_members', 'INSERT') AS can_insert,
  has_table_privilege('campaign_owner_validator',
    'public.project_members', 'UPDATE') AS can_update,
  has_table_privilege('campaign_owner_validator',
    'public.project_members', 'DELETE') AS can_delete;

-- 7. Validator schema privileges
SELECT
  has_schema_privilege('campaign_owner_validator',
    'public', 'USAGE') AS public_usage,
  has_schema_privilege('campaign_owner_validator',
    'private', 'USAGE') AS private_usage,
  has_schema_privilege('campaign_owner_validator',
    'private', 'CREATE') AS private_create;

-- 8. Validator column-level SELECT privileges
-- Expected: only project_id, profile_id, organization_id.
SELECT
  column_name,
  has_column_privilege(
    'campaign_owner_validator',
    'public.project_members',
    column_name,
    'SELECT'
  ) AS can_select
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'project_members'
ORDER BY ordinal_position;

-- 9. Function EXECUTE privileges
-- Trigger functions cannot be called directly with SELECT.
SELECT
  r.rolname,
  has_function_privilege(
    r.rolname,
    'private.enforce_campaign_owner()',
    'EXECUTE'
  ) AS can_execute
FROM pg_roles r
WHERE r.rolname IN (
  'campaign_owner_validator',
  'postgres',
  'authenticated',
  'anon'
)
ORDER BY r.rolname;

-- 10. Validator column-level write privileges
SELECT
  column_name,
  has_column_privilege(
    'campaign_owner_validator',
    'public.project_members',
    column_name,
    'INSERT'
  ) AS can_insert,
  has_column_privilege(
    'campaign_owner_validator',
    'public.project_members',
    column_name,
    'UPDATE'
  ) AS can_update
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'project_members'
ORDER BY ordinal_position;

-- 11. Temporary privileges cleanup
SELECT
  has_schema_privilege(
    'campaign_owner_validator',
    'private',
    'CREATE'
  ) AS validator_can_create_in_private,
  pg_has_role(
    'postgres',
    'campaign_owner_validator',
    'MEMBER'
  ) AS postgres_is_validator_member;

-- Expected after migration:
-- validator_can_create_in_private = false
-- postgres_is_validator_member = false

-- 12. Complete column privilege audit using PostgreSQL catalogs
-- Requires the validator role to exist before execution.
SELECT
  a.attname AS column_name,
  has_column_privilege(
    'campaign_owner_validator',
    c.oid,
    a.attname,
    'SELECT'
  ) AS can_select,
  has_column_privilege(
    'campaign_owner_validator',
    c.oid,
    a.attname,
    'INSERT'
  ) AS can_insert,
  has_column_privilege(
    'campaign_owner_validator',
    c.oid,
    a.attname,
    'UPDATE'
  ) AS can_update
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid
WHERE n.nspname = 'public'
  AND c.relname = 'project_members'
  AND a.attnum > 0
  AND NOT a.attisdropped
ORDER BY a.attnum;

-- Expected:
-- SELECT only on project_id, profile_id, organization_id.
-- INSERT and UPDATE false for every column.
