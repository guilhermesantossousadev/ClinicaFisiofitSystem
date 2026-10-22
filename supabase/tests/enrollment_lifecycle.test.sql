begin;
set local timezone = 'America/Sao_Paulo';
set local search_path = public, extensions;
select no_plan();

create function pg_temp.id(n integer) returns uuid language sql immutable as $$
  select ('ec000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid
$$;
alter table public.clinics alter constraint clinics_owner_profile_fk deferrable initially deferred;
insert into auth.users(id) values(pg_temp.id(1));
insert into public.clinics(id,name,owner_profile_id)
  values(pg_temp.id(10),'Synthetic lifecycle clinic',pg_temp.id(1));
insert into public.profiles(id,clinic_id,name,role,status)
  values(pg_temp.id(1),pg_temp.id(10),'Synthetic operator','admin','active');
set constraints clinics_owner_profile_fk immediate;
insert into public.units(id,clinic_id,name) values(pg_temp.id(20),pg_temp.id(10),'Synthetic unit');
insert into public.patients(id,clinic_id,primary_unit_id,name)
  values(pg_temp.id(30),pg_temp.id(10),pg_temp.id(20),'Synthetic patient');
insert into public.plans(id,clinic_id,name,kind,sessions_included,duration_days,price_cents)
  values(pg_temp.id(40),pg_temp.id(10),'Synthetic monthly','monthly',8,30,22000);
insert into public.enrollments(id,clinic_id,patient_id,plan_id,unit_id,starts_at,status)
  select pg_temp.id(n),pg_temp.id(10),pg_temp.id(30),pg_temp.id(40),pg_temp.id(20),
    current_date-10,'active' from generate_series(50,54) n;
insert into public.charges(id,clinic_id,patient_id,enrollment_id,unit_id,description,
  amount_cents,paid_cents,due_at,status,coverage_from,coverage_to)
values
  (pg_temp.id(60),pg_temp.id(10),pg_temp.id(30),pg_temp.id(50),pg_temp.id(20),
    'Synthetic empty charge',22000,0,current_date,'pending',current_date-10,current_date+19),
  (pg_temp.id(61),pg_temp.id(10),pg_temp.id(30),pg_temp.id(51),pg_temp.id(20),
    'Synthetic paid charge',22000,100,current_date,'partial',current_date-10,current_date+19),
  (pg_temp.id(62),pg_temp.id(10),pg_temp.id(30),pg_temp.id(53),pg_temp.id(20),
    'Synthetic future charge',22000,0,current_date+10,'pending',current_date+10,current_date+39);
insert into public.appointments(id,clinic_id,unit_id,patient_id,enrollment_id,starts_at,ends_at,status)
  values
  (pg_temp.id(70),pg_temp.id(10),pg_temp.id(20),pg_temp.id(30),pg_temp.id(52),
    date_trunc('day',now()+interval '1 day')+interval '22 hour',
    date_trunc('day',now()+interval '1 day')+interval '23 hour','scheduled'),
  (pg_temp.id(71),pg_temp.id(10),pg_temp.id(20),pg_temp.id(30),pg_temp.id(53),
    date_trunc('day',now()+interval '2 day')+interval '22 hour',
    date_trunc('day',now()+interval '2 day')+interval '23 hour','scheduled');
create temp table lifecycle_ids(key text primary key,id uuid);
grant all on lifecycle_ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.id(1)::text,true);
insert into lifecycle_ids values('class',(public.create_class_with_schedule(
  pg_temp.id(20),'Synthetic attendance class',null,'active',current_date,
  array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']::public.class_weekday[],
  time '09:00',time '10:00','America/Sao_Paulo',null,7,null)->'class'->>'id')::uuid);
select public.save_operational_membership((select id from lifecycle_ids where key='class'),
  pg_temp.id(30),current_date,null,
  array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']::public.class_weekday[],
  pg_temp.id(54),null);
select public.ensure_calendar_window(pg_temp.id(20),current_date,current_date+1);
reset role;
insert into lifecycle_ids select 'occurrence',id from public.class_occurrences
  where class_id=(select id from lifecycle_ids where key='class') and local_date=current_date;
set local role authenticated;
select public.save_occurrence_attendance((select id from lifecycle_ids where key='occurrence'),
  pg_temp.id(30),'PRESENT');
select ok((public.inspect_enrollment_lifecycle(pg_temp.id(50))->>'can_undo')::boolean,
  'empty enrollment can be undone');
select ok(not (public.inspect_enrollment_lifecycle(pg_temp.id(51))->>'can_undo')::boolean,
  'paid charge blocks undo');
select ok(not (public.inspect_enrollment_lifecycle(pg_temp.id(52))->>'can_undo')::boolean,
  'linked appointment blocks undo');
select ok(not (public.inspect_enrollment_lifecycle(pg_temp.id(54))->>'can_undo')::boolean,
  'recorded class attendance blocks undo');
select lives_ok($$select public.rollback_enrollment(pg_temp.id(50),
  'Synthetic enrollment entered by mistake',gen_random_uuid())$$,
  'empty enrollment can be undone');
select ok((select deleted_at is not null from public.enrollments where id=pg_temp.id(50)),
  'undone enrollment is hidden by a tombstone');
select ok((select deleted_at is not null from public.charges where id=pg_temp.id(60)),
  'empty charge is hidden with the enrollment');
select throws_ok($$select public.rollback_enrollment(pg_temp.id(51),
  'Synthetic enrollment entered by mistake',gen_random_uuid())$$,
  'P0001','ENROLLMENT_HAS_HISTORY','payment history blocks undo');
select throws_ok($$select public.rollback_enrollment(pg_temp.id(52),
  'Synthetic enrollment entered by mistake',gen_random_uuid())$$,
  'P0001','ENROLLMENT_HAS_HISTORY','appointment history blocks undo');
select lives_ok($$select public.cancel_enrollment(pg_temp.id(53),
  (now() at time zone 'America/Sao_Paulo')::date,
  'Synthetic cancellation requested today',gen_random_uuid())$$,
  'valid enrollment can be cancelled today');
select is((select status::text from public.enrollments where id=pg_temp.id(53)),
  'cancelled','cancelled status is saved');
select is((select status::text from public.charges where id=pg_temp.id(62)),
  'cancelled','unpaid future charge is cancelled');
reset role;
select is((select status::text from public.appointments where id=pg_temp.id(71)),
  'cancelled','future appointment linked to the plan is cancelled');
select * from finish();
rollback;
