begin;
select plan(30);

insert into auth.users(id) values
 ('f9100000-0000-4000-8000-000000000001'),
 ('f9100000-0000-4000-8000-000000000002'),
 ('f9100000-0000-4000-8000-000000000003'),
 ('f9100000-0000-4000-8000-000000000004'),
 ('f9100000-0000-4000-8000-000000000005');
alter table public.clinics alter column owner_profile_id drop not null;
insert into public.clinics(id,name,owner_profile_id) values
 ('f9100000-0000-4000-8000-000000000010','Synthetic finance read clinic one',null),
 ('f9100000-0000-4000-8000-000000000011','Synthetic finance read clinic two',null);
insert into public.profiles(id,clinic_id,name,role,status) values
 ('f9100000-0000-4000-8000-000000000001','f9100000-0000-4000-8000-000000000010','Synthetic allowed finance','finance','active'),
 ('f9100000-0000-4000-8000-000000000002','f9100000-0000-4000-8000-000000000010','Synthetic denied finance','finance','active'),
 ('f9100000-0000-4000-8000-000000000003','f9100000-0000-4000-8000-000000000010','Synthetic other unit finance','finance','active'),
 ('f9100000-0000-4000-8000-000000000004','f9100000-0000-4000-8000-000000000011','Synthetic foreign finance','finance','active'),
 ('f9100000-0000-4000-8000-000000000005','f9100000-0000-4000-8000-000000000010','Synthetic reception','reception','active');
update public.clinics set owner_profile_id = case id
  when 'f9100000-0000-4000-8000-000000000010' then 'f9100000-0000-4000-8000-000000000001'::uuid
  else 'f9100000-0000-4000-8000-000000000004'::uuid end;
alter table public.clinics alter column owner_profile_id set not null;
insert into public.units(id,clinic_id,name) values
 ('f9100000-0000-4000-8000-000000000020','f9100000-0000-4000-8000-000000000010','Synthetic read unit one'),
 ('f9100000-0000-4000-8000-000000000021','f9100000-0000-4000-8000-000000000010','Synthetic read unit two'),
 ('f9100000-0000-4000-8000-000000000022','f9100000-0000-4000-8000-000000000011','Synthetic read foreign unit');
insert into public.profile_units(profile_id,unit_id) values
 ('f9100000-0000-4000-8000-000000000001','f9100000-0000-4000-8000-000000000020'),
 ('f9100000-0000-4000-8000-000000000002','f9100000-0000-4000-8000-000000000020'),
 ('f9100000-0000-4000-8000-000000000003','f9100000-0000-4000-8000-000000000021'),
 ('f9100000-0000-4000-8000-000000000004','f9100000-0000-4000-8000-000000000022'),
 ('f9100000-0000-4000-8000-000000000005','f9100000-0000-4000-8000-000000000020');
insert into public.profile_permissions(profile_id,module,can_view,can_edit) values
 ('f9100000-0000-4000-8000-000000000001','enrollments',true,false),
 ('f9100000-0000-4000-8000-000000000002','enrollments',false,false),
 ('f9100000-0000-4000-8000-000000000003','enrollments',true,false),
 ('f9100000-0000-4000-8000-000000000004','enrollments',true,false);
insert into public.patients(id,clinic_id,primary_unit_id,name,phone,birth_date,notes) values
 ('f9100000-0000-4000-8000-000000000030','f9100000-0000-4000-8000-000000000010','f9100000-0000-4000-8000-000000000020','Synthetic patient one','555-0100','2000-01-01','synthetic clinical note'),
 ('f9100000-0000-4000-8000-000000000031','f9100000-0000-4000-8000-000000000010','f9100000-0000-4000-8000-000000000021','Synthetic patient other unit','555-0101','2000-01-02','synthetic clinical note'),
 ('f9100000-0000-4000-8000-000000000032','f9100000-0000-4000-8000-000000000011','f9100000-0000-4000-8000-000000000022','Synthetic foreign patient','555-0102','2000-01-03','synthetic clinical note');
insert into public.plans(id,clinic_id,name,kind,sessions_included,duration_days,price_cents) values
 ('f9100000-0000-4000-8000-000000000040','f9100000-0000-4000-8000-000000000010','Synthetic clinic plan','monthly',8,30,4600),
 ('f9100000-0000-4000-8000-000000000041','f9100000-0000-4000-8000-000000000011','Synthetic foreign plan','monthly',8,30,4600);
insert into public.enrollments(id,clinic_id,patient_id,plan_id,unit_id,starts_at,due_day)
values
 ('f9100000-0000-4000-8000-000000000050','f9100000-0000-4000-8000-000000000010','f9100000-0000-4000-8000-000000000030','f9100000-0000-4000-8000-000000000040','f9100000-0000-4000-8000-000000000020','2026-10-01',5),
 ('f9100000-0000-4000-8000-000000000051','f9100000-0000-4000-8000-000000000010','f9100000-0000-4000-8000-000000000031','f9100000-0000-4000-8000-000000000040','f9100000-0000-4000-8000-000000000021','2026-10-01',5),
 ('f9100000-0000-4000-8000-000000000052','f9100000-0000-4000-8000-000000000011','f9100000-0000-4000-8000-000000000032','f9100000-0000-4000-8000-000000000041','f9100000-0000-4000-8000-000000000022','2026-10-01',5);

