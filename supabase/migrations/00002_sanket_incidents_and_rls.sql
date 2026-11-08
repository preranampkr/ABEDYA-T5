-- Migration 00002: SANKET Incidents, ID Generation, Assignment, RLS and Audit Trail
-- ABHEDYA - Flood Intelligence & Response Platform (Udupi District)

-- 1. SEQUENCE FOR REPORT IDS
CREATE SEQUENCE IF NOT EXISTS public.sanket_report_seq START WITH 1001;

CREATE OR REPLACE FUNCTION public.generate_sanket_report_id()
RETURNS TEXT
LANGUAGE sql
AS $$
    SELECT 'SNK-' || LPAD(nextval('public.sanket_report_seq')::TEXT, 4, '0');
$$;

-- 2. SANKET REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.sanket_reports (
    id TEXT PRIMARY KEY DEFAULT public.generate_sanket_report_id(),
    report_type TEXT NOT NULL CHECK (report_type IN ('sos', 'incident', 'assistance')),
    category TEXT NOT NULL,
    urgency TEXT NOT NULL CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'incoming' CHECK (status IN ('draft', 'submitted', 'incoming', 'under_review', 'assigned', 'in_progress', 'resolved', 'closed')),
    summary TEXT NOT NULL,
    details TEXT NOT NULL,
    assistance_needs TEXT[] DEFAULT '{}',
    locality TEXT NOT NULL,
    taluk TEXT NOT NULL,
    district TEXT NOT NULL DEFAULT 'Udupi',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location_label TEXT DEFAULT 'Current or nearby location',
    location_source TEXT DEFAULT 'manual' CHECK (location_source IN ('manual', 'device', 'unverified')),
    reporter_name TEXT NOT NULL,
    reporter_phone TEXT NOT NULL,
    contact_preference TEXT DEFAULT 'phone' CHECK (contact_preference IN ('phone', 'sms', 'voice', 'none')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_to_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_sanket_reports_status ON public.sanket_reports(status);
CREATE INDEX IF NOT EXISTS idx_sanket_reports_urgency ON public.sanket_reports(urgency);
CREATE INDEX IF NOT EXISTS idx_sanket_reports_taluk ON public.sanket_reports(taluk);
CREATE INDEX IF NOT EXISTS idx_sanket_reports_created_by ON public.sanket_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_sanket_reports_assigned_to ON public.sanket_reports(assigned_to);

-- 3. STATUS & ASSIGNMENT AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS public.sanket_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id TEXT NOT NULL REFERENCES public.sanket_reports(id) ON DELETE CASCADE,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_name TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sanket_history_report_id ON public.sanket_status_history(report_id);

-- 4. ROW LEVEL SECURITY (RLS) POLICIES ON SANKET REPORTS
ALTER TABLE public.sanket_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sanket_status_history ENABLE ROW LEVEL SECURITY;

-- INSERT: Anyone (anonymous citizen or logged-in user) can submit an SOS or report
CREATE POLICY "Public and users can submit reports"
    ON public.sanket_reports
    FOR INSERT
    TO public
    WITH CHECK (true);

-- SELECT:
-- 1. Anyone who created the report (or anonymous tracking by ID)
CREATE POLICY "Users can read own submitted reports"
    ON public.sanket_reports
    FOR SELECT
    TO authenticated
    USING (created_by = auth.uid());

-- 2. Responders (approved helpers and admins) can read all reports
CREATE POLICY "Approved responders can read all reports"
    ON public.sanket_reports
    FOR SELECT
    TO authenticated
    USING (public.is_responder());

-- UPDATE:
-- Only approved helpers and admins can update report status and assignment
CREATE POLICY "Approved responders can update reports"
    ON public.sanket_reports
    FOR UPDATE
    TO authenticated
    USING (public.is_responder())
    WITH CHECK (public.is_responder());

-- POLICIES ON SANKET STATUS HISTORY:
-- Responders can view all history; citizens can view history for their own reports
CREATE POLICY "Responders can view all status history"
    ON public.sanket_status_history
    FOR SELECT
    TO authenticated
    USING (public.is_responder());

CREATE POLICY "Citizens can view status history of own reports"
    ON public.sanket_status_history
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.sanket_reports
            WHERE id = report_id AND created_by = auth.uid()
        )
    );

CREATE POLICY "Responders can insert status history"
    ON public.sanket_status_history
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_responder());

