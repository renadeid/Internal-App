\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
  IF current_database() <> 'company_hub_restore_test'
     OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
     OR inet_server_port() <> 5434
     OR current_user <> 'postgres'
  THEN
    RAISE EXCEPTION 'Unexpected database connection';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'campaign_owner_validator'
  ) THEN
    RAISE EXCEPTION 'Validator role already exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.proname = 'enforce_campaign_owner'
      AND p.pronargs = 0
      AND p.proowner = 'postgres'::regrole
      AND NOT p.prosecdef
      AND p.prorettype = 'pg_catalog.trigger'::regtype
  ) THEN
    RAISE EXCEPTION 'Unexpected trigger function state';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'project_members'
      AND c.relrowsecurity
      AND c.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'project_members RLS configuration changed';
  END IF;
END;
$$;

CREATE ROLE campaign_owner_validator
  NOLOGIN NOSUPERUSER NOBYPASSRLS
  NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;

GRANT campaign_owner_validator TO postgres
  WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;

GRANT USAGE ON SCHEMA public TO campaign_owner_validator;
GRANT USAGE, CREATE ON SCHEMA private TO campaign_owner_validator;

GRANT SELECT (project_id, profile_id, organization_id)
ON public.project_members TO campaign_owner_validator;

CREATE POLICY project_members_campaign_owner_validation
ON public.project_members
AS PERMISSIVE
FOR SELECT TO campaign_owner_validator
USING (true);

REVOKE ALL ON FUNCTION private.enforce_campaign_owner()
FROM PUBLIC;

ALTER FUNCTION private.enforce_campaign_owner()
OWNER TO campaign_owner_validator;

ALTER FUNCTION private.enforce_campaign_owner()
SECURITY DEFINER;

ALTER FUNCTION private.enforce_campaign_owner()
SET search_path TO '';

REVOKE ALL ON FUNCTION private.enforce_campaign_owner()
FROM postgres;

REVOKE CREATE ON SCHEMA private FROM campaign_owner_validator;
REVOKE campaign_owner_validator FROM postgres;

DO $$
DECLARE
  v_role oid;
  v_function oid;
BEGIN
  SELECT oid INTO STRICT v_role
  FROM pg_roles
  WHERE rolname = 'campaign_owner_validator';

  SELECT p.oid INTO STRICT v_function
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'private'
    AND p.proname = 'enforce_campaign_owner'
    AND p.pronargs = 0;

  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE oid = v_role
      AND NOT rolcanlogin
      AND NOT rolsuper
      AND NOT rolbypassrls
      AND NOT rolcreatedb
      AND NOT rolcreaterole
      AND NOT rolreplication
      AND NOT rolinherit
  ) THEN
    RAISE EXCEPTION 'Validator role attributes failed';
  END IF;

  IF NOT has_schema_privilege(v_role, 'public', 'USAGE')
     OR NOT has_schema_privilege(v_role, 'private', 'USAGE')
     OR has_schema_privilege(v_role, 'private', 'CREATE')
  THEN
    RAISE EXCEPTION 'Validator schema privileges failed';
  END IF;

  IF NOT (
    has_column_privilege(v_role, 'public.project_members', 'project_id', 'SELECT')
    AND has_column_privilege(v_role, 'public.project_members', 'profile_id', 'SELECT')
    AND has_column_privilege(v_role, 'public.project_members', 'organization_id', 'SELECT')
  ) OR has_table_privilege(v_role, 'public.project_members', 'SELECT')
  THEN
    RAISE EXCEPTION 'Validator column privileges failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = v_function
      AND proowner = v_role
      AND prosecdef
      AND proconfig = ARRAY[
        'search_path=' || chr(34) || chr(34)
      ]::text[]
  ) THEN
    RAISE EXCEPTION 'Function security configuration failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    CROSS JOIN LATERAL
      aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
    WHERE p.oid = v_function
      AND a.privilege_type = 'EXECUTE'
      AND a.grantee <> v_role
  ) THEN
    RAISE EXCEPTION 'Unexpected function EXECUTE grant';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_roles r
    WHERE r.rolname IN ('anon', 'authenticated', 'service_role')
      AND (
        has_function_privilege(r.oid, v_function, 'EXECUTE')
        OR pg_has_role(r.oid, v_role, 'SET')
        OR pg_has_role(r.oid, v_role, 'USAGE')
      )
  ) THEN
    RAISE EXCEPTION 'Application role isolation failed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_auth_members
    WHERE roleid = v_role
      AND member = 'postgres'::regrole
  ) THEN
    RAISE EXCEPTION 'Temporary membership remains';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'project_members'
      AND c.relrowsecurity
      AND c.relforcerowsecurity
      AND pol.polname = 'project_members_campaign_owner_validation'
      AND pol.polcmd = 'r'
      AND pol.polpermissive
      AND pol.polroles = ARRAY[v_role]
      AND pg_get_expr(pol.polqual, pol.polrelid) = 'true'
  ) THEN
    RAISE EXCEPTION 'Validator RLS policy check failed';
  END IF;

  RAISE NOTICE 'ALL SECURITY CHECKS PASSED';
END;
$$;

ROLLBACK;
