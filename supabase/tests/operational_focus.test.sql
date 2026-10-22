begin;
set local timezone = 'America/Sao_Paulo';
set local search_path = public, extensions;
select no_plan();

create function pg_temp.id(n integer) returns uuid language sql immutable as $$
  select ('ef000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
$$;
alter table public.clinics alter constraint clinics_owner_profile_fk deferrable initially deferred;
insert into auth.users(id) select pg_temp.id(n) from generate_series(1, 6) n;
insert into public.clinics(id, name, owner_profile_id)
values (pg_temp.id(10), 'Synthetic operational clinic', pg_temp.id(1)),
       (pg_temp.id(11), 'Synthetic other clinic', pg_temp.id(6));
insert into public.profiles(id, clinic_id, name, role, status)
select pg_temp.id(n), case when n = 6 then pg_temp.id(11) else pg_temp.id(10) end,
       'Synthetic login ' || n,
       (array['admin','manager','reception','professional','finance','admin']::public.user_role[])[n], 'active'
from generate_series(1, 6) n;
set constraints clinics_owner_profile_fk immediate;
insert into public.units(id, clinic_id, name)
values (pg_temp.id(20), pg_temp.id(10), 'Synthetic unit A'),
       (pg_temp.id(21), pg_temp.id(10), 'Synthetic unit B'),
       (pg_temp.id(22), pg_temp.id(11), 'Synthetic foreign unit');
insert into public.profile_units(profile_id, unit_id)
select pg_temp.id(n), pg_temp.id(20) from generate_series(2, 5) n;
create temp table ids(key text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.id(4)::text, true);
select is(public.current_role()::text, 'reception', 'professional login gets the shared operational role');
select ok(public.has_module_permission('patients', true) and public.has_module_permission('agenda', true)
  and public.has_module_permission('enrollments', true), 'all three operational modules are editable');
select ok(not public.has_module_permission('records', false) and not public.has_module_permission('finance', false)
  and not public.has_module_permission('users', false), 'other modules remain paused');
select ok(public.has_unit_access(pg_temp.id(20)) and not public.has_unit_access(pg_temp.id(21))
  and not public.has_unit_access(pg_temp.id(22)), 'unit and clinic boundaries remain');
select lives_ok($$insert into public.patients(clinic_id, primary_unit_id, name)
  values(pg_temp.id(10), pg_temp.id(20), 'Synthetic operational patient')$$,
  'professional login can create a patient');
insert into ids select 'patient', id from public.patients where name = 'Synthetic operational patient';
select is((select count(*) from public.patients where id = (select id from ids where key = 'patient')), 1::bigint,
  'patient is readable after save');

select set_config('request.jwt.claim.sub', pg_temp.id(5)::text, true);
select is(public.current_role()::text, 'reception', 'finance login gets the same operational role');
select lives_ok($$insert into ids values ('plan', (public.save_plan(
  '{"duration_days":30,"sessions_included":8,"price_cents":22000}'::jsonb, gen_random_uuid())).id)$$,
  'finance login can save a plan');
select is((select price_cents from public.plans where id = (select id from ids where key = 'plan')), 22000,
  'plan remains readable at its saved price');
select lives_ok($$insert into ids values ('enrollment', (public.save_enrollment(jsonb_build_object(
  'patient_id', (select id from ids where key = 'patient'),
  'plan_id', (select id from ids where key = 'plan'),
  'unit_id', pg_temp.id(20), 'starts_at', '2026-08-01', 'due_day', 5), gen_random_uuid())).id)$$,
  'finance login can enroll the patient for August');
select set_config('request.jwt.claim.sub', pg_temp.id(4)::text, true);
select lives_ok($$select public.save_plan('{"price_cents":30000}'::jsonb, gen_random_uuid(),
  (select id from ids where key = 'plan'))$$, 'professional login can update the catalogue price');
select is(public.enrollment_amount_at((select id from ids where key = 'enrollment'),
  '2026-09-01', '2026-09-30'), 22000, 'sold plan retains its contracted price');
select set_config('request.jwt.claim.sub', pg_temp.id(5)::text, true);
insert into ids select 'august', id from public.charges
  where enrollment_id = (select id from ids where key = 'enrollment') and coverage_from = '2026-08-01';
select ok(public.can_access_charge((select id from ids where key = 'august')),
  'enrollment charge is readable');
select lives_ok($$insert into ids values ('september', (public.create_enrollment_charge(jsonb_build_object(
  'patient_id', (select id from ids where key = 'patient'),
  'enrollment_id', (select id from ids where key = 'enrollment'),
  'unit_id', pg_temp.id(20), 'description', 'Synthetic September',
  'due_at', '2026-09-05', 'coverage_from', '2026-09-01', 'coverage_to', '2026-09-30'),
  gen_random_uuid())).id)$$, 'September charge uses the existing contract');
select is((select amount_cents from public.charges where id = (select id from ids where key = 'september')),
  22000, 'historical charge has the contracted amount');
select lives_ok($$select public.register_payment((select id from ids where key = 'september'),
  10000, 'pix', now(), 'synthetic-focus-receipt', gen_random_uuid())$$,
  'finance login can register a partial receipt');
select is((select paid_cents from public.charges where id = (select id from ids where key = 'september')),
  10000, 'paid amount persists');
select is((select count(*) from public.payments where charge_id = (select id from ids where key = 'september')),
  1::bigint, 'receipt is readable after save');
select throws_ok($$select public.register_payment((select id from ids where key = 'september'),
  13000, 'cash', now(), 'synthetic-focus-overpay', gen_random_uuid())$$,
  'P0001', 'INVALID_PAYMENT_AMOUNT', 'receipt cannot exceed the remaining balance');
select lives_ok($$select public.adjust_charge_amount((select id from ids where key = 'september'),
  22000, 10000, 24000, 'Synthetic reviewed amount correction', gen_random_uuid())$$,
  'authorized operator can correct the September charge');
select is((select amount_cents from public.charges where id = (select id from ids where key = 'september')),
  24000, 'corrected September amount persists');
select lives_ok($$select public.set_enrollment_contract_terms(
  (select id from ids where key = 'enrollment'),
  (select updated_at from public.enrollments where id = (select id from ids where key = 'enrollment')),
  22000, 25000, '2026-10-01', 'Synthetic reviewed October terms', gen_random_uuid())$$,
  'new recurring amount saves with an explicit effective month');
select is(public.enrollment_amount_at((select id from ids where key = 'enrollment'),
  '2026-10-01', '2026-10-31'), 25000, 'October uses the new contract value');
select throws_ok($$select public.create_enrollment_charge(jsonb_build_object(
  'patient_id', (select id from ids where key = 'patient'),
  'enrollment_id', (select id from ids where key = 'enrollment'),
  'unit_id', pg_temp.id(20), 'description', 'Duplicate September',
  'due_at', '2026-09-05', 'coverage_from', '2026-09-01', 'coverage_to', '2026-09-30'),
  gen_random_uuid())$$, 'P0001', 'CHARGE_ALREADY_EXISTS', 'coverage cannot be billed twice');
reset role;
with inserted as (
  insert into public.charges(clinic_id, patient_id, unit_id, description, amount_cents, due_at)
  values(pg_temp.id(10), (select id from ids where key = 'patient'), pg_temp.id(20),
    'Synthetic standalone entry', 15000, '2026-09-05') returning id
) insert into ids select 'standalone', id from inserted;
set local role authenticated;
select is((select count(*) from public.charges where id = (select id from ids where key = 'standalone')),
  0::bigint, 'standalone finance charge stays outside operational reads');
select throws_ok($$select public.adjust_charge_amount((select id from ids where key = 'standalone'),
  15000, 0, 16000, 'Synthetic unsupported finance adjustment', gen_random_uuid())$$,
  'P0001', 'CHARGE_NOT_FOUND', 'standalone finance amount cannot be changed');

select set_config('request.jwt.claim.sub', pg_temp.id(3)::text, true);
select lives_ok($$insert into ids values ('class', (public.create_class_with_schedule(
  pg_temp.id(20), 'Synthetic operational class', null, 'active', current_date,
  array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']::public.class_weekday[],
  time '09:00', time '10:00', 'America/Sao_Paulo', null, 7, null)->'class'->>'id')::uuid)$$,
  'reception login can create a class and weekly schedule');
select lives_ok($$select public.save_operational_membership((select id from ids where key = 'class'),
  (select id from ids where key = 'patient'), current_date, null,
  array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']::public.class_weekday[],
  (select id from ids where key = 'enrollment'), null)$$,
  'patient is linked to the canonical class membership');
select lives_ok($$select public.ensure_calendar_window(pg_temp.id(20), current_date, current_date + 1)$$,
  'occurrence is materialized for the selected day');
insert into ids select 'occurrence', id from public.class_occurrences
  where class_id = (select id from ids where key = 'class') and local_date = current_date limit 1;
select is((select count(*) from public.effective_occurrence_patient_ids((select id from ids where key = 'occurrence'))),
  1::bigint, 'the class roster contains the enrolled patient');
select lives_ok($$select public.save_occurrence_attendance((select id from ids where key = 'occurrence'),
  (select id from ids where key = 'patient'), 'PRESENT')$$, 'attendance is recorded');
select is((select count(*) from public.get_class_occurrence_attendance((select id from ids where key = 'occurrence'))
  where attendance_status = 'PRESENT'), 1::bigint, 'attendance appears after reloading the roster');
select lives_ok($$insert into public.group_slots(clinic_id, unit_id, name, weekdays, starts_at,
  starts_on, duration_minutes, capacity)
  values(pg_temp.id(10), pg_temp.id(20), 'Synthetic legacy class',
  array[1,2,3,4,5]::smallint[], time '11:00', current_date, 60, 7)$$,
  'the legacy group editor still saves its class');
insert into ids select 'legacy_slot', id from public.group_slots where name = 'Synthetic legacy class';
select is((select count(*) from public.classes where legacy_source = 'group_slot'
  and legacy_source_id = (select id from ids where key = 'legacy_slot')), 1::bigint,
  'legacy class is bridged to the calendar model');
select lives_ok($$insert into public.group_slot_memberships(clinic_id, group_slot_id, enrollment_id,
  patient_id, starts_at, weekdays)
  values(pg_temp.id(10), (select id from ids where key = 'legacy_slot'),
  (select id from ids where key = 'enrollment'), (select id from ids where key = 'patient'),
  current_date, array[1,2,3,4,5]::smallint[])$$,
  'a legacy patient link is accepted');
select is((select count(*) from public.class_memberships m
  join public.group_slot_memberships lm on m.legacy_source_id = lm.id
  where m.legacy_source = 'group_slot_membership'
    and lm.group_slot_id = (select id from ids where key = 'legacy_slot')),
  1::bigint, 'legacy patient link is bridged to canonical membership');
select lives_ok($$select public.ensure_calendar_window(pg_temp.id(20), current_date, current_date + 1)$$,
  'legacy class lesson is materialized');
select is((select count(*) from public.class_occurrences o
  join public.classes c on c.id = o.class_id
  where c.legacy_source_id = (select id from ids where key = 'legacy_slot')
    and o.local_date = current_date
    and (select count(*) from public.effective_occurrence_patient_ids(o.id)) = 1),
  1::bigint, 'legacy patient appears in the materialized lesson');

select set_config('request.jwt.claim.sub', pg_temp.id(6)::text, true);
select is((select count(*) from public.patients where clinic_id = pg_temp.id(10)), 0::bigint,
  'another clinic cannot read the patient');
select * from finish();
rollback;
