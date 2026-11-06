begin;

create type public.user_role as enum ('victim', 'helper', 'admin');
create type public.account_status as enum ('pending', 'active', 'suspended');
create type public.helper_request_status as enum ('pending', 'approved', 'rejected');
create type public.sanket_report_type as enum ('sos', 'incident', 'assistance');
create type public.sanket_category as enum (
  'flooding', 'waterlogging', 'blocked_road', 'damaged_infrastructure',
  'medical_assistance', 'shelter_required', 'food_water', 'other'
);
create type public.sanket_urgency as enum ('low', 'medium', 'high', 'critical');
create type public.sanket_status as enum (
  'draft', 'submitted', 'incoming', 'under_review', 'assigned',
  'in_progress', 'resolved', 'closed'
);
create type public.sanket_assistance_need as enum (
  'rescue', 'medical', 'evacuation', 'shelter', 'food_water', 'transport', 'other'
);
create type public.sanket_location_source as enum ('manual', 'device', 'unverified');
create type public.sanket_source_mode as enum ('prototype', 'demo', 'live', 'user_submission');
create type public.sanket_origin_kind as enum ('user_submission', 'demo');
create type public.sanket_verification_status as enum ('unverified', 'verified', 'disputed');

create sequence public.sanket_report_code_seq start with 3 increment by 1;

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'victim',
  account_status public.account_status not null default 'active',
  display_name text,
  phone text,
  organization text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_display_name_nonempty check (display_name is null or length(trim(display_name)) > 0)
);

create table public.helper_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  organization text not null check (length(trim(organization)) > 0),
  application_details text not null check (length(trim(application_details)) > 0),
  status public.helper_request_status not null default 'pending',
  reviewed_by uuid references public.user_profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint helper_request_review_consistency check (
    (status = 'pending' and reviewed_at is null) or
    (status <> 'pending' and reviewed_at is not null)
  )
);

create unique index helper_access_requests_one_pending_per_user
  on public.helper_access_requests (user_id) where status = 'pending';
create index helper_access_requests_status_created_idx
  on public.helper_access_requests (status, created_at desc);

create table public.sanket_reports (
  id text primary key,
  owner_id uuid references public.user_profiles(id) on delete restrict,
  report_type public.sanket_report_type not null,
  category public.sanket_category not null,
  urgency public.sanket_urgency not null default 'medium',
  status public.sanket_status not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  location_label text not null default 'Unverified location',
  locality text not null,
  taluk text not null,
  district text not null,
  latitude double precision,
  longitude double precision,
  location_source public.sanket_location_source not null default 'manual',
  reporter_name text not null,
  reporter_phone text not null,
  contact_preference text not null check (contact_preference in ('phone', 'sms', 'voice', 'none')),
  assistance_needs public.sanket_assistance_need[] not null default '{}',
  summary text not null check (length(trim(summary)) > 0),
  details text not null check (length(trim(details)) > 0),
  provenance_source_mode public.sanket_source_mode not null,
  provenance_source_label text not null,
  provenance_note text not null,
  origin_kind public.sanket_origin_kind not null,
  verification_status public.sanket_verification_status not null default 'unverified',
  verified_by uuid references public.user_profiles(id) on delete set null,
  verified_at timestamptz,
  constraint sanket_reports_owner_origin_check check (
    (origin_kind = 'user_submission' and owner_id is not null and provenance_source_mode = 'user_submission') or
    (origin_kind = 'demo' and owner_id is null and provenance_source_mode = 'demo')
  ),
  constraint sanket_reports_coordinate_pair_check check (
    (latitude is null and longitude is null) or
    (latitude between -90 and 90 and longitude between -180 and 180)
  ),
  constraint sanket_reports_verification_consistency check (
    (verification_status = 'verified' and verified_at is not null and verified_by is not null) or
    (verification_status <> 'verified')
  )
);

create index sanket_reports_owner_created_idx on public.sanket_reports (owner_id, created_at desc);
create index sanket_reports_queue_idx on public.sanket_reports (status, urgency, created_at desc)
  where status <> 'closed';
create index sanket_reports_category_created_idx on public.sanket_reports (category, created_at desc);
create index sanket_reports_location_idx on public.sanket_reports (district, taluk, locality);

