begin;

-- ============================================================================
-- SENA Tactical Dispatch & Response Units Schema
-- ============================================================================
create table if not exists public.sena_response_units (
  id text primary key,
  name text not null,
  agency text not null check (agency in (
    'NDRF', 'SDRF', 'Fire & Emergency', 'District Health', 'Civil Defense', 'Volunteer Corps'
  )),
  call_sign text not null,
  leader text not null,
  phone text not null,
  personnel_count integer not null default 1 check (personnel_count > 0),
  status text not null default 'available' check (status in ('available', 'deployed', 'rest')),
  capabilities text[] not null default '{}',
  base_location jsonb not null,
  current_location jsonb not null,
  assigned_incident_id text references public.sanket_reports(id) on delete set null,
  updated_at timestamptz not null default pg_catalog.now()
);

create index if not exists sena_response_units_status_idx
  on public.sena_response_units (status, agency);

create table if not exists public.sena_dispatch_orders (
  id text primary key,
  incident_id text not null unique references public.sanket_reports(id) on delete cascade,
  unit_id text not null references public.sena_response_units(id) on delete restrict,
  unit_name text not null,
  status text not null default 'dispatched' check (status in (
    'pending_dispatch', 'dispatched', 'en_route', 'on_scene', 'operation_underway', 'resolved'
  )),
  priority text not null check (priority in ('critical', 'high', 'medium', 'low')),
  mission_brief text not null check (length(pg_catalog.btrim(mission_brief)) > 0),
  dispatched_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  assigned_by_id uuid references public.user_profiles(id) on delete set null,
  assigned_by text not null,
  field_logs jsonb not null default '[]'::jsonb,
  outcome jsonb
);

create index if not exists sena_dispatch_orders_status_idx
  on public.sena_dispatch_orders (status, updated_at desc);

alter table public.sena_response_units enable row level security;
alter table public.sena_dispatch_orders enable row level security;

create policy sena_units_helper_read on public.sena_response_units
  for select to authenticated using (
    public.has_active_role('helper') or public.has_active_role('admin')
  );

create policy sena_units_helper_write on public.sena_response_units
  for update to authenticated using (
    public.has_active_role('helper') or public.has_active_role('admin')
  ) with check (
    public.has_active_role('helper') or public.has_active_role('admin')
  );

create policy sena_dispatches_helper_read on public.sena_dispatch_orders
  for select to authenticated using (
    public.has_active_role('helper') or public.has_active_role('admin')
  );

create policy sena_dispatches_helper_insert on public.sena_dispatch_orders
  for insert to authenticated with check (
    public.has_active_role('helper') or public.has_active_role('admin')
  );

create policy sena_dispatches_helper_update on public.sena_dispatch_orders
  for update to authenticated using (
    public.has_active_role('helper') or public.has_active_role('admin')
  ) with check (
    public.has_active_role('helper') or public.has_active_role('admin')
  );

revoke all on public.sena_response_units, public.sena_dispatch_orders from public, anon, authenticated;
grant select, update on public.sena_response_units to authenticated;
grant select, insert, update on public.sena_dispatch_orders to authenticated;
grant all on public.sena_response_units, public.sena_dispatch_orders to service_role;

-- ============================================================================
-- PUNARJEEV Relief Camps, Supplies, Safe Check-ins & Rehab Claims Schema
-- ============================================================================
create table if not exists public.punarjeev_relief_camps (
  id text primary key,
  name text not null,
  taluk text not null,
  address text not null,
  location jsonb not null,
  manager_name text not null,
  manager_phone text not null,
  capacity integer not null check (capacity > 0),
  current_occupancy integer not null default 0 check (current_occupancy >= 0),
  status text not null default 'open' check (status in ('open', 'near_capacity', 'full', 'closed')),
  facilities text[] not null default '{}',
  urgently_needed text[] not null default '{}',
  last_updated timestamptz not null default pg_catalog.now()
);

create table if not exists public.punarjeev_supplies (
  id text primary key,
  camp_id text not null references public.punarjeev_relief_camps(id) on delete cascade,
  camp_name text not null,
  category text not null check (category in (
    'food_water', 'medical_aid', 'bedding_clothing', 'hygiene_sanitation', 'infant_care', 'tools_clearance'
  )),
  item_name text not null check (length(pg_catalog.btrim(item_name)) > 0),
  quantity integer not null check (quantity > 0),
  unit text not null,
  status text not null default 'critical' check (status in ('sufficient', 'low', 'critical')),
  requested_by uuid references public.user_profiles(id) on delete set null,
  last_restocked timestamptz not null default pg_catalog.now()
);

