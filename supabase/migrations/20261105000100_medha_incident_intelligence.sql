begin;

alter table public.sanket_reports
  add column if not exists people_affected_count integer,
  add column if not exists reported_injuries_count integer,
  add column if not exists vulnerable_people_count integer,
  add column if not exists people_trapped_count integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sanket_people_affected_count_range'
    and conrelid = 'public.sanket_reports'::regclass) then
    alter table public.sanket_reports add constraint sanket_people_affected_count_range
      check (people_affected_count between 0 and 1000000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sanket_reported_injuries_count_range'
    and conrelid = 'public.sanket_reports'::regclass) then
    alter table public.sanket_reports add constraint sanket_reported_injuries_count_range
      check (reported_injuries_count between 0 and 1000000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sanket_vulnerable_people_count_range'
    and conrelid = 'public.sanket_reports'::regclass) then
    alter table public.sanket_reports add constraint sanket_vulnerable_people_count_range
      check (vulnerable_people_count between 0 and 1000000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sanket_people_trapped_count_range'
    and conrelid = 'public.sanket_reports'::regclass) then
    alter table public.sanket_reports add constraint sanket_people_trapped_count_range
      check (people_trapped_count between 0 and 1000000);
  end if;
end;
$$;

comment on column public.sanket_reports.people_affected_count is
  'Optional count explicitly supplied by the reporter; NULL means unknown, not zero.';
comment on column public.sanket_reports.reported_injuries_count is
  'Optional count explicitly supplied by the reporter; NULL means unknown, not zero.';
comment on column public.sanket_reports.vulnerable_people_count is
  'Optional count explicitly supplied by the reporter; NULL means unknown, not zero.';
comment on column public.sanket_reports.people_trapped_count is
  'Optional count explicitly supplied by the reporter; NULL means unknown, not zero.';

create table public.medha_incident_analysis (
  report_id text primary key references public.sanket_reports(id) on delete cascade,
  algorithm_version text not null,
  suggested_priority text not null check (suggested_priority in ('critical', 'high', 'medium', 'low')),
  score integer not null check (score between 0 and 100),
  confidence numeric(4, 3) not null check (confidence between 0 and 1),
  factors jsonb not null check (jsonb_typeof(factors) = 'object'),
  assessed_at timestamptz not null default now()
);

create table public.medha_duplicate_matches (
  first_report_id text not null references public.sanket_reports(id) on delete cascade,
  second_report_id text not null references public.sanket_reports(id) on delete cascade,
  similarity numeric(4, 3) not null check (similarity between 0 and 1),
  reasons jsonb not null check (jsonb_typeof(reasons) = 'array'),
  decision text not null default 'flagged' check (decision in ('flagged', 'confirmed', 'rejected')),
  reviewed_by uuid references public.user_profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  detected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (first_report_id, second_report_id),
  constraint medha_duplicate_pair_order check (first_report_id < second_report_id),
  constraint medha_duplicate_review_consistency check (
    (decision = 'flagged' and reviewed_by is null and reviewed_at is null) or
    (decision <> 'flagged' and reviewed_by is not null and reviewed_at is not null)
  )
);

create table public.medha_priority_assessments (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  report_id text not null references public.sanket_reports(id) on delete cascade,
  suggested_priority text not null check (suggested_priority in ('critical', 'high', 'medium', 'low')),
  suggested_score integer not null check (suggested_score between 0 and 100),
  confidence numeric(4, 3) not null check (confidence between 0 and 1),
  factors jsonb not null check (jsonb_typeof(factors) = 'object'),
  override_priority text check (override_priority in ('critical', 'high', 'medium', 'low')),
  override_reason text,
  reviewer_id uuid references public.user_profiles(id) on delete set null,
  assessed_at timestamptz not null default now(),
  constraint medha_priority_override_reason check (
    (override_priority is null and override_reason is null) or
    (override_priority is not null and length(pg_catalog.btrim(override_reason)) >= 10 and reviewer_id is not null)
  )
);

create index medha_priority_assessments_latest_idx
  on public.medha_priority_assessments (report_id, assessed_at desc);