create table public.sanket_report_assignments (
  id uuid primary key default gen_random_uuid(),
  report_id text not null references public.sanket_reports(id) on delete cascade,
  helper_id uuid references public.user_profiles(id) on delete set null,
  assigned_by uuid references public.user_profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  note text,
  helper_name_snapshot text not null,
  constraint sanket_assignment_end_after_start check (ended_at is null or ended_at >= assigned_at)
);

create unique index sanket_one_current_assignment_per_report
  on public.sanket_report_assignments (report_id) where ended_at is null;
create index sanket_assignments_helper_idx
  on public.sanket_report_assignments (helper_id, assigned_at desc);
create index sanket_assignments_report_history_idx
  on public.sanket_report_assignments (report_id, assigned_at desc);

create table public.sanket_report_status_history (
  id uuid primary key default gen_random_uuid(),
  report_id text not null references public.sanket_reports(id) on delete cascade,
  from_status public.sanket_status,
  to_status public.sanket_status not null,
  actor_id uuid references public.user_profiles(id) on delete set null,
  actor_label_snapshot text not null,
  note text,
  created_at timestamptz not null default now(),
  constraint sanket_status_history_initial_state_check check (
    (from_status is null and to_status = 'submitted') or from_status is not null
  )
);

create index sanket_status_history_report_time_idx
  on public.sanket_report_status_history (report_id, created_at);

create table public.sanket_report_notes (
  id uuid primary key default gen_random_uuid(),
  report_id text not null references public.sanket_reports(id) on delete cascade,
  author_id uuid references public.user_profiles(id) on delete set null,
  note text not null check (length(trim(note)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sanket_report_notes_report_time_idx
  on public.sanket_report_notes (report_id, created_at);

create table public.audit_records (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.user_profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  changed_fields jsonb not null default '{}'::jsonb check (jsonb_typeof(changed_fields) = 'object'),
  created_at timestamptz not null default now()
);

create index audit_records_entity_time_idx on public.audit_records (entity_type, entity_id, created_at desc);
create index audit_records_actor_time_idx on public.audit_records (actor_id, created_at desc);

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger user_profiles_touch_updated_at before update on public.user_profiles
  for each row execute function public.touch_updated_at();
create trigger helper_requests_touch_updated_at before update on public.helper_access_requests
  for each row execute function public.touch_updated_at();
create trigger sanket_reports_touch_updated_at before update on public.sanket_reports
  for each row execute function public.touch_updated_at();
create trigger sanket_notes_touch_updated_at before update on public.sanket_report_notes
  for each row execute function public.touch_updated_at();

create function public.protect_profile_privileges()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (new.role is distinct from old.role or new.account_status is distinct from old.account_status)
     and auth.role() = 'authenticated'
     and current_setting('abhedya.allow_privileged_profile_change', true) is distinct from 'on' then
    raise exception 'Profile role and account status are managed by ABHEDYA administrators';
  end if;
  return new;
end;
$$;

create trigger user_profiles_protect_privileges before update on public.user_profiles
  for each row execute function public.protect_profile_privileges();

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_role text;
begin
  insert into public.user_profiles (id, display_name, phone)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), '')
  );

  requested_role := new.raw_user_meta_data ->> 'requested_role';
  if requested_role = 'helper' then
    insert into public.helper_access_requests (user_id, organization, application_details)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'organization'), ''), 'Organization not supplied'),
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'application_details'), ''), 'Application details not supplied')
    );
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create function public.has_active_role(required_role public.user_role)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = required_role and account_status = 'active'
  );
$$;

create function public.current_profile_status()
returns public.account_status
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select account_status from public.user_profiles where id = auth.uid();
$$;

create function public.submit_helper_access_request(p_organization text, p_application_details text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_id uuid;
begin
  if auth.uid() is null or not public.has_active_role('victim') then
    raise exception 'An active account is required to apply as a helper';
  end if;
  if nullif(trim(p_organization), '') is null or nullif(trim(p_application_details), '') is null then
    raise exception 'Organization and application details are required';
  end if;
  insert into public.helper_access_requests (user_id, organization, application_details)
  values (auth.uid(), trim(p_organization), trim(p_application_details))
  returning id into request_id;
  return request_id;
end;
$$;

create function public.admin_list_helper_requests()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_active_role('admin') then
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
    from public.helper_access_requests request
    join public.user_profiles profile on profile.id = request.user_id
  ), '[]'::jsonb);
