begin;

-- PostgreSQL 13+ provides gen_random_uuid() in pg_catalog; no extension is needed.
alter table public.helper_access_requests
  alter column id set default pg_catalog.gen_random_uuid();
alter table public.sanket_report_assignments
  alter column id set default pg_catalog.gen_random_uuid();
alter table public.sanket_report_status_history
  alter column id set default pg_catalog.gen_random_uuid();
alter table public.sanket_report_notes
  alter column id set default pg_catalog.gen_random_uuid();
alter table public.audit_records
  alter column id set default pg_catalog.gen_random_uuid();

-- Remove seeded examples before moving contact data. Demo fixtures belong in
-- isolated non-production environments, not in a production migration.
delete from public.sanket_reports where origin_kind = 'demo';

create table public.sanket_report_contacts (
  report_id text primary key references public.sanket_reports(id) on delete cascade,
  reporter_name text not null,
  reporter_phone text not null,
  contact_preference text not null
    check (contact_preference in ('phone', 'sms', 'voice', 'none')),
  created_at timestamptz not null default now(),
  constraint sanket_contact_name_nonempty check (length(trim(reporter_name)) > 0),
  constraint sanket_contact_phone_nonempty check (length(trim(reporter_phone)) > 0)
);
comment on table public.sanket_report_contacts is
  'Restricted contact PII; retained with its report until an approved retention/deletion policy is applied.';

insert into public.sanket_report_contacts
  (report_id, reporter_name, reporter_phone, contact_preference)
select id, reporter_name, reporter_phone, contact_preference
from public.sanket_reports
where origin_kind = 'user_submission';

alter table public.sanket_reports
  drop column reporter_name,
  drop column reporter_phone,
  drop column contact_preference;

alter table public.sanket_report_assignments
  alter column helper_id set not null,
  alter column assigned_by set not null;

alter table public.helper_access_requests
  add constraint helper_request_review_actor_consistency check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null) or
    (status <> 'pending' and reviewed_by is not null and reviewed_at is not null)
  );

alter table public.sanket_report_contacts enable row level security;
revoke all on public.sanket_report_contacts from public, anon, authenticated;
grant all on public.sanket_report_contacts to service_role;

-- Replace the client-settable bypass with a database-role check. Privilege
-- changes are allowed only from trusted SECURITY DEFINER owners or service_role.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if (new.role is distinct from old.role or new.account_status is distinct from old.account_status)
     and current_user not in ('postgres', 'service_role') then
    raise exception 'Profile role and account status are managed by trusted administrators';
  end if;
  return new;
end;
$$;

-- Signup trigger remains the sole helper-application creation path. Metadata
-- can request an application, but cannot select an active role.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  requested_role text;
  requested_organization text;
  requested_details text;
begin
  insert into public.user_profiles (id, display_name, phone)
  values (
    new.id,
    nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'phone'), '')
  );

  requested_role := new.raw_user_meta_data ->> 'requested_role';
  if requested_role = 'helper' then
    requested_organization := nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'organization'), '');
    requested_details := nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'application_details'), '');
    if requested_organization is null or requested_details is null then
      raise exception 'Organization and helper application details are required';
    end if;
    insert into public.helper_access_requests (user_id, organization, application_details)
    values (new.id, requested_organization, requested_details);
  end if;
  return new;
end;
$$;

drop function if exists public.submit_helper_access_request(text, text);

create or replace function public.has_active_role(required_role public.user_role)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = required_role and account_status = 'active'
  );
$$;

create or replace function public.current_profile_status()
returns public.account_status
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select account_status from public.user_profiles where id = auth.uid();
$$;

