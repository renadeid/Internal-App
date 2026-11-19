-- Global Super Admin
-- STATUS: DRAFT - NOT EXECUTED
-- TARGET: Local test database only
-- Database: company_hub_restore_test

-- 1. Create global roles table
CREATE TABLE private.global_user_roles (
    user_id uuid PRIMARY KEY
        REFERENCES auth.users(id) ON DELETE CASCADE,

    role text NOT NULL
        CHECK (role = 'super_admin'),

    created_at timestamptz NOT NULL
        DEFAULT now()
);

-- 2. Enable and force RLS
ALTER TABLE private.global_user_roles
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE private.global_user_roles
    FORCE ROW LEVEL SECURITY;
-- Restrict direct access to global roles.
-- Only trusted database administration may assign roles.

REVOKE ALL ON TABLE private.global_user_roles
FROM PUBLIC, anon, authenticated;

-- Ensure the authorization function is owned by
-- the trusted postgres role.
-- Review ownership before execution.

-- No client-facing policies.
-- Role assignment must use a separately authorized,
-- controlled administrative migration.

-- 3. Check Global Super Admin Permission
-- Uses the authenticated user's identity.
-- Does not accept a user ID from the client.

CREATE OR REPLACE FUNCTION private.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM private.global_user_roles
        WHERE user_id = (SELECT auth.uid())
          AND role = 'super_admin'
    );
$$;



-- Ensure trusted function ownership.
ALTER FUNCTION private.is_super_admin() OWNER TO postgres;

-- Prevent direct execution by ordinary database roles.
REVOKE ALL ON FUNCTION private.is_super_admin()
FROM PUBLIC, anon, authenticated;


-- 4. Assign the designated Security Admin
-- DRAFT ONLY - DO NOT EXECUTE

INSERT INTO private.global_user_roles (
    user_id,
    role
)

SELECT
    id,
    'super_admin'
FROM public.profiles
WHERE id = '13283bb9-bc79-4144-a4f9-0a4d97cd6314'
  AND email = 'security-admin@company-hub-test.invalid'
ON CONFLICT (user_id) DO NOTHING;
