begin;

create table public.medha_priority_overrides (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  report_id text not null references public.sanket_reports(id) on delete cascade,
  previous_priority text check (previous_priority in ('critical', 'high', 'medium', 'low')),
  override_priority text not null check (override_priority in ('critical', 'high', 'medium', 'low')),
  reason text not null check (length(pg_catalog.btrim(reason)) between 10 and 1000),
  reviewer_id uuid,
  reviewer_label_snapshot text not null,
  created_at timestamptz not null default pg_catalog.now(),
  is_legacy boolean not null default false,
  constraint medha_priority_override_provenance check (
    (is_legacy and previous_priority is null) or
    (not is_legacy and previous_priority is not null and reviewer_id is not null)
  )
);

create index medha_priority_overrides_latest_idx
  on public.medha_priority_overrides (report_id, created_at desc, id desc);

alter table public.medha_priority_overrides enable row level security;
create policy medha_priority_overrides_read_authorized on public.medha_priority_overrides
  for select to authenticated using (
    public.has_active_role('helper') or public.has_active_role('admin')
  );
revoke all on public.medha_priority_overrides from public, anon, authenticated;
grant select on public.medha_priority_overrides to authenticated;
grant all on public.medha_priority_overrides to service_role;
revoke all on public.medha_incident_analysis, public.medha_priority_assessments
  from public, anon, authenticated;
grant all on public.medha_incident_analysis, public.medha_priority_assessments to service_role;

create or replace function public.medha_calculate_priority(p_report_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  report_row public.sanket_reports%rowtype;
  factors jsonb := '[]'::jsonb;
  unknown_factors jsonb := '[]'::jsonb;
  urgency_score integer;
  assistance_score integer := 0;
  assistance_label text;
  score integer := 0;
  confidence integer := 100;
  elapsed_hours numeric;
  assessed_at timestamptz := pg_catalog.statement_timestamp();
  priority text;
begin
  select * into report_row
  from public.sanket_reports
  where id = p_report_id and origin_kind = 'user_submission';
  if not found then
    raise exception 'Operational SANKET report % not found', p_report_id;
  end if;

  urgency_score := case report_row.urgency
    when 'critical' then 8
    when 'high' then 5
    when 'medium' then 3
    else 1
  end;
  factors := factors || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'key', 'reported-urgency',
    'label', 'Reporter-selected urgency: ' || report_row.urgency::text,
    'points', urgency_score,
    'explanation', 'Self-reported urgency is included as a signal, not independently verified.'
  ));

  if report_row.report_type = 'sos' then
    factors := factors || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'key', 'sos', 'label', 'SOS report', 'points', 2,
      'explanation', 'An SOS request indicates an immediate assistance request.'
    ));
  elsif report_row.report_type = 'assistance' then
    factors := factors || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'key', 'assistance', 'label', 'Assistance request', 'points', 1,
      'explanation', 'A request for assistance contributes to the review score.'
    ));
  end if;

  select least(4, coalesce(sum(case need
    when 'rescue' then 2
    when 'medical' then 2
    when 'evacuation' then 2
    when 'shelter' then 1
    when 'transport' then 1
    when 'food_water' then 1
    else 0
  end), 0)), pg_catalog.string_agg(need::text, ', ')
  into assistance_score, assistance_label
  from pg_catalog.unnest(report_row.assistance_needs) as needs(need);

  if assistance_score > 0 then
    factors := factors || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'key', 'assistance-needs',
      'label', 'Critical assistance needs reported',
      'points', assistance_score,
      'explanation', 'Selected assistance needs: ' || assistance_label || '.'
    ));
  end if;

  if report_row.reported_injuries_count is null then
    unknown_factors := unknown_factors || pg_catalog.jsonb_build_array('Reported injuries');
  elsif report_row.reported_injuries_count > 0 then
    factors := factors || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'key', 'injuries',
      'label', report_row.reported_injuries_count || ' reported injuries',
      'points', 4,
      'explanation', 'Injuries were explicitly reported in the submitted report.'
    ));
  end if;

  if report_row.people_trapped_count is null then
    unknown_factors := unknown_factors || pg_catalog.jsonb_build_array('People trapped');
  elsif report_row.people_trapped_count > 0 then
    factors := factors || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'key', 'trapped',
      'label', report_row.people_trapped_count || ' people reported trapped',
      'points', 5,
      'explanation', 'People trapped were explicitly reported in the submitted report.'
    ));
  end if;

  if report_row.vulnerable_people_count is null then
    unknown_factors := unknown_factors || pg_catalog.jsonb_build_array('Vulnerable people');
  elsif report_row.vulnerable_people_count > 0 then
    factors := factors || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'key', 'vulnerable-people',
      'label', report_row.vulnerable_people_count || ' vulnerable people reported',
      'points', 3,
      'explanation', 'Vulnerable people were explicitly reported in the submitted report.'
    ));
  end if;

  if report_row.people_affected_count is null then
    unknown_factors := unknown_factors || pg_catalog.jsonb_build_array('Number of people affected');
  elsif report_row.people_affected_count > 0 then
    factors := factors || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'key', 'people-affected',
      'label', report_row.people_affected_count || ' people affected',
      'points', least(3, ceil(report_row.people_affected_count / 10.0)::integer),
      'explanation', 'Affected-person count was explicitly reported in the submitted report.'
    ));
  end if;

  if report_row.verification_status <> 'verified' then
    factors := factors || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'key', 'verification',
      'label', 'Report is ' || report_row.verification_status::text,
      'points', 0,
      'explanation', 'Verification status reduces confidence and requires human review; it does not lower reported risk.'
    ));
  end if;

  elapsed_hours := greatest(0, pg_catalog.date_part('epoch', assessed_at - report_row.created_at) / 3600);
  if report_row.status not in ('resolved', 'closed') and elapsed_hours >= 6 then
    factors := factors || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'key', 'unresolved-age',
      'label', 'Unresolved for ' || floor(elapsed_hours)::integer || ' hours',
      'points', case when elapsed_hours >= 24 then 2 else 1 end,
      'explanation', 'Time since submission is a review signal; it does not change SANKET status.'
    ));
  end if;

  select coalesce(sum((factor ->> 'points')::integer), 0)
  into score
  from pg_catalog.jsonb_array_elements(factors) as entries(factor);

  priority := case
    when score >= 15 then 'critical'
    when score >= 10 then 'high'
    when score >= 6 then 'medium'
    else 'low'
  end;
  confidence := greatest(
    20,
    100
      - pg_catalog.jsonb_array_length(unknown_factors)::integer * 8
      - case when report_row.verification_status = 'verified' then 0 else 15 end
      - case when report_row.latitude is not null and report_row.longitude is not null then 0 else 10 end
  );

  return pg_catalog.jsonb_build_object(
    'priority', priority,
    'score', score,
    'confidence', confidence / 100.0,
    'factors', factors,
    'unknownFactors', unknown_factors,
    'assessedAt', assessed_at,
    'algorithmVersion', 'medha-rules-v1'
  );