create table if not exists public.punarjeev_safe_checkins (
  id text primary key,
  full_name text not null check (length(pg_catalog.btrim(full_name)) > 0),
  age integer,
  gender text check (gender in ('male', 'female', 'other')),
  home_locality text not null check (length(pg_catalog.btrim(home_locality)) > 0),
  camp_id text not null references public.punarjeev_relief_camps(id) on delete restrict,
  camp_name text not null,
  contact_phone text not null check (length(pg_catalog.btrim(contact_phone)) > 0),
  family_members_count integer not null default 1 check (family_members_count > 0),
  checked_in_at timestamptz not null default pg_catalog.now(),
  status text not null default 'safe_in_camp' check (status in ('safe_in_camp', 'reunited', 'departed')),
  submitted_by uuid references public.user_profiles(id) on delete set null
);

create index if not exists punarjeev_checkins_camp_idx
  on public.punarjeev_safe_checkins (camp_id, checked_in_at desc);

create table if not exists public.punarjeev_rehab_requests (
  id text primary key,
  owner_id uuid references public.user_profiles(id) on delete set null,
  claimant_name text not null check (length(pg_catalog.btrim(claimant_name)) > 0),
  claimant_phone text not null check (length(pg_catalog.btrim(claimant_phone)) > 0),
  claimant_aadhaar_last4 text,
  taluk text not null,
  locality text not null,
  claim_type text not null check (claim_type in (
    'house_damage', 'crop_loss', 'livestock_loss', 'medical_reimbursement', 'livelihood_kit'
  )),
  estimated_loss_inr numeric,
  description text not null check (length(pg_catalog.btrim(description)) > 0),
  status text not null default 'submitted' check (status in (
    'submitted', 'field_verification', 'approved', 'disbursed', 'rejected'
  )),
  approval_notes text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index if not exists punarjeev_rehab_owner_idx
  on public.punarjeev_rehab_requests (owner_id, created_at desc);

alter table public.punarjeev_relief_camps enable row level security;
alter table public.punarjeev_supplies enable row level security;
alter table public.punarjeev_safe_checkins enable row level security;
alter table public.punarjeev_rehab_requests enable row level security;

create policy punarjeev_camps_authenticated_read on public.punarjeev_relief_camps
  for select to authenticated using (auth.uid() is not null);

create policy punarjeev_camps_helper_write on public.punarjeev_relief_camps
  for all to authenticated using (
    public.has_active_role('helper') or public.has_active_role('admin')
  ) with check (
    public.has_active_role('helper') or public.has_active_role('admin')
  );

create policy punarjeev_supplies_helper_all on public.punarjeev_supplies
  for all to authenticated using (
    public.has_active_role('helper') or public.has_active_role('admin')
  ) with check (
    public.has_active_role('helper') or public.has_active_role('admin')
  );

create policy punarjeev_checkins_helper_or_own_read on public.punarjeev_safe_checkins
  for select to authenticated using (
    public.has_active_role('helper') or public.has_active_role('admin') or submitted_by = auth.uid()
  );

create policy punarjeev_checkins_authenticated_insert on public.punarjeev_safe_checkins
  for insert to authenticated with check (
    auth.uid() is not null and (submitted_by is null or submitted_by = auth.uid())
  );

create policy punarjeev_rehab_owner_or_helper_read on public.punarjeev_rehab_requests
  for select to authenticated using (
    owner_id = auth.uid() or public.has_active_role('helper') or public.has_active_role('admin')
  );

create policy punarjeev_rehab_authenticated_insert on public.punarjeev_rehab_requests
  for insert to authenticated with check (
    auth.uid() is not null and (owner_id is null or owner_id = auth.uid())
  );

create policy punarjeev_rehab_helper_update on public.punarjeev_rehab_requests
  for update to authenticated using (
    public.has_active_role('helper') or public.has_active_role('admin')
  ) with check (
    public.has_active_role('helper') or public.has_active_role('admin')
  );

revoke all on public.punarjeev_relief_camps, public.punarjeev_supplies, public.punarjeev_safe_checkins, public.punarjeev_rehab_requests from public, anon, authenticated;
grant select, insert, update on public.punarjeev_relief_camps to authenticated;
grant select, insert, update on public.punarjeev_supplies to authenticated;
grant select, insert on public.punarjeev_safe_checkins to authenticated;
grant select, insert, update on public.punarjeev_rehab_requests to authenticated;
grant all on public.punarjeev_relief_camps, public.punarjeev_supplies, public.punarjeev_safe_checkins, public.punarjeev_rehab_requests to service_role;

-- ============================================================================
-- Idempotent Operational Infrastructure Catalog (No Citizen PII)
-- ============================================================================
insert into public.sena_response_units (
  id, name, agency, call_sign, leader, phone, personnel_count, status, capabilities, base_location, current_location
) values
  (
    'UNIT-NDRF-01',
    'NDRF 10th Bn - Swift Water Team Alpha',
    'NDRF',
    'Viper-1',
    'Insp. Ramesh Gowda',
    '+91 94481 12345',
    18,
    'available',
    array['water_rescue', 'evacuation', 'aerial_recon'],
    '{"label":"Malpe Coastal Rescue Station","locality":"Malpe Port","taluk":"Udupi","district":"Udupi","latitude":13.3512,"longitude":74.6978,"source":"manual"}'::jsonb,
    '{"label":"Malpe Coastal Rescue Station","locality":"Malpe Port","taluk":"Udupi","district":"Udupi","latitude":13.3512,"longitude":74.6978,"source":"manual"}'::jsonb
  ),
  (
    'UNIT-SDRF-02',
    'SDRF Coastal Command Unit 2',
    'SDRF',
    'Cobra-2',
    'Sub-Insp. Vinod Shenoy',
    '+91 94482 23456',
    14,
    'available',
    array['water_rescue', 'debris_clearance', 'evacuation'],
    '{"label":"Kundapura Flood Base","locality":"Kundapura","taluk":"Kundapura","district":"Udupi","latitude":13.6268,"longitude":74.6922,"source":"manual"}'::jsonb,
    '{"label":"Kundapura Flood Base","locality":"Kundapura","taluk":"Kundapura","district":"Udupi","latitude":13.6268,"longitude":74.6922,"source":"manual"}'::jsonb
  ),
  (
    'UNIT-QRT-MED-01',
    'District Medical Quick Reaction Ambulance Unit',
    'District Health',
    'Lifeline-1',
    'Dr. Priya Rao',
    '+91 94483 34567',
    8,
    'available',
    array['medical_triage', 'evacuation'],
    '{"label":"Udupi District Hospital","locality":"Brahmagiri","taluk":"Udupi","district":"Udupi","latitude":13.3364,"longitude":74.7421,"source":"manual"}'::jsonb,
    '{"label":"Udupi District Hospital","locality":"Brahmagiri","taluk":"Udupi","district":"Udupi","latitude":13.3364,"longitude":74.7421,"source":"manual"}'::jsonb
  ),
  (
    'UNIT-FIRE-01',
    'Karnataka Fire & Emergency Services Rescue Team',
    'Fire & Emergency',
    'Blaze-4',
    'Station Officer K. Poojary',
    '+91 94484 45678',
    12,
    'available',
    array['debris_clearance', 'water_rescue', 'evacuation'],
    '{"label":"Udupi Central Fire Station","locality":"Bannanje","taluk":"Udupi","district":"Udupi","latitude":13.3440,"longitude":74.7480,"source":"manual"}'::jsonb,
    '{"label":"Udupi Central Fire Station","locality":"Bannanje","taluk":"Udupi","district":"Udupi","latitude":13.3440,"longitude":74.7480,"source":"manual"}'::jsonb
  ),
  (
    'UNIT-CIVIL-01',
    'Civil Defense Supply & Shelter Logistics Team',
    'Civil Defense',
    'Care-1',
    'Warden S. Hegde',
    '+91 94485 56789',
    16,
    'available',
    array['supply_distribution', 'evacuation'],
    '{"label":"Brahmavara Community Staging Depot","locality":"Brahmavara","taluk":"Brahmavara","district":"Udupi","latitude":13.4312,"longitude":74.7511,"source":"manual"}'::jsonb,
    '{"label":"Brahmavara Community Staging Depot","locality":"Brahmavara","taluk":"Brahmavara","district":"Udupi","latitude":13.4312,"longitude":74.7511,"source":"manual"}'::jsonb
  ),
  (
    'UNIT-VOL-01',
    'Byndoor Coastal Volunteer Scout Unit',
    'Volunteer Corps',
    'Mitra-3',
    'Lead Volunteer Ganesh K.',
    '+91 94486 67890',
    10,
    'available',
    array['supply_distribution', 'aerial_recon'],
    '{"label":"Byndoor Panchayat Relief Point","locality":"Byndoor","taluk":"Byndoor","district":"Udupi","latitude":13.8690,"longitude":74.6310,"source":"manual"}'::jsonb,
    '{"label":"Byndoor Panchayat Relief Point","locality":"Byndoor","taluk":"Byndoor","district":"Udupi","latitude":13.8690,"longitude":74.6310,"source":"manual"}'::jsonb
  )
on conflict (id) do nothing;

insert into public.punarjeev_relief_camps (
  id, name, taluk, address, location, manager_name, manager_phone, capacity, current_occupancy, status, facilities, urgently_needed
) values
  (
    'CAMP-KND-01',
    'St. Jude High School Gymnasium',
    'Kundapura',
    'Basrur Road, Kundapura - 576201',
    '{"label":"St. Jude High School","locality":"Basrur Road","taluk":"Kundapura","district":"Udupi","latitude":13.6310,"longitude":74.6980,"source":"manual"}'::jsonb,
    'Capt. A. Bhat',
    '+91 98450 11204',
    500,
    0,
    'open',
    array['Hot Meals 3x/Day', 'Doctor on Duty', 'Clean Water Supply', 'Women Safe Zone', 'Livestock Enclosure'],
    array['infant_care', 'food_water', 'bedding_clothing']
  ),
  (
    'CAMP-UDP-02',
    'Municipal Stadium Arena Complex',
    'Udupi',
    'Brahmagiri Main Road, Udupi - 576101',
    '{"label":"Municipal Stadium Arena","locality":"Brahmagiri","taluk":"Udupi","district":"Udupi","latitude":13.3380,"longitude":74.7430,"source":"manual"}'::jsonb,
    'Dr. A. Sharma',
    '+91 98450 22315',
    2500,
    0,
    'open',
    array['Hot Meals 3x/Day', '4 Doctors On-Duty', 'Pharmacy Dispensary', 'Child Care Nursery', 'Backup Power Generator'],
    array['medical_aid', 'bedding_clothing']
  ),
  (
    'CAMP-BYN-03',
    'Byndoor Town Community Hall',
    'Byndoor',
    'Panchayat Road, Byndoor - 576214',
    '{"label":"Byndoor Community Hall","locality":"Panchayat Road","taluk":"Byndoor","district":"Udupi","latitude":13.8680,"longitude":74.6330,"source":"manual"}'::jsonb,
    'Smt. R. Poojary',
    '+91 98450 33426',
    600,
    0,
    'open',
    array['Community Kitchen', 'Paramedic Mobile Unit', 'Drinking Water RO Plant', 'Sanitation Block'],
    array['food_water', 'hygiene_sanitation']
  ),
  (
    'CAMP-BRH-04',
    'Brahmavara Agricultural College Center',
    'Brahmavara',
    'NH-66 Highway Junction, Brahmavara - 576213',
    '{"label":"Brahmavara College Campus","locality":"NH-66 Junction","taluk":"Brahmavara","district":"Udupi","latitude":13.4350,"longitude":74.7480,"source":"manual"}'::jsonb,
    'Shri. V. Shetty',
    '+91 98450 44537',
    800,
    0,
    'open',
    array['Hot Meals', 'Emergency Triage Unit', 'Safe Sleeping Quarters', 'Helipad Clearance Zone', 'Animal Foster Care'],
    array['tools_clearance', 'bedding_clothing']
  ),
  (
    'CAMP-KRK-05',
    'Karkala Taluk Memorial Hall',
    'Karkala',
    'Anekere Road, Karkala - 574104',
    '{"label":"Memorial Hall","locality":"Anekere Road","taluk":"Karkala","district":"Udupi","latitude":13.2120,"longitude":74.9960,"source":"manual"}'::jsonb,
    'Shri. K. Rao',
    '+91 98450 55648',
    400,
    0,
    'open',
    array['Drinking Water Supply', 'Medical First Aid', 'Hot Rations', 'Women Safety Desk'],
    array['hygiene_sanitation', 'infant_care']
  )
on conflict (id) do nothing;

-- Safely add tables to Supabase Realtime publication when present
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.sanket_reports;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.sena_dispatch_orders;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.punarjeev_relief_camps;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

commit;