create or replace function public.admin_list_helper_requests()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if auth.uid() is null or not public.has_active_role('admin') then
    raise exception 'Administrator access required';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', request.id,
      'userId', request.user_id,
      'displayName', profile.display_name,
      'phone', profile.phone,
      'organization', request.organization,
      'applicationDetails', request.application_details,
      'status', request.status,
      'reviewNote', request.review_note,
      'createdAt', request.created_at
    ) order by request.created_at)
    from public.helper_access_requests as request
    join public.user_profiles as profile on profile.id = request.user_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_review_helper_request(
  p_request_id uuid,
  p_decision public.helper_request_status,
  p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  request_row public.helper_access_requests%rowtype;
  applicant public.user_profiles%rowtype;
begin
  if auth.uid() is null or not public.has_active_role('admin') then
    raise exception 'Administrator access required';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  select * into request_row
  from public.helper_access_requests
  where id = p_request_id
  for update;
  if not found or request_row.status <> 'pending' then
    raise exception 'Pending helper application not found';
  end if;
  if request_row.user_id = auth.uid() then
    raise exception 'Administrators cannot review their own helper application';
  end if;

  select * into applicant
  from public.user_profiles
  where id = request_row.user_id
  for update;
  if not found or applicant.role <> 'victim' or applicant.account_status <> 'active' then
    raise exception 'Applicant must have an active victim account';
  end if;

  update public.helper_access_requests
  set status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = pg_catalog.now(),
      review_note = nullif(pg_catalog.btrim(p_review_note), '')
  where id = p_request_id;

  if p_decision = 'approved' then
    update public.user_profiles
    set role = 'helper', account_status = 'active'
    where id = request_row.user_id;
  end if;

  insert into public.audit_records (actor_id, action, entity_type, entity_id, changed_fields)
  values (
    auth.uid(),
    'helper_application_' || p_decision::text,
    'helper_access_request',
    p_request_id::text,
    jsonb_build_object('status', p_decision)
  );
end;
$$;

create or replace function public.provision_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Admin provisioning is restricted to the trusted service role';
  end if;
  if not exists (select 1 from public.user_profiles where id = p_user_id) then
    raise exception 'User profile not found';
  end if;
  update public.user_profiles
  set role = 'admin', account_status = 'active'
  where id = p_user_id;
  insert into public.audit_records (actor_id, action, entity_type, entity_id, changed_fields)
  values (null, 'admin_provisioned', 'user_profile', p_user_id::text,
    jsonb_build_object('role', 'admin'));
end;
$$;

create or replace function public.create_sanket_report(p_report jsonb)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  report_code text;
  report_name text;
  report_phone text;
  report_preference text;
begin
  if auth.uid() is null or not public.has_active_role('victim') then
    raise exception 'An active victim account is required to submit a report';
  end if;
  if p_report is null or jsonb_typeof(p_report) <> 'object' then
    raise exception 'Report payload must be a JSON object';
  end if;

  report_name := nullif(pg_catalog.btrim(p_report #>> '{reporter,name}'), '');
  report_phone := nullif(pg_catalog.btrim(p_report #>> '{reporter,phone}'), '');
  report_preference := p_report #>> '{reporter,contactPreference}';
  if report_name is null or report_phone is null then
    raise exception 'Reporter name and contact number are required';
  end if;
  if report_preference not in ('phone', 'sms', 'voice', 'none') then
    raise exception 'Invalid reporter contact preference';
  end if;

  report_code := 'SNK-' || pg_catalog.to_char(
    pg_catalog.nextval('public.sanket_report_code_seq'::regclass), 'FM0000'
  );
  insert into public.sanket_reports (
    id, owner_id, report_type, category, urgency, status,
    location_label, locality, taluk, district, latitude, longitude, location_source,
    assistance_needs, summary, details, provenance_source_mode, provenance_source_label,
    provenance_note, origin_kind, verification_status
  ) values (
    report_code, auth.uid(), (p_report ->> 'reportType')::public.sanket_report_type,
    (p_report ->> 'category')::public.sanket_category,
    coalesce((p_report ->> 'urgency')::public.sanket_urgency, 'medium'),
    'submitted',
    coalesce(nullif(pg_catalog.btrim(p_report #>> '{location,label}'), ''), 'Unverified location'),
    pg_catalog.btrim(p_report #>> '{location,locality}'),
    pg_catalog.btrim(p_report #>> '{location,taluk}'),
    pg_catalog.btrim(p_report #>> '{location,district}'),
    nullif(p_report #>> '{location,latitude}', '')::double precision,
    nullif(p_report #>> '{location,longitude}', '')::double precision,
    coalesce((p_report #>> '{location,source}')::public.sanket_location_source, 'manual'),
    coalesce(array(
      select jsonb_array_elements_text(p_report -> 'assistanceNeeds')::public.sanket_assistance_need
    ), '{}'),
    pg_catalog.btrim(p_report ->> 'summary'),
    pg_catalog.btrim(p_report ->> 'details'),
    'user_submission', 'Authenticated user submission',
    'Stored by ABHEDYA; not externally verified.', 'user_submission', 'unverified'
  );

  insert into public.sanket_report_contacts
    (report_id, reporter_name, reporter_phone, contact_preference)
  values (report_code, report_name, report_phone, report_preference);

  insert into public.sanket_report_status_history
    (report_id, from_status, to_status, actor_id, actor_label_snapshot, note)
  values (report_code, null, 'submitted', auth.uid(), 'Citizen', 'Report submitted.');
  insert into public.audit_records (actor_id, action, entity_type, entity_id, changed_fields)
  values (auth.uid(), 'report_created', 'sanket_report', report_code,
    jsonb_build_object('status', 'submitted', 'origin_kind', 'user_submission'));
  return report_code;
end;
$$;

create or replace function public.get_my_sanket_report_codes()
returns table (id text)
language sql
stable
security invoker
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select report.id
  from public.sanket_reports as report
  where report.owner_id = auth.uid()
    and report.origin_kind = 'user_submission'
  order by report.created_at desc;
$$;

create or replace function public.get_sanket_helper_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if auth.uid() is null or not (
    public.has_active_role('helper') or public.has_active_role('admin')
  ) then
    raise exception 'Approved, active helper access is required';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', report.id,
      'reportType', report.report_type,
      'category', report.category,
      'urgency', report.urgency,
      'status', report.status,
      'createdAt', report.created_at,
      'updatedAt', report.updated_at,
      'location', jsonb_build_object(
        'label', report.location_label, 'locality', report.locality,
        'taluk', report.taluk, 'district', report.district,
        'latitude', report.latitude, 'longitude', report.longitude, 'source', report.location_source
      ),
      'reporter', jsonb_build_object('name', 'Reporter', 'phone', '', 'contactPreference', 'none'),
      'assistanceNeeds', report.assistance_needs,
      'summary', report.summary,
      'details', report.details,
      'assignedTo', current_assignment.helper_name_snapshot,
      'canAccessContact', current_assignment.helper_id = auth.uid()
        and report.status in ('assigned', 'in_progress'),
      'assignmentHistory', '[]'::jsonb,
      'assignmentEvents', '[]'::jsonb,
      'operationalNotes', '[]'::jsonb,
      'provenance', jsonb_build_object(
        'sourceMode', report.provenance_source_mode,
        'sourceLabel', report.provenance_source_label,
        'note', report.provenance_note
      ),
      'originKind', report.origin_kind,
      'verificationStatus', report.verification_status
    ) order by report.created_at desc)
    from public.sanket_reports as report
    left join lateral (
      select assignment.helper_id, assignment.helper_name_snapshot
      from public.sanket_report_assignments as assignment
      where assignment.report_id = report.id and assignment.ended_at is null
      limit 1
    ) as current_assignment on true
    where report.status <> 'closed' and report.origin_kind = 'user_submission'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_sanket_report_details(p_report_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  report_row public.sanket_reports%rowtype;
  contact_row public.sanket_report_contacts%rowtype;
  can_view_operational boolean;
  can_view_contact boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  select * into report_row from public.sanket_reports where id = p_report_id;
  if not found or report_row.origin_kind <> 'user_submission' then
    raise exception 'Report not found';
  end if;

  can_view_operational := public.has_active_role('helper') or public.has_active_role('admin');
  can_view_contact := public.has_active_role('victim') and report_row.owner_id = auth.uid();
  if not can_view_operational and not can_view_contact then
    raise exception 'Report access denied';
  end if;
  select * into contact_row
  from public.sanket_report_contacts
  where report_id = report_row.id;

  return jsonb_build_object(
    'id', report_row.id,
    'reportType', report_row.report_type,
    'category', report_row.category,
    'urgency', report_row.urgency,
    'status', report_row.status,
    'createdAt', report_row.created_at,
    'updatedAt', report_row.updated_at,
    'location', jsonb_build_object(
      'label', report_row.location_label, 'locality', report_row.locality,
      'taluk', report_row.taluk, 'district', report_row.district,
      'latitude', report_row.latitude, 'longitude', report_row.longitude, 'source', report_row.location_source
    ),
    'reporter', jsonb_build_object(
      'name', case when can_view_contact then contact_row.reporter_name else 'Reporter' end,
      'phone', case when can_view_contact then contact_row.reporter_phone else '' end,
      'contactPreference', case when can_view_contact then contact_row.contact_preference else 'none' end
    ),
    'assistanceNeeds', report_row.assistance_needs,
    'summary', report_row.summary,
    'details', report_row.details,
    'assignedTo', (
      select assignment.helper_name_snapshot
      from public.sanket_report_assignments as assignment
      where assignment.report_id = report_row.id and assignment.ended_at is null
      limit 1
    ),
    'canAccessContact', public.has_active_role('helper')
      and report_row.status in ('assigned', 'in_progress')
      and exists (
        select 1 from public.sanket_report_assignments as assignment
        where assignment.report_id = report_row.id
          and assignment.helper_id = auth.uid() and assignment.ended_at is null
      ),
    'assignmentHistory', coalesce((
      select jsonb_agg(jsonb_build_object(
        'from', history.from_status, 'to', history.to_status,
        'at', history.created_at, 'by', history.actor_label_snapshot,
        'note', case when can_view_contact or public.has_active_role('admin') then history.note else null end
      ) order by history.created_at)
      from public.sanket_report_status_history as history
      where history.report_id = report_row.id
    ), '[]'::jsonb),
    'assignmentEvents', case when can_view_contact or public.has_active_role('admin') then coalesce((
      select jsonb_agg(jsonb_build_object(
        'helperId', assignment.helper_id,
        'helperName', assignment.helper_name_snapshot,
        'assignedBy', assignment.assigned_by,
        'assignedAt', assignment.assigned_at,
        'endedAt', assignment.ended_at,
        'note', assignment.note
      ) order by assignment.assigned_at)
      from public.sanket_report_assignments as assignment
      where assignment.report_id = report_row.id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'operationalNotes', case when public.has_active_role('admin') or exists (
      select 1 from public.sanket_report_assignments as assignment
      where assignment.report_id = report_row.id
        and assignment.helper_id = auth.uid() and assignment.ended_at is null
    ) then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', note.id, 'authorId', note.author_id, 'note', note.note,
        'createdAt', note.created_at, 'updatedAt', note.updated_at
      ) order by note.created_at)
      from public.sanket_report_notes as note where note.report_id = report_row.id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'provenance', jsonb_build_object(
      'sourceMode', report_row.provenance_source_mode,
      'sourceLabel', report_row.provenance_source_label,
      'note', report_row.provenance_note
    ),
    'originKind', report_row.origin_kind,
    'verificationStatus', report_row.verification_status
  );
end;
$$;

create function public.get_sanket_report_contact(p_report_id text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  contact_row public.sanket_report_contacts%rowtype;
begin
  if auth.uid() is null or not public.has_active_role('helper') then
    raise exception 'An approved, active helper account is required';
  end if;
  if not exists (
    select 1 from public.sanket_reports as report
    join public.sanket_report_assignments as assignment on assignment.report_id = report.id
    where report.id = p_report_id
      and report.origin_kind = 'user_submission'
      and report.status in ('assigned', 'in_progress')
      and assignment.helper_id = auth.uid()
      and assignment.ended_at is null
  ) then
    raise exception 'Contact details are available only to the currently assigned helper';
  end if;

  select * into contact_row from public.sanket_report_contacts where report_id = p_report_id;
  if not found or contact_row.contact_preference = 'none' then
    raise exception 'The reporter has not authorized contact through this workflow';
  end if;

  insert into public.audit_records (actor_id, action, entity_type, entity_id, changed_fields)
  values (auth.uid(), 'report_contact_viewed', 'sanket_report', p_report_id,
    jsonb_build_object('contact_accessed', true));

  return jsonb_build_object(
    'name', contact_row.reporter_name,
    'phone', contact_row.reporter_phone,
    'contactPreference', contact_row.contact_preference
  );
end;
$$;

create or replace function public.transition_sanket_report(
  p_report_id text,
  p_to_status public.sanket_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  report_row public.sanket_reports%rowtype;
  actor_label text;
  allowed boolean := false;
begin
  if auth.uid() is null or not (
    public.has_active_role('helper') or public.has_active_role('admin')
  ) then
    raise exception 'Approved, active helper access is required';
  end if;
  select * into report_row from public.sanket_reports where id = p_report_id for update;
  if not found or report_row.origin_kind <> 'user_submission' then
    raise exception 'Report not found';
  end if;

  allowed := (report_row.status = 'submitted' and p_to_status = 'incoming')
    or (report_row.status = 'incoming' and p_to_status = 'under_review')
    or (report_row.status = 'assigned' and p_to_status = 'in_progress')
    or (report_row.status = 'in_progress' and p_to_status = 'resolved')
    or (report_row.status = 'resolved' and p_to_status = 'closed');
  if not allowed then
    raise exception 'Invalid SANKET status transition: % to %', report_row.status, p_to_status;
  end if;
  if report_row.status in ('assigned', 'in_progress', 'resolved')
     and not public.has_active_role('admin')
     and not exists (
       select 1 from public.sanket_report_assignments as assignment
       where assignment.report_id = report_row.id
         and assignment.helper_id = auth.uid() and assignment.ended_at is null
     ) then
    raise exception 'Only the assigned helper can advance this report';
  end if;

  select coalesce(display_name, 'Helper') into actor_label
  from public.user_profiles where id = auth.uid();
  update public.sanket_reports set status = p_to_status where id = report_row.id;
  if p_to_status = 'closed' then
    update public.sanket_report_assignments
    set ended_at = pg_catalog.now()
    where report_id = report_row.id and ended_at is null;
  end if;
  insert into public.sanket_report_status_history
    (report_id, from_status, to_status, actor_id, actor_label_snapshot, note)
  values (report_row.id, report_row.status, p_to_status, auth.uid(),
    coalesce(actor_label, 'Helper'), nullif(pg_catalog.btrim(p_note), ''));
  insert into public.audit_records (actor_id, action, entity_type, entity_id, changed_fields)
  values (auth.uid(), 'report_status_changed', 'sanket_report', report_row.id,
    jsonb_build_object('from', report_row.status, 'to', p_to_status));
end;
$$;

create or replace function public.assign_sanket_report(
  p_report_id text,
  p_helper_id uuid default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  report_row public.sanket_reports%rowtype;
  target_helper uuid;
  helper_name text;
  actor_label text;
begin
  if auth.uid() is null or not (
    public.has_active_role('helper') or public.has_active_role('admin')
  ) then
    raise exception 'Approved, active helper access is required';
  end if;
  target_helper := coalesce(p_helper_id, auth.uid());
  if not public.has_active_role('admin') and target_helper <> auth.uid() then
    raise exception 'Helpers may assign reports only to themselves';
  end if;
  if not exists (
    select 1 from public.user_profiles
    where id = target_helper and role = 'helper' and account_status = 'active'
  ) then
    raise exception 'Target must be an approved, active helper';
  end if;

  select * into report_row from public.sanket_reports where id = p_report_id for update;
  if not found or report_row.origin_kind <> 'user_submission' then
    raise exception 'Report not found';
  end if;
  if report_row.status <> 'under_review' then
    raise exception 'A report must be under review before it can be assigned';
  end if;

  update public.sanket_report_assignments set ended_at = pg_catalog.now()
  where report_id = p_report_id and ended_at is null;
  select coalesce(display_name, 'Helper') into helper_name
  from public.user_profiles where id = target_helper;
  select coalesce(display_name, 'Helper') into actor_label
  from public.user_profiles where id = auth.uid();
  insert into public.sanket_report_assignments
    (report_id, helper_id, assigned_by, note, helper_name_snapshot)
  values (p_report_id, target_helper, auth.uid(), nullif(pg_catalog.btrim(p_note), ''), helper_name);
  update public.sanket_reports set status = 'assigned' where id = p_report_id;
  insert into public.sanket_report_status_history
    (report_id, from_status, to_status, actor_id, actor_label_snapshot, note)
  values (p_report_id, 'under_review', 'assigned', auth.uid(),
    coalesce(actor_label, 'Helper'), nullif(pg_catalog.btrim(p_note), ''));
  insert into public.audit_records (actor_id, action, entity_type, entity_id, changed_fields)
  values (auth.uid(), 'report_assigned', 'sanket_report', p_report_id,
    jsonb_build_object('helper_id', target_helper));
end;
$$;

create or replace function public.update_sanket_urgency(
  p_report_id text,
  p_urgency public.sanket_urgency
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if auth.uid() is null or not (
    public.has_active_role('helper') or public.has_active_role('admin')
  ) then
    raise exception 'Approved, active helper access is required';
  end if;
  if not public.has_active_role('admin') and not exists (
    select 1 from public.sanket_report_assignments as assignment
    join public.sanket_reports as report on report.id = assignment.report_id
    where assignment.report_id = p_report_id
      and assignment.helper_id = auth.uid() and assignment.ended_at is null
      and report.origin_kind = 'user_submission'
      and report.status in ('assigned', 'in_progress')
  ) then
    raise exception 'Only the assigned helper can change urgency';
  end if;
  update public.sanket_reports
  set urgency = p_urgency
  where id = p_report_id and origin_kind = 'user_submission';
  if not found then raise exception 'Report not found'; end if;
  insert into public.audit_records (actor_id, action, entity_type, entity_id, changed_fields)
  values (auth.uid(), 'report_urgency_changed', 'sanket_report', p_report_id,
    jsonb_build_object('urgency', p_urgency));
end;
$$;

create or replace function public.add_sanket_report_note(p_report_id text, p_note text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  note_id uuid;
  is_admin boolean;
begin
  if auth.uid() is null or not (
    public.has_active_role('helper') or public.has_active_role('admin')
  ) then
    raise exception 'Approved, active helper access is required';
  end if;
  if nullif(pg_catalog.btrim(p_note), '') is null then
    raise exception 'Note cannot be empty';
  end if;
  is_admin := public.has_active_role('admin');
  if not exists (
    select 1 from public.sanket_reports as report
    where report.id = p_report_id and report.origin_kind = 'user_submission'
  ) then
    raise exception 'Report not found';
  end if;
  if not is_admin and not exists (
    select 1 from public.sanket_report_assignments as assignment
    join public.sanket_reports as report on report.id = assignment.report_id
    where assignment.report_id = p_report_id
      and assignment.helper_id = auth.uid() and assignment.ended_at is null
      and report.status in ('assigned', 'in_progress')
  ) then
    raise exception 'Only the assigned helper or an administrator can add operational notes';
  end if;
  insert into public.sanket_report_notes (report_id, author_id, note)
  values (p_report_id, auth.uid(), pg_catalog.btrim(p_note))
  returning id into note_id;
  insert into public.audit_records (actor_id, action, entity_type, entity_id, changed_fields)
  values (auth.uid(), 'report_note_added', 'sanket_report', p_report_id,
    jsonb_build_object('note_id', note_id));
  return note_id;
end;
$$;

-- Tighten direct table privileges. SECURITY DEFINER RPCs below are the only
-- client paths for operational data and contact access.
revoke all on public.user_profiles, public.helper_access_requests,
  public.sanket_reports, public.sanket_report_assignments,
  public.sanket_report_status_history, public.sanket_report_notes,
  public.audit_records, public.sanket_report_contacts
from public, anon, authenticated;
grant select on public.user_profiles, public.helper_access_requests,
  public.sanket_reports, public.sanket_report_status_history to authenticated;
grant update (display_name, phone, organization) on public.user_profiles to authenticated;
grant all on public.user_profiles, public.helper_access_requests,
  public.sanket_reports, public.sanket_report_assignments,
  public.sanket_report_status_history, public.sanket_report_notes,
  public.audit_records, public.sanket_report_contacts to service_role;
grant usage, select on sequence public.sanket_report_code_seq to service_role;
revoke all on sequence public.sanket_report_code_seq from public, anon, authenticated;

-- Set trusted ownership explicitly; deployment must run as the Supabase
-- postgres migration role. No function uses dynamic SQL.
alter function public.touch_updated_at() owner to postgres;
alter function public.protect_profile_privileges() owner to postgres;
alter function public.handle_new_auth_user() owner to postgres;
alter function public.has_active_role(public.user_role) owner to postgres;
alter function public.current_profile_status() owner to postgres;
alter function public.admin_list_helper_requests() owner to postgres;
alter function public.admin_review_helper_request(uuid, public.helper_request_status, text) owner to postgres;
alter function public.provision_admin(uuid) owner to postgres;
alter function public.create_sanket_report(jsonb) owner to postgres;
alter function public.get_my_sanket_report_codes() owner to postgres;
alter function public.get_sanket_helper_queue() owner to postgres;
alter function public.get_sanket_report_details(text) owner to postgres;
alter function public.get_sanket_report_contact(text) owner to postgres;
alter function public.transition_sanket_report(text, public.sanket_status, text) owner to postgres;
alter function public.assign_sanket_report(text, uuid, text) owner to postgres;
alter function public.update_sanket_urgency(text, public.sanket_urgency) owner to postgres;
alter function public.add_sanket_report_note(text, text) owner to postgres;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.protect_profile_privileges() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.has_active_role(public.user_role) from public, anon;
revoke all on function public.current_profile_status() from public, anon;
revoke all on function public.admin_list_helper_requests() from public, anon;
revoke all on function public.admin_review_helper_request(uuid, public.helper_request_status, text) from public, anon;
revoke all on function public.provision_admin(uuid) from public, anon, authenticated;
revoke all on function public.create_sanket_report(jsonb) from public, anon;
revoke all on function public.get_my_sanket_report_codes() from public, anon;
revoke all on function public.get_sanket_helper_queue() from public, anon;
revoke all on function public.get_sanket_report_details(text) from public, anon;
revoke all on function public.get_sanket_report_contact(text) from public, anon;
revoke all on function public.transition_sanket_report(text, public.sanket_status, text) from public, anon;
revoke all on function public.assign_sanket_report(text, uuid, text) from public, anon;
revoke all on function public.update_sanket_urgency(text, public.sanket_urgency) from public, anon;
revoke all on function public.add_sanket_report_note(text, text) from public, anon;

grant execute on function public.has_active_role(public.user_role) to authenticated;
grant execute on function public.current_profile_status() to authenticated;
grant execute on function public.admin_list_helper_requests() to authenticated;
grant execute on function public.admin_review_helper_request(uuid, public.helper_request_status, text) to authenticated;
grant execute on function public.provision_admin(uuid) to service_role;
grant execute on function public.create_sanket_report(jsonb) to authenticated;
grant execute on function public.get_my_sanket_report_codes() to authenticated;
grant execute on function public.get_sanket_helper_queue() to authenticated;
grant execute on function public.get_sanket_report_details(text) to authenticated;
grant execute on function public.get_sanket_report_contact(text) to authenticated;
grant execute on function public.transition_sanket_report(text, public.sanket_status, text) to authenticated;
grant execute on function public.assign_sanket_report(text, uuid, text) to authenticated;
grant execute on function public.update_sanket_urgency(text, public.sanket_urgency) to authenticated;
grant execute on function public.add_sanket_report_note(text, text) to authenticated;

commit;