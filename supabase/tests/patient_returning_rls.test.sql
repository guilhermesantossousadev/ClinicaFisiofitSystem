begin;
-- Keep fixture dates in the same timezone as the occurrences and attendance guard.
set local timezone='America/Sao_Paulo';
set local search_path=public,extensions;
select no_plan();
create function pg_temp.id(n integer) returns uuid language sql immutable as $$ select ('fb230000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid $$;
alter table public.clinics alter constraint clinics_owner_profile_fk deferrable initially deferred;
insert into auth.users(id) select pg_temp.id(n) from generate_series(1,8) n;
insert into public.clinics(id,name,owner_profile_id,makeup_policy) values
 (pg_temp.id(10),'Synthetic stabilization one',pg_temp.id(1),'{"eligible_statuses":["ABSENT_JUSTIFIED"],"no_show_action":"return"}'),
 (pg_temp.id(11),'Synthetic stabilization two',pg_temp.id(8),null);
insert into public.profiles(id,clinic_id,name,role,status) select pg_temp.id(n),case when n=8 then pg_temp.id(11) else pg_temp.id(10) end,'Synthetic role '||n,(array['admin','manager','reception','professional','professional','finance','reception','admin']::public.user_role[])[n],'active' from generate_series(1,8) n;
set constraints clinics_owner_profile_fk immediate;
insert into public.units(id,clinic_id,name) values(pg_temp.id(20),pg_temp.id(10),'Synthetic A'),(pg_temp.id(21),pg_temp.id(10),'Synthetic B'),(pg_temp.id(22),pg_temp.id(11),'Synthetic foreign');
insert into public.profile_units(profile_id,unit_id) values(pg_temp.id(2),pg_temp.id(20)),(pg_temp.id(2),pg_temp.id(21)),(pg_temp.id(3),pg_temp.id(20)),(pg_temp.id(3),pg_temp.id(21)),(pg_temp.id(4),pg_temp.id(20)),(pg_temp.id(5),pg_temp.id(21)),(pg_temp.id(6),pg_temp.id(20)),(pg_temp.id(7),pg_temp.id(20));
insert into public.profile_permissions(profile_id,module,can_view,can_edit)
 select pg_temp.id(n),m,true,true from generate_series(2,6) n cross join unnest(array['agenda','patients','records','finance','enrollments','settings']) m where (n=2 or (n=3 and m in('agenda','patients','enrollments')) or (n in(4,5) and m in('agenda','patients','records')) or (n=6 and m in('finance','enrollments')));
insert into public.professionals(id,clinic_id,profile_id,name) values(pg_temp.id(40),pg_temp.id(10),pg_temp.id(4),'Synthetic primary'),(pg_temp.id(41),pg_temp.id(10),pg_temp.id(5),'Synthetic substitute'),(pg_temp.id(42),pg_temp.id(10),null,'Synthetic parallel');
insert into public.professional_units(professional_id,unit_id) values(pg_temp.id(40),pg_temp.id(20)),(pg_temp.id(41),pg_temp.id(21)),(pg_temp.id(42),pg_temp.id(20));
insert into public.patients(id,clinic_id,primary_unit_id,name) values(pg_temp.id(30),pg_temp.id(10),pg_temp.id(20),'Synthetic patient A'),(pg_temp.id(31),pg_temp.id(10),pg_temp.id(21),'Synthetic patient B'),(pg_temp.id(32),pg_temp.id(10),pg_temp.id(20),'Synthetic patient C');
insert into public.patients(id,clinic_id,primary_unit_id,name) select pg_temp.id(100+n),pg_temp.id(10),pg_temp.id(20),'Synthetic search '||lpad(n::text,3,'0') from generate_series(1,110) n;

-- This file is rollback-only and must run on a disposable synthetic database.
create temp table access_before(profile integer primary key, ids uuid[]);
grant all on access_before to authenticated;
create temp table policy_before as select policyname,cmd,permissive,roles,qual,with_check from pg_policies where schemaname='public' and tablename='patients' and policyname<>'patients_module_select';
create temp table function_before as select pg_get_functiondef('public.can_access_patient(uuid)'::regprocedure) definition;
-- Restore the old policy inside this test transaction to prove the regression.
alter policy patients_module_select on public.patients using(public.can_access_patient(id));
select set_config('request.jwt.claim.sub',pg_temp.id(3)::text,true);set local role authenticated;
select lives_ok($$insert into public.patients(id,clinic_id,primary_unit_id,name)values(pg_temp.id(60),pg_temp.id(10),pg_temp.id(20),'Synthetic plain insert')$$,'original policy permits INSERT without RETURNING');
select is((select count(*)from public.patients where id=pg_temp.id(60)),1::bigint,'original policy reads patient after insertion');
select throws_ok($$insert into public.patients(id,clinic_id,primary_unit_id,name)values(pg_temp.id(61),pg_temp.id(10),pg_temp.id(20),'Synthetic failed returning')returning id$$,'42501','new row violates row-level security policy "patients_module_select" for table "patients"','original RETURNING failure is the SELECT policy, not INSERT WITH CHECK');
select is((select count(*)from public.patients where id=pg_temp.id(61)),0::bigint,'failed original statement leaves no patient');
reset role;
select is((select count(*)from public.audit_events where entity_id=pg_temp.id(61)),0::bigint,'failed original statement leaves no audit side effect');
-- Persisted-row access must be identical before and after, for every fixture role.
select set_config('request.jwt.claim.sub',pg_temp.id(1)::text,true);set local role authenticated;insert into access_before select 1,coalesce(array_agg(id order by id),'{}'::uuid[])from public.patients;reset role;
select set_config('request.jwt.claim.sub',pg_temp.id(2)::text,true);set local role authenticated;insert into access_before select 2,coalesce(array_agg(id order by id),'{}'::uuid[])from public.patients;reset role;
select set_config('request.jwt.claim.sub',pg_temp.id(3)::text,true);set local role authenticated;insert into access_before select 3,coalesce(array_agg(id order by id),'{}'::uuid[])from public.patients;reset role;
select set_config('request.jwt.claim.sub',pg_temp.id(4)::text,true);set local role authenticated;insert into access_before select 4,coalesce(array_agg(id order by id),'{}'::uuid[])from public.patients;reset role;
select set_config('request.jwt.claim.sub',pg_temp.id(5)::text,true);set local role authenticated;insert into access_before select 5,coalesce(array_agg(id order by id),'{}'::uuid[])from public.patients;reset role;
select set_config('request.jwt.claim.sub',pg_temp.id(6)::text,true);set local role authenticated;insert into access_before select 6,coalesce(array_agg(id order by id),'{}'::uuid[])from public.patients;reset role;
select set_config('request.jwt.claim.sub',pg_temp.id(7)::text,true);set local role authenticated;insert into access_before select 7,coalesce(array_agg(id order by id),'{}'::uuid[])from public.patients;reset role;
select set_config('request.jwt.claim.sub',pg_temp.id(8)::text,true);set local role authenticated;insert into access_before select 8,coalesce(array_agg(id order by id),'{}'::uuid[])from public.patients;reset role;
-- INSERT ... RETURNING checks SELECT policies against the proposed tuple before
-- inserting it. can_access_patient(id) queries patients, so it cannot find that
-- tuple yet (changing function volatility does not solve this).
-- Evaluate the existing administrative primary-unit access rule on the tuple.
-- Keep can_access_patient for existing relationship-based/professional access.
-- No INSERT/UPDATE checks, grants, helper functions or RLS settings are changed.
alter policy patients_module_select on public.patients
using (
  public.can_access_patient(id)
  or (
    clinic_id = public.current_clinic_id()
    and deleted_at is null
    and public.has_module_permission('patients', false)
    and public.has_role(array['admin', 'manager', 'reception']::public.user_role[])
    and public.has_unit_access(primary_unit_id)
  )
);

select set_config('request.jwt.claim.sub',pg_temp.id(1)::text,true);set local role authenticated;select is((select coalesce(array_agg(id order by id),'{}'::uuid[])from public.patients),(select ids from access_before where profile=1),'existing patient visibility unchanged for profile 1');reset role;
select set_config('request.jwt.claim.sub',pg_temp.id(2)::text,true);set local role authenticated;select is((select coalesce(array_agg(id order by id),'{}'::uuid[])from public.patients),(select ids from access_before where profile=2),'existing patient visibility unchanged for profile 2');reset role;
select set_config('request.jwt.claim.sub',pg_temp.id(3)::text,true);set local role authenticated;select is((select coalesce(array_agg(id order by id),'{}'::uuid[])from public.patients),(select ids from access_before where profile=3),'existing patient visibility unchanged for profile 3');reset role;
select set_config('request.jwt.claim.sub',pg_temp.id(4)::text,true);set local role authenticated;select is((select coalesce(array_agg(id order by id),'{}'::uuid[])from public.patients),(select ids from access_before where profile=4),'existing patient visibility unchanged for profile 4');reset role;
select set_config('request.jwt.claim.sub',pg_temp.id(5)::text,true);set local role authenticated;select is((select coalesce(array_agg(id order by id),'{}'::uuid[])from public.patients),(select ids from access_before where profile=5),'existing patient visibility unchanged for profile 5');reset role;
select set_config('request.jwt.claim.sub',pg_temp.id(6)::text,true);set local role authenticated;select is((select coalesce(array_agg(id order by id),'{}'::uuid[])from public.patients),(select ids from access_before where profile=6),'existing patient visibility unchanged for profile 6');reset role;
select set_config('request.jwt.claim.sub',pg_temp.id(7)::text,true);set local role authenticated;select is((select coalesce(array_agg(id order by id),'{}'::uuid[])from public.patients),(select ids from access_before where profile=7),'existing patient visibility unchanged for profile 7');reset role;
select set_config('request.jwt.claim.sub',pg_temp.id(8)::text,true);set local role authenticated;select is((select coalesce(array_agg(id order by id),'{}'::uuid[])from public.patients),(select ids from access_before where profile=8),'existing patient visibility unchanged for profile 8');reset role;

select is((select pg_get_functiondef('public.can_access_patient(uuid)'::regprocedure)),(select definition from function_before),'existing SECURITY DEFINER function and volatility unchanged');
select results_eq($$select policyname,cmd,permissive,roles,qual,with_check from pg_policies where schemaname='public'and tablename='patients'and policyname<>'patients_module_select' order by policyname$$,$$select *from policy_before order by policyname$$,'all other patient policies unchanged');
select is((select polpermissive from pg_policy where polrelid='public.patients'::regclass and polname='patients_module_select'),false,'SELECT policy remains restrictive');
select is((select relrowsecurity from pg_class where oid='public.patients'::regclass),true,'RLS remains enabled');
select set_config('request.jwt.claim.sub',pg_temp.id(1)::text,true);set local role authenticated;
select lives_ok($$insert into public.patients(id,clinic_id,primary_unit_id,name)values(pg_temp.id(62),pg_temp.id(10),pg_temp.id(20),'Synthetic admin created')returning *$$,'admin creates and receives patient');
select set_config('request.jwt.claim.sub',pg_temp.id(2)::text,true);
select lives_ok($$insert into public.patients(id,clinic_id,primary_unit_id,name)values(pg_temp.id(63),pg_temp.id(10),pg_temp.id(20),'Synthetic manager created')returning *$$,'manager creates and receives patient');
select set_config('request.jwt.claim.sub',pg_temp.id(3)::text,true);
select lives_ok($$insert into public.patients(id,clinic_id,primary_unit_id,name)values(pg_temp.id(64),pg_temp.id(10),pg_temp.id(20),'Synthetic reception created')returning *$$,'reception creates and receives patient');
select is((select name from public.patients where id=pg_temp.id(64)),'Synthetic reception created','created patient readable by authorized reception');
select lives_ok($$update public.patients set phone='11999990000' where id=pg_temp.id(64)returning *$$,'authorized update returns patient');
select is((select phone from public.patients where id=pg_temp.id(64)),'11999990000','update persists requested data');
select throws_ok($$insert into public.patients(id,clinic_id,primary_unit_id,name)values(pg_temp.id(65),pg_temp.id(11),pg_temp.id(22),'Synthetic forbidden foreign')returning *$$,'42501',null,'reception cannot insert into another organization');
select throws_ok($$insert into public.patients(id,clinic_id,primary_unit_id,name)values(pg_temp.id(65),pg_temp.id(10),pg_temp.id(20),'Synthetic batch allowed'),(pg_temp.id(66),pg_temp.id(11),pg_temp.id(22),'Synthetic batch forbidden')returning *$$,'42501',null,'mixed authorized/unauthorized batch fails atomically');
reset role;
select is((select count(*)from public.patients where id in(pg_temp.id(65),pg_temp.id(66))),0::bigint,'failed batch has no partial rows');
select is((select count(*)from public.audit_events where entity_id in(pg_temp.id(65),pg_temp.id(66))),0::bigint,'failed batch leaves no audit side effects');
-- Narrow reception to unit A: a primary unit B patient must remain hidden.
delete from public.profile_units where profile_id=pg_temp.id(3)and unit_id=pg_temp.id(21);
select set_config('request.jwt.claim.sub',pg_temp.id(3)::text,true);set local role authenticated;
select is((select count(*)from public.patients where primary_unit_id=pg_temp.id(21)),0::bigint,'reception cannot read another unit without a relationship');
select throws_ok($$insert into public.patients(id,clinic_id,primary_unit_id,name)values(pg_temp.id(65),pg_temp.id(10),pg_temp.id(21),'Synthetic forbidden unit')returning *$$,'42501',null,'reception cannot create in another unit');
select throws_ok($$update public.patients set primary_unit_id=pg_temp.id(21)where id=pg_temp.id(64)returning *$$,'42501',null,'UPDATE WITH CHECK still prevents unauthorized unit transfer');
select is((select primary_unit_id from public.patients where id=pg_temp.id(64)),pg_temp.id(20),'failed transfer preserves original unit');
select set_config('request.jwt.claim.sub',pg_temp.id(7)::text,true);
select is((select count(*)from public.patients),0::bigint,'user without patient permission sees no patients');
select throws_ok($$insert into public.patients(id,clinic_id,primary_unit_id,name)values(pg_temp.id(65),pg_temp.id(10),pg_temp.id(20),'Synthetic denied')returning *$$,'42501',null,'user without permission cannot create');
select set_config('request.jwt.claim.sub',pg_temp.id(4)::text,true);
select is((select count(*)from public.patients where id=pg_temp.id(64)),0::bigint,'professional cannot read newly created unassigned patient');
select throws_ok($$insert into public.patients(id,clinic_id,primary_unit_id,name)values(pg_temp.id(65),pg_temp.id(10),pg_temp.id(20),'Synthetic professional denied')returning *$$,'42501',null,'professional cannot create despite module edit permission');
select set_config('request.jwt.claim.sub',pg_temp.id(5)::text,true);
select is((select count(*)from public.patients where id=pg_temp.id(64)),0::bigint,'professional in another unit cannot read created patient');
select set_config('request.jwt.claim.sub',pg_temp.id(6)::text,true);
select is((select count(*)from public.patients),0::bigint,'finance gains no patient-table visibility');
select set_config('request.jwt.claim.sub',pg_temp.id(8)::text,true);
select is((select count(*)from public.patients where clinic_id=pg_temp.id(10)),0::bigint,'foreign organization admin gains no access');
reset role;
-- A created patient becomes visible to professionals only through a legitimate
-- assignment; class/roster rules and the original helper are not changed.
select set_config('request.jwt.claim.sub',pg_temp.id(1)::text,true);set local role authenticated;
select public.create_class_with_schedule(pg_temp.id(20),'Synthetic patient access class',null,'active',current_date,array['monday']::public.class_weekday[],'06:00','07:00','America/Sao_Paulo',pg_temp.id(40),1,null);
select public.save_operational_membership((select id from public.classes where name='Synthetic patient access class'),pg_temp.id(64),current_date,null,array['monday']::public.class_weekday[]);
select set_config('request.jwt.claim.sub',pg_temp.id(4)::text,true);
select is((select count(*)from public.patients where id=pg_temp.id(64)),1::bigint,'assigned professional retains legitimate membership-based visibility');
select set_config('request.jwt.claim.sub',pg_temp.id(5)::text,true);
select is((select count(*)from public.patients where id=pg_temp.id(64)),0::bigint,'unassigned professional remains excluded after membership');
reset role;
update public.patients set deleted_at=now()where id=pg_temp.id(62);
select set_config('request.jwt.claim.sub',pg_temp.id(1)::text,true);set local role authenticated;
select is((select count(*)from public.patients where id=pg_temp.id(62)),0::bigint,'soft-deleted patient remains hidden from admin');
reset role;
-- Rollback restores the exact previous expression and defect; no data deletion.
alter policy patients_module_select on public.patients using(public.can_access_patient(id));
select set_config('request.jwt.claim.sub',pg_temp.id(3)::text,true);set local role authenticated;
select throws_ok($$insert into public.patients(id,clinic_id,primary_unit_id,name)values(pg_temp.id(67),pg_temp.id(10),pg_temp.id(20),'Synthetic rollback reproduction')returning *$$,'42501','new row violates row-level security policy "patients_module_select" for table "patients"','rollback restores original behavior');
select is((select name from public.patients where id=pg_temp.id(64)),'Synthetic reception created','rollback does not remove previously created patient');
select *from finish();
rollback;