end;
$$;

alter function public.medha_calculate_priority(text) owner to postgres;
revoke all on function public.medha_calculate_priority(text) from public, anon, authenticated;

insert into public.medha_priority_overrides (
  id, report_id, previous_priority, override_priority, reason, reviewer_id,
  reviewer_label_snapshot, created_at, is_legacy
)
select
  legacy.id,
  legacy.report_id,
  null,
  legacy.override_priority,
  legacy.override_reason,
  legacy.reviewer_id,
  coalesce(profile.display_name, 'Legacy reviewer identity unavailable'),
  legacy.assessed_at,
  true
from public.medha_priority_assessments as legacy
left join public.user_profiles as profile on profile.id = legacy.reviewer_id
where legacy.override_priority is not null;

create or replace function public.refresh_medha_analyses(p_report_ids text[])
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  report_id text;
  assessment jsonb;
begin
  if auth.uid() is null or not (
    public.has_active_role('helper') or public.has_active_role('admin')
  ) then
    raise exception 'Approved, active reviewer access is required';
  end if;
  if p_report_ids is null or pg_catalog.cardinality(p_report_ids) > 5000
     or array_position(p_report_ids, null) is not null
     or cardinality(p_report_ids) <> (
       select count(distinct value) from pg_catalog.unnest(p_report_ids) as ids(value)
     ) then
    raise exception 'Report IDs must be a non-null array of at most 5000 unique IDs';
  end if;

  foreach report_id in array p_report_ids
  loop
    perform 1 from public.sanket_reports
    where id = report_id and origin_kind = 'user_submission'
    for update;
    if not found then raise exception 'Operational SANKET report % not found', report_id; end if;
    assessment := public.medha_calculate_priority(report_id);

    insert into public.medha_incident_analysis (
      report_id, algorithm_version, suggested_priority, score, confidence, factors, assessed_at
    ) values (
      report_id,
      assessment ->> 'algorithmVersion',
      assessment ->> 'priority',
      (assessment ->> 'score')::integer,
      (assessment ->> 'confidence')::numeric,
      pg_catalog.jsonb_build_object(
        'factors', assessment -> 'factors',
        'unknownFactors', assessment -> 'unknownFactors'
      ),
      (assessment ->> 'assessedAt')::timestamptz
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

alter function public.refresh_medha_analyses(text[]) owner to postgres;
revoke all on function public.refresh_medha_analyses(text[]) from public, anon;
grant execute on function public.refresh_medha_analyses(text[]) to authenticated;

create or replace function public.record_medha_priority_override(
  p_report_id text,
  p_override_priority text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  report_row public.sanket_reports%rowtype;
  assessment jsonb;
  current_override public.medha_priority_overrides%rowtype;
  previous_priority text;
  reviewer_label text;
  override_at timestamptz;
begin
  if auth.uid() is null or not (
    public.has_active_role('helper') or public.has_active_role('admin')
  ) then
    raise exception 'Approved, active reviewer access is required';
  end if;
  if p_override_priority is null
     or p_override_priority not in ('critical', 'high', 'medium', 'low')
     or nullif(pg_catalog.btrim(p_reason), '') is null
     or length(pg_catalog.btrim(p_reason)) < 10
     or length(pg_catalog.btrim(p_reason)) > 1000 then
    raise exception 'A valid priority and a reason of 10 to 1000 characters are required';
  end if;

  select * into report_row
  from public.sanket_reports
  where id = p_report_id and origin_kind = 'user_submission'
  for update;
  if not found then raise exception 'Operational SANKET report not found'; end if;
  override_at := pg_catalog.clock_timestamp();

  assessment := public.medha_calculate_priority(p_report_id);
  insert into public.medha_incident_analysis (
    report_id, algorithm_version, suggested_priority, score, confidence, factors, assessed_at
  ) values (
    p_report_id,
    assessment ->> 'algorithmVersion',
    assessment ->> 'priority',
    (assessment ->> 'score')::integer,
    (assessment ->> 'confidence')::numeric,
    pg_catalog.jsonb_build_object(
      'factors', assessment -> 'factors',
      'unknownFactors', assessment -> 'unknownFactors'
    ),
    (assessment ->> 'assessedAt')::timestamptz
  )
  on conflict (report_id) do update set
    algorithm_version = excluded.algorithm_version,
    suggested_priority = excluded.suggested_priority,
    score = excluded.score,
    confidence = excluded.confidence,
    factors = excluded.factors,
    assessed_at = excluded.assessed_at;

  select * into current_override
  from public.medha_priority_overrides
  where report_id = p_report_id
  order by created_at desc, id desc
  limit 1;
  previous_priority := coalesce(current_override.override_priority, assessment ->> 'priority');

  select coalesce(nullif(pg_catalog.btrim(display_name), ''), auth.uid()::text)
  into reviewer_label
  from public.user_profiles
  where id = auth.uid();
  if reviewer_label is null then raise exception 'Active reviewer profile not found'; end if;

  insert into public.medha_priority_overrides (
    report_id, previous_priority, override_priority, reason, reviewer_id,
    reviewer_label_snapshot, created_at, is_legacy
  ) values (
    p_report_id, previous_priority, p_override_priority, pg_catalog.btrim(p_reason),
    auth.uid(), reviewer_label, override_at, false
  );

  insert into public.medha_review_history
    (report_id, reviewer_id, action, note, changed_fields, created_at)
  values (
    p_report_id, auth.uid(), 'priority_overridden', pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'previous_priority', previous_priority,
      'new_priority', p_override_priority
    ),
    override_at
  );
  insert into public.audit_records (actor_id, action, entity_type, entity_id, changed_fields, created_at)
  values (
    auth.uid(), 'medha_priority_overridden', 'sanket_report', p_report_id,
    pg_catalog.jsonb_build_object(
      'previous_priority', previous_priority,
      'new_priority', p_override_priority,
      'reason', pg_catalog.btrim(p_reason)
    ),
    override_at
  );
end;
$$;

alter function public.record_medha_priority_override(text, text, text) owner to postgres;
revoke all on function public.record_medha_priority_override(text, text, text) from public, anon;
grant execute on function public.record_medha_priority_override(text, text, text) to authenticated;

revoke all on function public.save_medha_analyses(jsonb) from public, anon, authenticated;
revoke all on function public.override_medha_priority(text, text, integer, numeric, jsonb, text, text)
  from public, anon, authenticated;

alter function public.get_medha_incidents() rename to get_medha_incidents_legacy;
revoke all on function public.get_medha_incidents_legacy() from public, anon, authenticated;

create function public.get_medha_incidents()
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
    select pg_catalog.jsonb_agg(
      incident.value || pg_catalog.jsonb_build_object(
        'analysis', analysis.value,
        'priorityOverride', case when override.id is null then null else pg_catalog.jsonb_build_object(
          'priority', override.override_priority,
          'previousPriority', override.previous_priority,
          'reason', override.reason,
          'at', override.created_at,
          'by', override.reviewer_label_snapshot,
          'reviewerId', override.reviewer_id
        ) end
      ) order by incident.ordinality
    )
    from pg_catalog.jsonb_array_elements(public.get_medha_incidents_legacy())
      with ordinality as incident(value, ordinality)
    cross join lateral public.medha_calculate_priority(incident.value ->> 'id') as analysis(value)
    left join lateral (
      select event.id, event.override_priority, event.previous_priority, event.reason,
        event.created_at, event.reviewer_id, event.reviewer_label_snapshot
      from public.medha_priority_overrides as event
      where event.report_id = incident.value ->> 'id'
      order by event.created_at desc, event.id desc
      limit 1
    ) as override on true
  ), '[]'::jsonb);