create table public.medha_review_history (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  report_id text not null references public.sanket_reports(id) on delete cascade,
  related_report_id text references public.sanket_reports(id) on delete set null,
  reviewer_id uuid references public.user_profiles(id) on delete set null,
  action text not null check (action in (
    'verified', 'request_information', 'duplicate_flagged', 'duplicate_confirmed',
    'duplicate_rejected', 'priority_overridden'
  )),
  note text not null check (length(pg_catalog.btrim(note)) between 1 and 1000),
  changed_fields jsonb not null default '{}'::jsonb check (jsonb_typeof(changed_fields) = 'object'),
  created_at timestamptz not null default now()
);

create index medha_review_history_report_created_idx
  on public.medha_review_history (report_id, created_at desc);

alter table public.medha_incident_analysis enable row level security;
alter table public.medha_duplicate_matches enable row level security;
alter table public.medha_priority_assessments enable row level security;
alter table public.medha_review_history enable row level security;

create policy medha_analysis_read_authorized on public.medha_incident_analysis
  for select to authenticated using (
    public.has_active_role('helper') or public.has_active_role('admin')
  );
create policy medha_duplicates_read_authorized on public.medha_duplicate_matches
  for select to authenticated using (
    public.has_active_role('helper') or public.has_active_role('admin')
  );
create policy medha_priorities_read_authorized on public.medha_priority_assessments
  for select to authenticated using (
    public.has_active_role('helper') or public.has_active_role('admin')
  );
create policy medha_reviews_read_authorized on public.medha_review_history
  for select to authenticated using (
    public.has_active_role('helper') or public.has_active_role('admin')
  );

revoke all on public.medha_incident_analysis, public.medha_duplicate_matches,
  public.medha_priority_assessments, public.medha_review_history
from public, anon, authenticated;
grant select on public.medha_incident_analysis, public.medha_duplicate_matches,
  public.medha_priority_assessments, public.medha_review_history to authenticated;
grant all on public.medha_incident_analysis, public.medha_duplicate_matches,
  public.medha_priority_assessments, public.medha_review_history to service_role;

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
    provenance_note, origin_kind, verification_status, people_affected_count,
    reported_injuries_count, vulnerable_people_count, people_trapped_count
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
    'Stored by ABHEDYA; not externally verified.', 'user_submission', 'unverified',
    nullif(p_report #>> '{reportedImpacts,peopleAffected}', '')::integer,
    nullif(p_report #>> '{reportedImpacts,reportedInjuries}', '')::integer,
    nullif(p_report #>> '{reportedImpacts,vulnerablePeople}', '')::integer,
    nullif(p_report #>> '{reportedImpacts,peopleTrapped}', '')::integer
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
      'reportedImpacts', jsonb_build_object(
        'peopleAffected', report.people_affected_count,
        'reportedInjuries', report.reported_injuries_count,
        'vulnerablePeople', report.vulnerable_people_count,
        'peopleTrapped', report.people_trapped_count
      ),
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
    'reportedImpacts', jsonb_build_object(
      'peopleAffected', report_row.people_affected_count,
      'reportedInjuries', report_row.reported_injuries_count,
      'vulnerablePeople', report_row.vulnerable_people_count,
      'peopleTrapped', report_row.people_trapped_count
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

create or replace function public.get_medha_incidents()
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
    raise exception 'Approved, active reviewer access is required';
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
      'reportedImpacts', jsonb_build_object(
        'peopleAffected', report.people_affected_count,
        'reportedInjuries', report.reported_injuries_count,
        'vulnerablePeople', report.vulnerable_people_count,
        'peopleTrapped', report.people_trapped_count
      ),
      'assistanceNeeds', report.assistance_needs,
      'summary', report.summary,
      'details', report.details,
      'assignedTo', current_assignment.helper_name_snapshot,
      'assignmentHistory', coalesce((
        select jsonb_agg(jsonb_build_object(
          'from', history.from_status, 'to', history.to_status,
          'at', history.created_at, 'by', history.actor_label_snapshot
        ) order by history.created_at)
        from public.sanket_report_status_history as history
        where history.report_id = report.id
      ), '[]'::jsonb),
      'reviewHistory', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', review.id, 'action', review.action, 'note', review.note,
          'at', review.created_at, 'by', coalesce(profile.display_name, 'Reviewer'),
          'relatedReportId', review.related_report_id
        ) order by review.created_at desc)
        from public.medha_review_history as review
        left join public.user_profiles as profile on profile.id = review.reviewer_id
        where review.report_id = report.id
      ), '[]'::jsonb),
      'duplicateMatches', coalesce((
        select jsonb_agg(jsonb_build_object(
          'firstReportId', match.first_report_id,
          'secondReportId', match.second_report_id,
          'similarity', match.similarity,
          'reasons', match.reasons,
          'decision', match.decision,
          'reviewedAt', match.reviewed_at,
          'reviewedBy', coalesce(profile.display_name, 'Reviewer')
        ) order by match.updated_at desc)
        from public.medha_duplicate_matches as match
        left join public.user_profiles as profile on profile.id = match.reviewed_by
        where report.id in (match.first_report_id, match.second_report_id)
      ), '[]'::jsonb),
      'analysis', case when analysis.report_id is null then null else jsonb_build_object(
        'priority', analysis.suggested_priority, 'score', analysis.score,
        'confidence', analysis.confidence, 'factors', analysis.factors -> 'factors',
        'unknownFactors', analysis.factors -> 'unknownFactors',
        'assessedAt', analysis.assessed_at, 'algorithmVersion', analysis.algorithm_version
      ) end,
      'priorityOverride', case when override.id is null then null else jsonb_build_object(
        'priority', override.override_priority, 'reason', override.override_reason,
        'at', override.assessed_at, 'by', coalesce(profile.display_name, 'Reviewer')
      ) end,
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
      select assignment.helper_name_snapshot
      from public.sanket_report_assignments as assignment
      where assignment.report_id = report.id and assignment.ended_at is null
      order by assignment.assigned_at desc limit 1
    ) as current_assignment on true
    left join public.medha_incident_analysis as analysis on analysis.report_id = report.id
    left join lateral (
      select assessment.id, assessment.override_priority, assessment.override_reason,
        assessment.assessed_at, assessment.reviewer_id
      from public.medha_priority_assessments as assessment
      where assessment.report_id = report.id and assessment.override_priority is not null
      order by assessment.assessed_at desc limit 1
    ) as override on true
    left join public.user_profiles as profile on profile.id = override.reviewer_id
    where report.origin_kind = 'user_submission'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.save_medha_analyses(p_analyses jsonb)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  item jsonb;
  report_id text;
