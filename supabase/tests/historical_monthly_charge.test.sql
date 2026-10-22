begin;
set local search_path = public, extensions;
select no_plan();
create function pg_temp.id(n integer) returns uuid language sql immutable as $$
  select ('ee000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid
$$;
alter table public.clinics alter constraint clinics_owner_profile_fk deferrable initially deferred;
insert into auth.users(id) values(pg_temp.id(1));
insert into public.clinics(id,name,owner_profile_id)
  values(pg_temp.id(10),'Synthetic historical billing clinic',pg_temp.id(1));
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
    'Synthetic August',14641,14641,'2026-08-11','paid','2026-08-11','2026-09-10'),
  (pg_temp.id(61),pg_temp.id(10),pg_temp.id(30),pg_temp.id(50),pg_temp.id(20),
    'Synthetic October',14641,14641,'2026-10-10','paid','2026-10-01','2026-10-31');
insert into public.payments(id,clinic_id,charge_id,amount_cents,method,paid_at,idempotency_key)
  values(pg_temp.id(70),pg_temp.id(10),pg_temp.id(61),14641,'pix','2026-10-13','synthetic-historical-charge');
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.id(1)::text,true);
select throws_ok($$select public.create_historical_monthly_charge(
  pg_temp.id(50),'2026-09-01','2026-09-01',14600,
  'Synthetic coverage must not overlap August',gen_random_uuid())$$,
  'P0001','HISTORICAL_COVERAGE_START_CONFLICT','overlap with August is blocked');
create temp table created_charge as select public.create_historical_monthly_charge(
  pg_temp.id(50),'2026-09-01','2026-09-11',14600,
  'Synthetic September correction only',gen_random_uuid()) as charge;
select is((select (charge).coverage_from from created_charge),date '2026-09-11',
  'September begins after August coverage');
select is((select (charge).coverage_to from created_charge),date '2026-09-30',
  'September ends before October coverage');
select is((select (charge).amount_cents from created_charge),14600,
  'September uses the reviewed price');
select is((select (charge).paid_cents from created_charge),0,
  'no payment is fabricated');
select is((select amount_cents from public.charges where id=pg_temp.id(61)),14641,
  'October charge amount is preserved');
select is((select amount_cents from public.payments where id=pg_temp.id(70)),14641,
  'October payment is preserved');
select throws_ok($$select public.create_historical_monthly_charge(
  pg_temp.id(50),'2026-09-01','2026-09-11',14600,
  'Synthetic duplicate September attempt',gen_random_uuid())$$,
  'P0001','CHARGE_ALREADY_EXISTS','second September charge is blocked');
reset role;
select is((select count(*)::integer from public.audit_events
  where action='charge.historical_created' and entity_id=(select (charge).id from created_charge)),1,
  'historical charge is audited');
select * from finish();
rollback;