end;
$$;

create function public.admin_review_helper_request(
  p_request_id uuid,
  p_decision public.helper_request_status,
  p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_row public.helper_access_requests%rowtype;
begin
  if not public.has_active_role('admin') then
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

  update public.helper_access_requests
  set status = p_decision, reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_review_note
  where id = p_request_id;

  if p_decision = 'approved' then
    perform set_config('abhedya.allow_privileged_profile_change', 'on', true);
    update public.user_profiles set role = 'helper', account_status = 'active'
    where id = request_row.user_id;
  end if;

  insert into public.audit_records (actor_id, action, entity_type, entity_id, changed_fields)
  values (auth.uid(), 'helper_application_' || p_decision, 'helper_access_request', p_request_id::text,
    jsonb_build_object('status', p_decision));
end;
$$;

create function public.provision_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Admin provisioning is restricted to the trusted service role';
  end if;
  if not exists (select 1 from public.user_profiles where id = p_user_id) then
    raise exception 'User profile not found';
  end if;
  perform set_config('abhedya.allow_privileged_profile_change', 'on', true);
  update public.user_profiles set role = 'admin', account_status = 'active' where id = p_user_id;
  insert into public.audit_records (actor_id, action, entity_type, entity_id, changed_fields)
  values (null, 'admin_provisioned', 'user_profile', p_user_id::text, jsonb_build_object('role', 'admin'));
end;
$$;

create function public.create_sanket_report(p_report jsonb)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  report_code text;
  report_status public.sanket_status := 'submitted';
begin
  if auth.uid() is null or not public.has_active_role('victim') then
    raise exception 'An active victim account is required to submit a report';
  end if;

  report_code := 'SNK-' || to_char(nextval('public.sanket_report_code_seq'), 'FM0000');
  insert into public.sanket_reports (
    id, owner_id, report_type, category, urgency, status,
    location_label, locality, taluk, district, latitude, longitude, location_source,
    reporter_name, reporter_phone, contact_preference, assistance_needs,
    summary, details, provenance_source_mode, provenance_source_label, provenance_note,
    origin_kind, verification_status
  ) values (
    report_code, auth.uid(), (p_report ->> 'reportType')::public.sanket_report_type,
    (p_report ->> 'category')::public.sanket_category,
    coalesce((p_report ->> 'urgency')::public.sanket_urgency, 'medium'), report_status,
    coalesce(nullif(trim(p_report #>> '{location,label}'), ''), 'Unverified location'),
    trim(p_report #>> '{location,locality}'), trim(p_report #>> '{location,taluk}'),
    trim(p_report #>> '{location,district}'), nullif(p_report #>> '{location,latitude}', '')::double precision,
    nullif(p_report #>> '{location,longitude}', '')::double precision,
    coalesce((p_report #>> '{location,source}')::public.sanket_location_source, 'manual'),
    trim(p_report #>> '{reporter,name}'), trim(p_report #>> '{reporter,phone}'),
    p_report #>> '{reporter,contactPreference}',
    coalesce(array(select jsonb_array_elements_text(p_report -> 'assistanceNeeds')::public.sanket_assistance_need), '{}'),
    trim(p_report ->> 'summary'), trim(p_report ->> 'details'), 'user_submission',
    'Authenticated user submission', 'Stored by ABHEDYA; not externally verified.',
    'user_submission', 'unverified'
  );

  insert into public.sanket_report_status_history
    (report_id, from_status, to_status, actor_id, actor_label_snapshot, note)
  values (report_code, null, 'submitted', auth.uid(), 'Citizen', 'Report submitted.');
  insert into public.audit_records (actor_id, action, entity_type, entity_id, changed_fields)
  values (auth.uid(), 'report_created', 'sanket_report', report_code,
    jsonb_build_object('status', 'submitted', 'origin_kind', 'user_submission'));
  return report_code;
end;
$$;

create function public.get_my_sanket_report_codes()
returns table (id text)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select report.id from public.sanket_reports report
  where report.owner_id = auth.uid() and report.origin_kind = 'user_submission'
  order by report.created_at desc;
$$;

create function public.get_sanket_helper_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.has_active_role('helper') or public.has_active_role('admin')) then
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
      'assignmentHistory', '[]'::jsonb,
      'assignmentEvents', '[]'::jsonb,
      'statusHistory', '[]'::jsonb,
      'operationalNotes', '[]'::jsonb,
      'provenance', jsonb_build_object(
        'sourceMode', report.provenance_source_mode,
        'sourceLabel', report.provenance_source_label,
        'note', report.provenance_note
      ),
      'originKind', report.origin_kind,
      'verificationStatus', report.verification_status
    ) order by report.created_at desc)
    from public.sanket_reports report
    left join lateral (
      select assignment.helper_name_snapshot
      from public.sanket_report_assignments assignment
      where assignment.report_id = report.id and assignment.ended_at is null
      limit 1
    ) current_assignment on true
    where report.status <> 'closed'
  ), '[]'::jsonb);
end;
$$;

create function public.get_sanket_report_details(p_report_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  report_row public.sanket_reports%rowtype;
  can_view_operational boolean;
begin
  select * into report_row from public.sanket_reports where id = p_report_id;
  if not found then return null; end if;

  can_view_operational := public.has_active_role('helper') or public.has_active_role('admin');
  if not can_view_operational and not (
    public.has_active_role('victim') and report_row.owner_id = auth.uid()
    and report_row.origin_kind = 'user_submission'
  ) then
    raise exception 'Report access denied';
  end if;

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
      'name', report_row.reporter_name,
      'phone', case when can_view_operational or report_row.owner_id = auth.uid() then report_row.reporter_phone else '' end,
      'contactPreference', report_row.contact_preference
    ),
    'assistanceNeeds', report_row.assistance_needs,
    'summary', report_row.summary,
    'details', report_row.details,
    'assignedTo', (
      select assignment.helper_name_snapshot from public.sanket_report_assignments assignment
      where assignment.report_id = report_row.id and assignment.ended_at is null limit 1
    ),
    'assignmentHistory', coalesce((
      select jsonb_agg(jsonb_build_object(
        'from', history.from_status, 'to', history.to_status,
        'at', history.created_at, 'by', history.actor_label_snapshot, 'note', history.note
      ) order by history.created_at)
      from public.sanket_report_status_history history where history.report_id = report_row.id
    ), '[]'::jsonb),
    'assignmentEvents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'helperId', assignment.helper_id,
        'helperName', assignment.helper_name_snapshot,
        'assignedBy', assignment.assigned_by,
        'assignedAt', assignment.assigned_at,
        'endedAt', assignment.ended_at,
        'note', assignment.note
      ) order by assignment.assigned_at)
      from public.sanket_report_assignments assignment where assignment.report_id = report_row.id
    ), '[]'::jsonb),
    'operationalNotes', case when can_view_operational then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', note.id, 'authorId', note.author_id, 'note', note.note,
        'createdAt', note.created_at, 'updatedAt', note.updated_at
      ) order by note.created_at)
      from public.sanket_report_notes note where note.report_id = report_row.id
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

