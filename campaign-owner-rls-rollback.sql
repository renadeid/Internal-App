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

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.proname = 'enforce_campaign_owner'
      AND p.pronargs = 0
      AND p.proowner = 'campaign_owner_validator'::regrole
      AND p.prosecdef
      AND p.proconfig = ARRAY[
        'search_path=' || chr(34) || chr(34)
      ]::text[]
  ) THEN
    RAISE EXCEPTION 'Unexpected function state';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'project_members'
      AND policyname = 'project_members_campaign_owner_validation'
  ) THEN
    RAISE EXCEPTION 'Expected validator policy missing';
  END IF;
END;
$$;

-- Temporarily permit ownership transfer back to postgres
GRANT campaign_owner_validator TO postgres
  WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;

GRANT CREATE ON SCHEMA private TO campaign_owner_validator;
ALTER FUNCTION private.enforce_campaign_owner() OWNER TO postgres;

ALTER FUNCTION private.enforce_campaign_owner()
SECURITY INVOKER;

ALTER FUNCTION private.enforce_campaign_owner() SET search_path TO '';

GRANT EXECUTE ON FUNCTION private.enforce_campaign_owner()
TO PUBLIC;

DROP POLICY project_members_campaign_owner_validation
ON public.project_members;

REVOKE SELECT (project_id, profile_id, organization_id)
ON public.project_members
FROM campaign_owner_validator;

REVOKE USAGE ON SCHEMA public
FROM campaign_owner_validator;

REVOKE USAGE ON SCHEMA private
FROM campaign_owner_validator;

REVOKE campaign_owner_validator FROM postgres;

REVOKE CREATE ON SCHEMA private FROM campaign_owner_validator;
DROP ROLE campaign_owner_validator;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'campaign_owner_validator'
  ) THEN
    RAISE EXCEPTION 'Validator role still exists';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'project_members'
      AND policyname = 'project_members_campaign_owner_validation'
  ) THEN
    RAISE EXCEPTION 'Validator policy still exists';
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
  ) THEN
    RAISE EXCEPTION 'Function not restored';
  END IF;

  RAISE NOTICE 'ROLLBACK SECURITY CHECKS PASSED';
END;
$$;

COMMIT;