select ok(has_table_privilege('authenticated','public.enrollments','SELECT'),'authenticated can select enrollments under RLS');
select ok(has_table_privilege('authenticated','public.patients','SELECT'),'existing authenticated patient routes retain table SELECT');
select ok(not exists (select 1 from pg_policies where schemaname='public' and tablename='patients' and policyname='patients_financial_enrollment_summary_select'),'finance has no direct patient-summary RLS policy');
select ok(has_function_privilege('authenticated','public.financial_enrollment_patient_summaries(uuid[])','EXECUTE'),'authenticated can call the scoped financial summary RPC');
select ok(has_table_privilege('authenticated','public.plans','SELECT'),'authenticated can query plans subject to RLS');
select ok(has_column_privilege('authenticated','public.units','id','SELECT') and has_column_privilege('authenticated','public.units','clinic_id','SELECT') and has_column_privilege('authenticated','public.units','deleted_at','SELECT'),'unit-scope validation columns are granted');

select set_config('request.jwt.claim.sub','f9100000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is((select count(*)::integer from public.enrollments),1,'finance with enrollments.view sees assigned-unit enrollments');
select is((select count(*)::integer from public.patients where id='f9100000-0000-4000-8000-000000000030'),0,'finance cannot query patients directly');
select is((select count(*)::integer from public.financial_enrollment_patient_summaries(array['f9100000-0000-4000-8000-000000000030']::uuid[])),1,'finance RPC returns one same-unit enrollment-linked summary');
select is((select name from public.financial_enrollment_patient_summaries(array['f9100000-0000-4000-8000-000000000030']::uuid[])),'Synthetic patient one','finance RPC exposes only the patient name');
select is((select count(*)::integer from public.plans),1,'finance reads same-clinic plans');
select is((select count(*)::integer from public.units),1,'finance sees only assigned unit metadata');
select is((select count(birth_date)::integer from public.patients where id='f9100000-0000-4000-8000-000000000030'),0,'finance cannot read patient clinical/demographic fields directly');
reset role;

select set_config('request.jwt.claim.sub','f9100000-0000-4000-8000-000000000002',true);
set local role authenticated;
select is((select count(*)::integer from public.enrollments),0,'finance without enrollments.view cannot read enrollments');
select is((select count(*)::integer from public.plans),0,'finance without enrollments.view cannot read plans');
select is((select count(*)::integer from public.patients),0,'finance without enrollments.view cannot read patients directly');
select is((select count(*)::integer from public.financial_enrollment_patient_summaries(array['f9100000-0000-4000-8000-000000000030']::uuid[])),0,'finance without enrollments.view cannot call patient summary RPC');
reset role;

select set_config('request.jwt.claim.sub','f9100000-0000-4000-8000-000000000003',true);
set local role authenticated;
select is((select count(*)::integer from public.enrollments),1,'finance sees only enrollment assigned to its unit');
select is((select count(*)::integer from public.patients),0,'finance cannot query patients in another unit directly');
select is((select count(*)::integer from public.financial_enrollment_patient_summaries(array['f9100000-0000-4000-8000-000000000031']::uuid[])),1,'finance RPC returns only its assigned-unit patient summary');
select is((select count(*)::integer from public.financial_enrollment_patient_summaries(array['f9100000-0000-4000-8000-000000000030']::uuid[])),0,'finance RPC denies a patient in another unit');
select is((select count(*)::integer from public.units),1,'finance sees only its assigned unit');
reset role;

select set_config('request.jwt.claim.sub','f9100000-0000-4000-8000-000000000004',true);
set local role authenticated;
select is((select count(*)::integer from public.enrollments),1,'foreign clinic sees its own enrollment only');
select is((select count(*)::integer from public.patients),0,'finance cannot query foreign-clinic patients directly');
select is((select count(*)::integer from public.financial_enrollment_patient_summaries(array['f9100000-0000-4000-8000-000000000032']::uuid[])),1,'finance RPC returns only its own clinic patient summary');
select is((select count(*)::integer from public.financial_enrollment_patient_summaries(array['f9100000-0000-4000-8000-000000000030']::uuid[])),0,'finance RPC denies a patient in another clinic');
select is((select count(*)::integer from public.plans),1,'foreign clinic sees its own plan only');
select is((select count(*)::integer from public.units),1,'foreign clinic sees only its own assigned unit');
reset role;

select set_config('request.jwt.claim.sub','f9100000-0000-4000-8000-000000000005',true);
set local role authenticated;
select is((select count(*)::integer from public.patients where id='f9100000-0000-4000-8000-000000000030'),1,'reception retains its existing patient row access');
select is((select birth_date from public.patients where id='f9100000-0000-4000-8000-000000000030'),'2000-01-01'::date,'reception retains its existing permitted patient columns');
reset role;

select * from finish();
rollback;
