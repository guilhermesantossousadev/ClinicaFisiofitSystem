begin;
set local search_path = public, extensions;
select no_plan();
create function pg_temp.id(n integer) returns uuid language sql immutable as $$
  select ('ef000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid
$$;
alter table public.clinics alter constraint clinics_owner_profile_fk deferrable initially deferred;
insert into auth.users(id) values(pg_temp.id(1));
insert into public.clinics(id,name,owner_profile_id)
  values(pg_temp.id(10),'Synthetic coverage clinic',pg_temp.id(1));
insert into public.profiles(id,clinic_id,name,role,status)
  values(pg_temp.id(1),pg_temp.id(10),'Synthetic operator','admin','active');
set constraints clinics_owner_profile_fk immediate;
insert into public.units(id,clinic_id,name) values(pg_temp.id(20),pg_temp.id(10),'Synthetic unit');
insert into public.patients(id,clinic_id,primary_unit_id,name)
  values(pg_temp.id(30),pg_temp.id(10),pg_temp.id(20),'Synthetic patient');
insert into public.plans(id,clinic_id,name,kind,sessions_included,duration_days,price_cents)
  values(pg_temp.id(40),pg_temp.id(10),'Synthetic monthly','monthly',4,30,14600);
insert into public.enrollments(id,clinic_id,patient_id,plan_id,unit_id,starts_at,status)
  values(pg_temp.id(50),pg_temp.id(10),pg_temp.id(30),pg_temp.id(40),pg_temp.id(20),'2026-08-11','active');
insert into public.charges(id,clinic_id,patient_id,enrollment_id,unit_id,description,
  amount_cents,paid_cents,due_at,status,coverage_from,coverage_to)
  values
  (pg_temp.id(60),pg_temp.id(10),pg_temp.id(30),pg_temp.id(50),pg_temp.id(20),
    'Synthetic imported August',14641,14641,'2026-08-11','paid',null,null),
  (pg_temp.id(61),pg_temp.id(10),pg_temp.id(30),pg_temp.id(50),pg_temp.id(20),
    'Synthetic October',14641,14641,'2026-10-10','paid','2026-10-01','2026-10-31');
insert into public.payments(id,clinic_id,charge_id,amount_cents,method,paid_at,idempotency_key)
  values(pg_temp.id(70),pg_temp.id(10),pg_temp.id(60),14641,'pix','2026-08-11','synthetic-coverage');
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.id(1)::text,true);
select throws_ok($$select public.correct_legacy_charge_coverage(
  pg_temp.id(60),null,null,'2026-09-11','2026-10-10',
  'Synthetic overlapping coverage attempt',gen_random_uuid())$$,
  'P0001','CHARGE_ALREADY_EXISTS','overlap with October is blocked');
select lives_ok($$select public.correct_legacy_charge_coverage(
  pg_temp.id(60),null,null,'2026-08-11','2026-09-10',
  'Synthetic historical coverage confirmed',gen_random_uuid())$$,
  'missing imported coverage can be set');
select is((select coverage_from from public.charges where id=pg_temp.id(60)),
  date '2026-08-11','August starts on the confirmed date');
select is((select coverage_to from public.charges where id=pg_temp.id(60)),
  date '2026-09-10','August ends on the confirmed date');
select is((select amount_cents from public.charges where id=pg_temp.id(60)),
  14641,'August amount is unchanged');
select is((select amount_cents from public.payments where id=pg_temp.id(70)),
  14641,'payment is unchanged');
select throws_ok($$select public.correct_legacy_charge_coverage(
  pg_temp.id(60),null,null,'2026-08-11','2026-09-10',
  'Synthetic repeated correction attempt',gen_random_uuid())$$,
  'P0001','CHARGE_COVERAGE_CONFLICT','stale correction is rejected');
reset role;
select is((select count(*)::integer from public.audit_events
  where action='charge.coverage_corrected' and entity_id=pg_temp.id(60)),1,
  'coverage change is audited');
select * from finish();
rollback;