begin
  if auth.uid() is null or not (
    public.has_active_role('helper') or public.has_active_role('admin')
  ) then
    raise exception 'Approved, active reviewer access is required';
  end if;
  if p_analyses is null or jsonb_typeof(p_analyses) <> 'array'
     or jsonb_array_length(p_analyses) > 5000 then
    raise exception 'Analysis payload must be an array of at most 5000 items';
  end if;

  for item in select value from jsonb_array_elements(p_analyses)
  loop
    report_id := item ->> 'reportId';
    if jsonb_typeof(item) <> 'object'
       or item ->> 'algorithmVersion' <> 'medha-rules-v1'
       or item ->> 'priority' not in ('critical', 'high', 'medium', 'low')
       or jsonb_typeof(item -> 'score') <> 'number'
       or (item ->> 'score')::integer not between 0 and 100
       or jsonb_typeof(item -> 'confidence') <> 'number'
       or (item ->> 'confidence')::numeric not between 0 and 1
       or jsonb_typeof(item -> 'factors') <> 'array'
       or jsonb_typeof(item -> 'unknownFactors') <> 'array' then
      raise exception 'Invalid analysis payload for report %', report_id;
    end if;
    if not exists (
      select 1 from public.sanket_reports
      where id = report_id and origin_kind = 'user_submission'
    ) then
      raise exception 'Incident % not found', report_id;
    end if;

    insert into public.medha_incident_analysis
      (report_id, algorithm_version, suggested_priority, score, confidence, factors, assessed_at)
    values (
      report_id, item ->> 'algorithmVersion', item ->> 'priority',
      (item ->> 'score')::integer, (item ->> 'confidence')::numeric,
      jsonb_build_object('factors', item -> 'factors', 'unknownFactors', item -> 'unknownFactors'),
      coalesce((item ->> 'assessedAt')::timestamptz, pg_catalog.now())
    )
    on conflict (report_id) do update set
      algorithm_version = excluded.algorithm_version,
      suggested_priority = excluded.suggested_priority,
      score = excluded.score,
      confidence = excluded.confidence,
      factors = excluded.factors,
      assessed_at = excluded.assessed_at;
  end loop;