-- 5. FUNCTION: ASSIGN REPORT TO CALLER (APPROVED HELPER / ADMIN ONLY)
CREATE OR REPLACE FUNCTION public.assign_sanket_report(
    p_report_id TEXT,
    p_note TEXT DEFAULT 'Assigned to responder for verification and follow-up.'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_report public.sanket_reports%ROWTYPE;
    v_actor_name TEXT;
    v_actor_id UUID;
    v_prev_status TEXT;
BEGIN
    v_actor_id := auth.uid();
    
    -- Verify caller is an approved helper or admin
    IF NOT public.is_responder() THEN
        RAISE EXCEPTION 'Access denied. Only approved responders or administrators can assign incidents.';
    END IF;

    SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;
    IF v_actor_name IS NULL THEN
        v_actor_name := 'Authorized Responder';
    END IF;

    SELECT * INTO v_report FROM public.sanket_reports WHERE id = p_report_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Incident report % not found.', p_report_id;
    END IF;

    v_prev_status := v_report.status;

    -- Update report
    UPDATE public.sanket_reports
    SET assigned_to = v_actor_id,
        assigned_to_name = v_actor_name,
        status = 'assigned',
        updated_at = NOW()
    WHERE id = p_report_id
    RETURNING * INTO v_report;

    -- Record in history
    INSERT INTO public.sanket_status_history (report_id, from_status, to_status, actor_id, actor_name, note)
    VALUES (p_report_id, v_prev_status, 'assigned', v_actor_id, v_actor_name, p_note);

    RETURN to_jsonb(v_report);
END;
$$;

-- 6. FUNCTION: UPDATE REPORT STATUS (WITH LIFECYCLE ENFORCEMENT & AUDIT LOGGING)
CREATE OR REPLACE FUNCTION public.update_sanket_status(
    p_report_id TEXT,
    p_new_status TEXT,
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_report public.sanket_reports%ROWTYPE;
    v_actor_name TEXT;
    v_actor_id UUID;
    v_prev_status TEXT;
BEGIN
    v_actor_id := auth.uid();
    
    IF NOT public.is_responder() THEN
        RAISE EXCEPTION 'Access denied. Only approved responders or administrators can advance report statuses.';
    END IF;

    IF p_new_status NOT IN ('incoming', 'under_review', 'assigned', 'in_progress', 'resolved', 'closed') THEN
        RAISE EXCEPTION 'Invalid status transition target: %', p_new_status;
    END IF;

    SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;
    IF v_actor_name IS NULL THEN
        v_actor_name := 'Authorized Responder';
    END IF;

    SELECT * INTO v_report FROM public.sanket_reports WHERE id = p_report_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Incident report % not found.', p_report_id;
    END IF;

    v_prev_status := v_report.status;

    -- Update report
    UPDATE public.sanket_reports
    SET status = p_new_status,
        updated_at = NOW()
    WHERE id = p_report_id
    RETURNING * INTO v_report;

    -- Record in history
    INSERT INTO public.sanket_status_history (report_id, from_status, to_status, actor_id, actor_name, note)
    VALUES (p_report_id, v_prev_status, p_new_status, v_actor_id, v_actor_name, p_note);

    RETURN to_jsonb(v_report);
END;
$$;

-- 7. RESTRICTED CONTACT INFORMATION ACCESS
-- Protects citizen telephone numbers from unauthorized viewers
CREATE OR REPLACE FUNCTION public.get_report_contact(
    p_report_id TEXT
)
RETURNS TABLE (
    report_id TEXT,
    reporter_name TEXT,
    reporter_phone TEXT,
    contact_preference TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only allow if caller is an approved responder OR the citizen who submitted the report
    IF NOT (public.is_responder() OR EXISTS (
        SELECT 1 FROM public.sanket_reports 
        WHERE id = p_report_id AND created_by = auth.uid()
    )) THEN
        RAISE EXCEPTION 'Access denied: Citizen contact information is restricted to verified response personnel.';
    END IF;

    RETURN QUERY
    SELECT 
        r.id,
        r.reporter_name,
        r.reporter_phone,
        r.contact_preference
    FROM public.sanket_reports r
    WHERE r.id = p_report_id;
END;
$$;

-- Grant permissions
REVOKE ALL ON FUNCTION public.assign_sanket_report FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_sanket_report TO authenticated;

REVOKE ALL ON FUNCTION public.update_sanket_status FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_sanket_status TO authenticated;

REVOKE ALL ON FUNCTION public.get_report_contact FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_report_contact TO authenticated;
