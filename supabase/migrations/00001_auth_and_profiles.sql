-- Migration 00001: Authentication, Profiles, Roles, and Helper Approval
-- ABHEDYA - Flood Intelligence & Response Platform (Udupi District)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
-- Extends auth.users with domain-specific roles, organization affiliations, and approval states.
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('victim', 'helper', 'admin')),
    organization TEXT,
    approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for role and approval status lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role_approval ON public.profiles(role, approval_status);

-- 2. HELPER FUNCTIONS (SECURITY DEFINER)
-- Checks whether the calling authenticated user has admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$;

-- Checks whether the calling authenticated user is an approved helper
CREATE OR REPLACE FUNCTION public.is_approved_helper()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'helper' AND approval_status = 'approved'
    );
$$;

-- Checks whether the calling authenticated user is an admin or approved helper
CREATE OR REPLACE FUNCTION public.is_responder()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND (
            role = 'admin' OR 
            (role = 'helper' AND approval_status = 'approved')
        )
    );
$$;

-- 3. ROW LEVEL SECURITY (RLS) POLICIES ON PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
CREATE POLICY "Users can read own profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- Policy: Admins can view all profiles
CREATE POLICY "Admins can read all profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- Policy: Approved helpers can view other approved helpers (team discovery)
CREATE POLICY "Approved helpers can view other approved helpers"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        public.is_approved_helper() AND
        role = 'helper' AND
        approval_status = 'approved'
    );

-- Policy: Users can update their own personal info (name, org) but NOT role or approval status
CREATE POLICY "Users can update own basic profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid() AND
        role = (SELECT role FROM public.profiles WHERE id = auth.uid()) AND
        approval_status = (SELECT approval_status FROM public.profiles WHERE id = auth.uid())
    );

-- Policy: Admins can update any profile (including approval status and role assignment)
CREATE POLICY "Admins can update any profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 4. PROFILE SYNCHRONIZATION TRIGGER ON SIGNUP
-- Automatically creates a profile record when a new user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_role TEXT;
    user_org TEXT;
    user_name TEXT;
    initial_status TEXT;
BEGIN
    user_role := COALESCE(new.raw_user_meta_data->>'role', 'victim');
    user_org := new.raw_user_meta_data->>'organization';
    user_name := COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));

    -- Victims are automatically approved; Helpers require administrator approval; Admins require explicit approval
    IF user_role = 'victim' THEN
        initial_status := 'approved';
    ELSE
        initial_status := 'pending';
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role, organization, approval_status)
    VALUES (
        new.id,
        new.email,
        user_name,
        user_role,
        user_org,
        initial_status
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        updated_at = NOW();

    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. FUNCTION: APPROVE OR REJECT HELPER (ADMIN ONLY)
CREATE OR REPLACE FUNCTION public.set_helper_approval(
    target_user_id UUID,
    new_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access denied. Only administrators can change helper approval status.';
    END IF;

    IF new_status NOT IN ('approved', 'rejected', 'pending') THEN
        RAISE EXCEPTION 'Invalid approval status: %', new_status;
    END IF;

    UPDATE public.profiles
    SET approval_status = new_status,
        updated_at = NOW()
    WHERE id = target_user_id AND role = 'helper';
END;
$$;

-- Revoke execute from public and grant to authenticated
REVOKE EXECUTE ON FUNCTION public.set_helper_approval FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_helper_approval TO authenticated;