end;
$$;

create or replace function public.record_medha_review(
  p_report_id text,
  p_action text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  report_row public.sanket_reports%rowtype;
begin
  if auth.uid() is null or not (
    public.has_active_role('helper') or public.has_active_role('admin')
  ) then
    raise exception 'Approved, active reviewer access is required';
  end if;
  if p_action not in ('verified', 'request_information')
     or nullif(pg_catalog.btrim(p_note), '') is null
     or length(pg_catalog.btrim(p_note)) > 1000 then
    raise exception 'A valid review action and note are required';
  end if;
  select * into report_row from public.sanket_reports
  where id = p_report_id and origin_kind = 'user_submission' for update;
  if not found then raise exception 'Incident not found'; end if;

  if p_action = 'verified' then
    update public.sanket_reports
    set verification_status = 'verified', verified_by = auth.uid(), verified_at = pg_catalog.now()
    where id = p_report_id;
  end if;
  insert into public.medha_review_history (report_id, reviewer_id, action, note, changed_fields)
  values (p_report_id, auth.uid(), p_action, pg_catalog.btrim(p_note),
    jsonb_build_object('verification_status',
      case when p_action = 'verified' then 'verified' else report_row.verification_status::text end));
  insert into public.audit_records (actor_id, action, entity_type, entity_id, changed_fields)
  values (auth.uid(), 'medha_' || p_action, 'sanket_report', p_report_id,
    jsonb_build_object('note', pg_catalog.btrim(p_note)));
end;
$$;

create or replace function public.record_medha_duplicate_decision(
  p_first_report_id text,
  p_second_report_id text,
  p_similarity numeric,
  p_reasons jsonb,
  p_decision text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  first_id text;
  second_id text;
  action_name text;
begin
  if auth.uid() is null or not (
    public.has_active_role('helper') or public.has_active_role('admin')
  ) then
    raise exception 'Approved, active reviewer access is required';
  end if;
  if p_first_report_id is null or p_second_report_id is null
     or p_first_report_id = p_second_report_id
     or p_similarity is null or p_similarity not between 0 and 1
     or jsonb_typeof(p_reasons) <> 'array' or jsonb_array_length(p_reasons) > 20
     or p_decision not in ('flagged', 'confirmed', 'rejected')
     or nullif(pg_catalog.btrim(p_note), '') is null
     or length(pg_catalog.btrim(p_note)) > 1000 then
    raise exception 'Invalid duplicate review decision';
  end if;
  first_id := least(p_first_report_id, p_second_report_id);
  second_id := greatest(p_first_report_id, p_second_report_id);
  if (select count(*) from public.sanket_reports
      where id in (first_id, second_id) and origin_kind = 'user_submission') <> 2 then
    raise exception 'Both source incidents must exist';
  end if;

  insert into public.medha_duplicate_matches (
    first_report_id, second_report_id, similarity, reasons, decision,
    reviewed_by, reviewed_at, review_note, updated_at
  ) values (
    first_id, second_id, p_similarity, p_reasons, p_decision,
    case when p_decision = 'flagged' then null else auth.uid() end,
    case when p_decision = 'flagged' then null else pg_catalog.now() end,
    pg_catalog.btrim(p_note), pg_catalog.now()
  )
  on conflict (first_report_id, second_report_id) do update set
    similarity = excluded.similarity,
    reasons = excluded.reasons,
    decision = excluded.decision,
    reviewed_by = excluded.reviewed_by,
    reviewed_at = excluded.reviewed_at,
    review_note = excluded.review_note,
    updated_at = excluded.updated_at;

  action_name := case p_decision when 'flagged' then 'duplicate_flagged'
    when 'confirmed' then 'duplicate_confirmed' else 'duplicate_rejected' end;
  insert into public.medha_review_history
    (report_id, related_report_id, reviewer_id, action, note, changed_fields)
  values
    (first_id, second_id, auth.uid(), action_name, pg_catalog.btrim(p_note),
      jsonb_build_object('decision', p_decision, 'similarity', p_similarity)),
    (second_id, first_id, auth.uid(), action_name, pg_catalog.btrim(p_note),
      jsonb_build_object('decision', p_decision, 'similarity', p_similarity));
  insert into public.audit_records (actor_id, action, entity_type, entity_id, changed_fields)
  values (auth.uid(), 'medha_' || action_name, 'sanket_report_pair', first_id || ':' || second_id,
    jsonb_build_object('decision', p_decision, 'similarity', p_similarity));
end;
$$;

create or replace function public.override_medha_priority(
  p_report_id text,
  p_suggested_priority text,
  p_suggested_score integer,
  p_confidence numeric,
  p_factors jsonb,
  p_override_priority text,
  p_reason text
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
    raise exception 'Approved, active reviewer access is required';
  end if;
  if p_suggested_priority not in ('critical', 'high', 'medium', 'low')
     or p_override_priority not in ('critical', 'high', 'medium', 'low')
     or p_suggested_score not between 0 and 100
     or p_confidence not between 0 and 1
     or jsonb_typeof(p_factors) <> 'object'
     or length(pg_catalog.btrim(p_reason)) < 10
     or length(pg_catalog.btrim(p_reason)) > 1000
     or not exists (select 1 from public.sanket_reports
       where id = p_report_id and origin_kind = 'user_submission') then
    raise exception 'Valid incident, priority assessment, and override reason are required';
  end if;

  insert into public.medha_priority_assessments (
    report_id, suggested_priority, suggested_score, confidence, factors,
    override_priority, override_reason, reviewer_id
  ) values (
    p_report_id, p_suggested_priority, p_suggested_score, p_confidence, p_factors,
    p_override_priority, pg_catalog.btrim(p_reason), auth.uid()
  );
  insert into public.medha_review_history
    (report_id, reviewer_id, action, note, changed_fields)
  values (p_report_id, auth.uid(), 'priority_overridden', pg_catalog.btrim(p_reason),
    jsonb_build_object(
      'suggested_priority', p_suggested_priority,
      'override_priority', p_override_priority,
      'suggested_score', p_suggested_score
    ));
  insert into public.audit_records (actor_id, action, entity_type, entity_id, changed_fields)
  values (auth.uid(), 'medha_priority_overridden', 'sanket_report', p_report_id,
    jsonb_build_object('suggested_priority', p_suggested_priority, 'override_priority', p_override_priority));
end;
$$;

create or replace function public.get_medha_sena_handoff()
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
    raise exception 'Approved, active reviewer access is required';
  end if;
  return coalesce((
    select jsonb_agg(
      incident || jsonb_build_object(
        'effectivePriority',
        coalesce(incident #>> '{priorityOverride,priority}', incident #>> '{analysis,priority}', 'medium')
      ) order by incident ->> 'createdAt'
    )
    from jsonb_array_elements(public.get_medha_incidents()) as item(incident)
    where incident ->> 'verificationStatus' = 'verified'
  ), '[]'::jsonb);
end;
$$;

alter function public.create_sanket_report(jsonb) owner to postgres;
alter function public.get_medha_incidents() owner to postgres;
alter function public.save_medha_analyses(jsonb) owner to postgres;
alter function public.record_medha_review(text, text, text) owner to postgres;
alter function public.record_medha_duplicate_decision(text, text, numeric, jsonb, text, text) owner to postgres;
alter function public.override_medha_priority(text, text, integer, numeric, jsonb, text, text) owner to postgres;
alter function public.get_medha_sena_handoff() owner to postgres;

revoke all on function public.get_medha_incidents() from public, anon;
revoke all on function public.save_medha_analyses(jsonb) from public, anon;
revoke all on function public.record_medha_review(text, text, text) from public, anon;
revoke all on function public.record_medha_duplicate_decision(text, text, numeric, jsonb, text, text) from public, anon;
revoke all on function public.override_medha_priority(text, text, integer, numeric, jsonb, text, text) from public, anon;
revoke all on function public.get_medha_sena_handoff() from public, anon;
grant execute on function public.get_medha_incidents() to authenticated;
grant execute on function public.save_medha_analyses(jsonb) to authenticated;
grant execute on function public.record_medha_review(text, text, text) to authenticated;
grant execute on function public.record_medha_duplicate_decision(text, text, numeric, jsonb, text, text) to authenticated;
grant execute on function public.override_medha_priority(text, text, integer, numeric, jsonb, text, text) to authenticated;
grant execute on function public.get_medha_sena_handoff() to authenticated;

commit;
