begin;
set local search_path = public, extensions;
select no_plan();
create function pg_temp.id(n integer) returns uuid language sql immutable as $$
  select ('ed000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid
$$;
alter table public.clinics alter constraint clinics_owner_profile_fk deferrable initially deferred;
insert into auth.users(id) values(pg_temp.id(1));
insert into public.clinics(id,name,owner_profile_id)
  values(pg_temp.id(10),'Synthetic date correction clinic',pg_temp.id(1));
insert into public.profiles(id,clinic_id,name,role,status)
  values(pg_temp.id(1),pg_temp.id(10),'Synthetic operator','admin','active');
set constraints clinics_owner_profile_fk immediate;
insert into public.units(id,clinic_id,name) values(pg_temp.id(20),pg_temp.id(10),'Synthetic unit');
insert into public.patients(id,clinic_id,primary_unit_id,name)
  values(pg_temp.id(30),pg_temp.id(10),pg_temp.id(20),'Synthetic patient');
insert into public.plans(id,clinic_id,name,kind,sessions_included,duration_days,price_cents)
  values(pg_temp.id(40),pg_temp.id(10),'Synthetic monthly','monthly',4,30,14641);
insert into public.enrollments(id,clinic_id,patient_id,plan_id,unit_id,starts_at,ends_at,status)
  values(pg_temp.id(50),pg_temp.id(10),pg_temp.id(30),pg_temp.id(40),pg_temp.id(20),'2026-08-10','2026-09-10','active');
insert into public.charges(id,clinic_id,patient_id,enrollment_id,unit_id,description,
  amount_cents,paid_cents,due_at,status,coverage_from,coverage_to)
  values
  (pg_temp.id(60),pg_temp.id(10),pg_temp.id(30),pg_temp.id(50),pg_temp.id(20),
    'Synthetic August charge',14641,14641,'2026-08-10','paid','2026-08-10','2026-09-09'),
  (pg_temp.id(61),pg_temp.id(10),pg_temp.id(30),pg_temp.id(50),pg_temp.id(20),
    'Synthetic October charge',14641,14641,'2026-10-10','paid','2026-10-01','2026-10-31');
insert into public.payments(id,clinic_id,charge_id,amount_cents,method,paid_at,idempotency_key)
  values(pg_temp.id(70),pg_temp.id(10),pg_temp.id(61),14641,'pix','2026-10-13','synthetic-date-correction');
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.id(1)::text,true);
select throws_ok($$select public.correct_monthly_enrollment_dates(
  pg_temp.id(50),'2026-08-10','2026-09-10','2026-08-11','2026-09-10',
  'Synthetic correction keeps paid October coverage',gen_random_uuid())$$,
  'P0001','ENROLLMENT_END_CHARGE_CONFLICT','cannot end enrollment before a paid charge');
select lives_ok($$select public.correct_monthly_enrollment_dates(
  pg_temp.id(50),'2026-08-10','2026-09-10','2026-08-11',null,
  'Synthetic correction keeps paid October coverage',gen_random_uuid())$$,
  'start and end can be corrected while preserving paid months');
select is((select starts_at from public.enrollments where id=pg_temp.id(50)),
  date '2026-08-11','corrected enrollment start persists');
select is((select ends_at from public.enrollments where id=pg_temp.id(50)),
  null::date,'stale enrollment end is cleared');
select is((select coverage_from from public.charges where id=pg_temp.id(60)),
  date '2026-08-11','original charge coverage begins on corrected date');
select is((select amount_cents from public.charges where id=pg_temp.id(61)),
  14641,'October charge amount is unchanged');
select is((select amount_cents from public.payments where id=pg_temp.id(70)),
  14641,'October payment is unchanged');
reset role;
select is((select count(*)::integer from public.audit_events where entity_id=pg_temp.id(50)
  and action='enrollment.dates_corrected'),1,'correction is audited');
set local role authenticated;
select throws_ok($$select public.correct_monthly_enrollment_dates(
  pg_temp.id(50),'2026-08-10','2026-09-10','2026-08-12',null,
  'Synthetic stale browser request',gen_random_uuid())$$,
  'P0001','ENROLLMENT_DATES_CONFLICT','stale correction is rejected');
select * from finish();
rollback;