create function public.transition_sanket_report(
  p_report_id text,
  p_to_status public.sanket_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  report_row public.sanket_reports%rowtype;
  actor_label text;
  allowed boolean := false;
begin
  if not (public.has_active_role('helper') or public.has_active_role('admin')) then
    raise exception 'Approved, active helper access is required';
  end if;
  select * into report_row from public.sanket_reports where id = p_report_id for update;
  if not found then raise exception 'Report not found'; end if;

  allowed := (report_row.status = 'submitted' and p_to_status = 'incoming')
    or (report_row.status = 'incoming' and p_to_status = 'under_review')
    or (report_row.status = 'assigned' and p_to_status = 'in_progress')
    or (report_row.status = 'in_progress' and p_to_status = 'resolved')
    or (report_row.status = 'resolved' and p_to_status = 'closed');
  if not allowed then raise exception 'Invalid SANKET status transition: % to %', report_row.status, p_to_status; end if;

  if report_row.status in ('assigned', 'in_progress', 'resolved')
     and not public.has_active_role('admin')
     and not exists (
       select 1 from public.sanket_report_assignments assignment
       where assignment.report_id = report_row.id and assignment.helper_id = auth.uid() and assignment.ended_at is null
     ) then
    raise exception 'Only the assigned helper can advance this report';
  end if;

  select coalesce(display_name, 'Helper') into actor_label from public.user_profiles where id = auth.uid();
  update public.sanket_reports set status = p_to_status where id = report_row.id;
  insert into public.sanket_report_status_history
    (report_id, from_status, to_status, actor_id, actor_label_snapshot, note)
  values (report_row.id, report_row.status, p_to_status, auth.uid(), coalesce(actor_label, 'Helper'), p_note);
  insert into public.audit_records (actor_id, action, entity_type, entity_id, changed_fields)
  values (auth.uid(), 'report_status_changed', 'sanket_report', report_row.id,
    jsonb_build_object('from', report_row.status, 'to', p_to_status));
end;
$$;

create function public.assign_sanket_report(
  p_report_id text,
  p_helper_id uuid default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  report_row public.sanket_reports%rowtype;
  target_helper uuid;
  helper_name text;
  actor_label text;
begin
  if not (public.has_active_role('helper') or public.has_active_role('admin')) then
    raise exception 'Approved, active helper access is required';
  end if;
  target_helper := coalesce(p_helper_id, auth.uid());
  if not public.has_active_role('admin') and target_helper <> auth.uid() then
    raise exception 'Helpers may assign reports only to themselves';
  end if;
  if not exists (
    select 1 from public.user_profiles
    where id = target_helper and role = 'helper' and account_status = 'active'
  ) then raise exception 'Target must be an approved, active helper'; end if;

  select * into report_row from public.sanket_reports where id = p_report_id for update;
  if not found then raise exception 'Report not found'; end if;
  if report_row.status <> 'under_review' then
    raise exception 'A report must be under review before it can be assigned';
  end if;

  update public.sanket_report_assignments set ended_at = now()
  where report_id = p_report_id and ended_at is null;
  select coalesce(display_name, 'Helper') into helper_name from public.user_profiles where id = target_helper;
  select coalesce(display_name, 'Helper') into actor_label from public.user_profiles where id = auth.uid();
  insert into public.sanket_report_assignments
    (report_id, helper_id, assigned_by, note, helper_name_snapshot)
  values (p_report_id, target_helper, auth.uid(), p_note, helper_name);
  update public.sanket_reports set status = 'assigned' where id = p_report_id;
  insert into public.sanket_report_status_history
    (report_id, from_status, to_status, actor_id, actor_label_snapshot, note)
  values (p_report_id, 'under_review', 'assigned', auth.uid(), coalesce(actor_label, 'Helper'), p_note);
  insert into public.audit_records (actor_id, action, entity_type, entity_id, changed_fields)
  values (auth.uid(), 'report_assigned', 'sanket_report', p_report_id,
    jsonb_build_object('helper_id', target_helper));
end;
$$;

create function public.update_sanket_urgency(p_report_id text, p_urgency public.sanket_urgency)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.has_active_role('helper') or public.has_active_role('admin')) then
    raise exception 'Approved, active helper access is required';
  end if;
  if not public.has_active_role('admin') and not exists (
    select 1 from public.sanket_report_assignments
    where report_id = p_report_id and helper_id = auth.uid() and ended_at is null
  ) then raise exception 'Only the assigned helper can change urgency'; end if;

  update public.sanket_reports set urgency = p_urgency where id = p_report_id;
  if not found then raise exception 'Report not found'; end if;
  insert into public.audit_records (actor_id, action, entity_type, entity_id, changed_fields)
  values (auth.uid(), 'report_urgency_changed', 'sanket_report', p_report_id,
    jsonb_build_object('urgency', p_urgency));
end;
$$;

create function public.add_sanket_report_note(p_report_id text, p_note text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  note_id uuid;
begin
  if not (public.has_active_role('helper') or public.has_active_role('admin')) then
    raise exception 'Approved, active helper access is required';
  end if;
  if nullif(trim(p_note), '') is null then raise exception 'Note cannot be empty'; end if;
  if not exists (select 1 from public.sanket_reports where id = p_report_id) then
    raise exception 'Report not found';
  end if;
  insert into public.sanket_report_notes (report_id, author_id, note)
  values (p_report_id, auth.uid(), trim(p_note)) returning id into note_id;
  insert into public.audit_records (actor_id, action, entity_type, entity_id, changed_fields)
  values (auth.uid(), 'report_note_added', 'sanket_report', p_report_id, jsonb_build_object('note_id', note_id));
  return note_id;
end;
$$;

alter table public.user_profiles enable row level security;
alter table public.helper_access_requests enable row level security;
alter table public.sanket_reports enable row level security;
alter table public.sanket_report_assignments enable row level security;
alter table public.sanket_report_status_history enable row level security;
alter table public.sanket_report_notes enable row level security;
alter table public.audit_records enable row level security;

create policy user_profiles_read_self_or_admin on public.user_profiles
  for select to authenticated using (id = auth.uid() or public.has_active_role('admin'));
create policy user_profiles_update_self on public.user_profiles
  for update to authenticated using (id = auth.uid() and account_status = 'active')
  with check (id = auth.uid() and account_status = 'active');

create policy helper_requests_read_self_or_admin on public.helper_access_requests
  for select to authenticated using (user_id = auth.uid() or public.has_active_role('admin'));

create policy sanket_reports_read_owner on public.sanket_reports
  for select to authenticated using (
    owner_id = auth.uid() and origin_kind = 'user_submission' and public.has_active_role('victim')
  );

create policy sanket_status_history_read_owner on public.sanket_report_status_history
  for select to authenticated using (
    exists (
      select 1 from public.sanket_reports report
      where report.id = report_id and report.owner_id = auth.uid()
        and report.origin_kind = 'user_submission' and public.has_active_role('victim')
    )
  );

revoke all on public.user_profiles, public.helper_access_requests, public.sanket_reports,
  public.sanket_report_assignments, public.sanket_report_status_history,
  public.sanket_report_notes, public.audit_records from anon, authenticated;
grant select on public.user_profiles, public.helper_access_requests, public.sanket_reports,
  public.sanket_report_status_history to authenticated;
grant update (display_name, phone, organization) on public.user_profiles to authenticated;
grant all on public.user_profiles, public.helper_access_requests, public.sanket_reports,
  public.sanket_report_assignments, public.sanket_report_status_history,
  public.sanket_report_notes, public.audit_records to service_role;
grant usage, select on sequence public.sanket_report_code_seq to service_role;

revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.protect_profile_privileges() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.has_active_role(public.user_role) from public, anon;
revoke all on function public.current_profile_status() from public, anon;
revoke all on function public.submit_helper_access_request(text, text) from public, anon;
revoke all on function public.admin_list_helper_requests() from public, anon;
revoke all on function public.admin_review_helper_request(uuid, public.helper_request_status, text) from public, anon;
revoke all on function public.provision_admin(uuid) from public, anon, authenticated;
revoke all on function public.create_sanket_report(jsonb) from public, anon;
revoke all on function public.get_my_sanket_report_codes() from public, anon;
revoke all on function public.get_sanket_helper_queue() from public, anon;
revoke all on function public.get_sanket_report_details(text) from public, anon;
revoke all on function public.transition_sanket_report(text, public.sanket_status, text) from public, anon;
revoke all on function public.assign_sanket_report(text, uuid, text) from public, anon;
revoke all on function public.update_sanket_urgency(text, public.sanket_urgency) from public, anon;
revoke all on function public.add_sanket_report_note(text, text) from public, anon;

grant execute on function public.has_active_role(public.user_role) to authenticated;
grant execute on function public.current_profile_status() to authenticated;
grant execute on function public.submit_helper_access_request(text, text) to authenticated;
grant execute on function public.admin_list_helper_requests() to authenticated;
grant execute on function public.admin_review_helper_request(uuid, public.helper_request_status, text) to authenticated;
grant execute on function public.provision_admin(uuid) to service_role;
grant execute on function public.create_sanket_report(jsonb) to authenticated;
grant execute on function public.get_my_sanket_report_codes() to authenticated;
grant execute on function public.get_sanket_helper_queue() to authenticated;
grant execute on function public.get_sanket_report_details(text) to authenticated;
grant execute on function public.transition_sanket_report(text, public.sanket_status, text) to authenticated;
grant execute on function public.assign_sanket_report(text, uuid, text) to authenticated;
grant execute on function public.update_sanket_urgency(text, public.sanket_urgency) to authenticated;
grant execute on function public.add_sanket_report_note(text, text) to authenticated;

insert into public.sanket_reports (
  id, owner_id, report_type, category, urgency, status, created_at, updated_at,
  location_label, locality, taluk, district, latitude, longitude, location_source,
  reporter_name, reporter_phone, contact_preference, assistance_needs, summary, details,
  provenance_source_mode, provenance_source_label, provenance_note, origin_kind, verification_status
) values
(
  'SNK-0001', null, 'incident', 'waterlogging', 'high', 'assigned',
  '2026-10-31T08:10:00+05:30', '2026-10-31T08:12:00+05:30',
  'Near Bus Stand', 'Kundapura Town', 'Kundapura', 'Udupi', 13.6227, 74.6913, 'manual',
  'Anitha N.', '+91 98765 43210', 'phone', array['food_water','rescue']::public.sanket_assistance_need[],
  'Road near bus stand remains waterlogged after heavy rain.',
  'Water is impeding access for pedestrians and riders. Residents are waiting for assistance.',
  'demo', 'Prototype sample', 'Synthetic example data for interface development only.', 'demo', 'unverified'
),
(
  'SNK-0002', null, 'assistance', 'medical_assistance', 'critical', 'assigned',
  '2026-10-31T09:05:00+05:30', '2026-10-31T09:18:00+05:30',
  'Asha Clinic area', 'Byndoor', 'Byndoor', 'Udupi', 13.8585, 74.6344, 'unverified',
  'Rakesh P.', '+91 99887 66554', 'sms', array['medical','transport']::public.sanket_assistance_need[],
  'Family needs urgent medical support and transportation to a clinic.',
  'A resident is reporting a health concern and is unable to access a vehicle due to disrupted roads.',
  'demo', 'Prototype sample', 'Synthetic example data for interface development only.', 'demo', 'unverified'
);

insert into public.sanket_report_status_history
  (report_id, from_status, to_status, actor_id, actor_label_snapshot, note, created_at)
values
('SNK-0001', null, 'submitted', null, 'Citizen', 'Synthetic sample submission.', '2026-10-31T08:10:00+05:30'),
('SNK-0001', 'submitted', 'incoming', null, 'Prototype queue', 'New report entered', '2026-10-31T08:12:00+05:30'),
('SNK-0001', 'incoming', 'under_review', null, 'Riya M.', 'Initial review completed', '2026-10-31T08:15:00+05:30'),
('SNK-0001', 'under_review', 'assigned', null, 'Riya M.', 'Assigned to field follow-up', '2026-10-31T08:20:00+05:30'),
('SNK-0002', null, 'submitted', null, 'Citizen', 'Synthetic sample submission.', '2026-10-31T09:05:00+05:30'),
('SNK-0002', 'submitted', 'incoming', null, 'Prototype queue', 'New report entered', '2026-10-31T09:06:00+05:30'),
('SNK-0002', 'incoming', 'under_review', null, 'Aarav K.', 'Urgency validated', '2026-10-31T09:09:00+05:30'),
('SNK-0002', 'under_review', 'assigned', null, 'Aarav K.', 'Assigned for medical support review', '2026-10-31T09:12:00+05:30');

insert into public.sanket_report_assignments
  (report_id, helper_id, assigned_by, assigned_at, note, helper_name_snapshot)
values
('SNK-0001', null, null, '2026-10-31T08:20:00+05:30', 'Assigned to field follow-up', 'Riya M.'),
('SNK-0002', null, null, '2026-10-31T09:12:00+05:30', 'Assigned for medical support review', 'Aarav K.');

commit;