end;
$$;

alter function public.get_medha_incidents() owner to postgres;
revoke all on function public.get_medha_incidents() from public, anon;
grant execute on function public.get_medha_incidents() to authenticated;

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
    select pg_catalog.jsonb_agg(
      incident.value || pg_catalog.jsonb_build_object(
        'analysis', assessment.value,
        'effectivePriority', coalesce(override.override_priority, assessment.value ->> 'priority'),
        'priorityProvenance', pg_catalog.jsonb_build_object(
          'source', case when override.id is null then 'automated_assessment' else 'reviewer_override' end,
          'priority', coalesce(override.override_priority, assessment.value ->> 'priority'),
          'previousPriority', override.previous_priority,
          'reviewerId', override.reviewer_id,
          'reviewerName', override.reviewer_label_snapshot,
          'reason', override.reason,
          'changedAt', override.created_at,
          'algorithmVersion', assessment.value ->> 'algorithmVersion',
          'assessedAt', assessment.value ->> 'assessedAt'
        ),
        'priorityOverride', case when override.id is null then null else pg_catalog.jsonb_build_object(
          'priority', override.override_priority,
          'previousPriority', override.previous_priority,
          'reason', override.reason,
          'at', override.created_at,
          'by', override.reviewer_label_snapshot,
          'reviewerId', override.reviewer_id
        ) end
      ) order by report.created_at
    )
    from pg_catalog.jsonb_array_elements(public.get_medha_incidents()) as incident(value)
    join public.sanket_reports as report
      on report.id = incident.value ->> 'id'
     and report.origin_kind = 'user_submission'
     and report.verification_status = 'verified'
    cross join lateral public.medha_calculate_priority(report.id) as assessment(value)
    left join lateral (
      select event.id, event.override_priority, event.previous_priority, event.reason,
        event.created_at, event.reviewer_id, event.reviewer_label_snapshot
      from public.medha_priority_overrides as event
      where event.report_id = report.id
      order by event.created_at desc, event.id desc
      limit 1
    ) as override on true
  ), '[]'::jsonb);
end;
$$;

alter function public.get_medha_sena_handoff() owner to postgres;
revoke all on function public.get_medha_sena_handoff() from public, anon;
grant execute on function public.get_medha_sena_handoff() to authenticated;

commit;
