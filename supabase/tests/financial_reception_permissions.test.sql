begin;
select plan(30);

insert into auth.users(id) values
 ('fa100000-0000-4000-8000-000000000001'),
 ('fa100000-0000-4000-8000-000000000002'),
 ('fa100000-0000-4000-8000-000000000003'),
 ('fa100000-0000-4000-8000-000000000004'),
 ('fa100000-0000-4000-8000-000000000005'),
 ('fa100000-0000-4000-8000-000000000006');
alter table public.clinics alter column owner_profile_id drop not null;
insert into public.clinics(id,name,owner_profile_id) values
 ('fa100000-0000-4000-8000-000000000010','Synthetic reception clinic',null),
 ('fa100000-0000-4000-8000-000000000011','Synthetic foreign clinic',null);
insert into public.profiles(id,clinic_id,name,role,status) values
 ('fa100000-0000-4000-8000-000000000001','fa100000-0000-4000-8000-000000000010','Synthetic receptionist','reception','active'),
 ('fa100000-0000-4000-8000-000000000002','fa100000-0000-4000-8000-000000000010','Synthetic unprivileged reception','reception','active'),
 ('fa100000-0000-4000-8000-000000000003','fa100000-0000-4000-8000-000000000010','Synthetic finance viewer','finance','active'),
 ('fa100000-0000-4000-8000-000000000004','fa100000-0000-4000-8000-000000000010','Synthetic other-unit receptionist','reception','active'),
 ('fa100000-0000-4000-8000-000000000005','fa100000-0000-4000-8000-000000000011','Synthetic foreign receptionist','reception','active'),
 ('fa100000-0000-4000-8000-000000000006','fa100000-0000-4000-8000-000000000010','Synthetic finance editor','finance','active');
update public.clinics set owner_profile_id=case id when 'fa100000-0000-4000-8000-000000000010' then 'fa100000-0000-4000-8000-000000000001'::uuid else 'fa100000-0000-4000-8000-000000000005'::uuid end;
alter table public.clinics alter column owner_profile_id set not null;
insert into public.units(id,clinic_id,name) values
 ('fa100000-0000-4000-8000-000000000020','fa100000-0000-4000-8000-000000000010','Synthetic reception unit'),
 ('fa100000-0000-4000-8000-000000000021','fa100000-0000-4000-8000-000000000010','Synthetic other unit'),
 ('fa100000-0000-4000-8000-000000000022','fa100000-0000-4000-8000-000000000011','Synthetic foreign unit');
insert into public.profile_units(profile_id,unit_id) values
 ('fa100000-0000-4000-8000-000000000001','fa100000-0000-4000-8000-000000000020'),
 ('fa100000-0000-4000-8000-000000000002','fa100000-0000-4000-8000-000000000020'),
 ('fa100000-0000-4000-8000-000000000003','fa100000-0000-4000-8000-000000000020'),
 ('fa100000-0000-4000-8000-000000000004','fa100000-0000-4000-8000-000000000021'),
 ('fa100000-0000-4000-8000-000000000005','fa100000-0000-4000-8000-000000000022'),
 ('fa100000-0000-4000-8000-000000000006','fa100000-0000-4000-8000-000000000020');
insert into public.profile_permissions(profile_id,module,can_view,can_edit) values
 ('fa100000-0000-4000-8000-000000000001','enrollments',true,true),
 ('fa100000-0000-4000-8000-000000000003','finance',true,false),
 ('fa100000-0000-4000-8000-000000000003','enrollments',true,false),
 ('fa100000-0000-4000-8000-000000000004','enrollments',true,true),
 ('fa100000-0000-4000-8000-000000000005','enrollments',true,true),
 ('fa100000-0000-4000-8000-000000000006','enrollments',true,false),
 ('fa100000-0000-4000-8000-000000000006','finance',true,true);
insert into public.patients(id,clinic_id,primary_unit_id,name) values
 ('fa100000-0000-4000-8000-000000000030','fa100000-0000-4000-8000-000000000010','fa100000-0000-4000-8000-000000000020','Synthetic finance patient');
insert into public.plans(id,clinic_id,name,kind,sessions_included,duration_days,price_cents) values
 ('fa100000-0000-4000-8000-000000000040','fa100000-0000-4000-8000-000000000010','Synthetic monthly plan','monthly',8,30,4600);
insert into public.enrollments(id,clinic_id,patient_id,plan_id,unit_id,starts_at,due_day,status) values
 ('fa100000-0000-4000-8000-000000000050','fa100000-0000-4000-8000-000000000010','fa100000-0000-4000-8000-000000000030','fa100000-0000-4000-8000-000000000040','fa100000-0000-4000-8000-000000000020','2026-10-01',5,'active');
insert into public.enrollments(id,clinic_id,patient_id,plan_id,unit_id,starts_at,ends_at,due_day,status,contract_amount_cents,contract_effective_from) values
 ('fa100000-0000-4000-8000-000000000051','fa100000-0000-4000-8000-000000000010','fa100000-0000-4000-8000-000000000030','fa100000-0000-4000-8000-000000000040','fa100000-0000-4000-8000-000000000020','2026-08-01','2026-09-30',5,'expired',4600,'2026-08-01');
insert into public.charges(id,clinic_id,patient_id,enrollment_id,unit_id,description,amount_cents,paid_cents,due_at,coverage_from,coverage_to,status) values
 ('fa100000-0000-4000-8000-000000000060','fa100000-0000-4000-8000-000000000010','fa100000-0000-4000-8000-000000000030','fa100000-0000-4000-8000-000000000050','fa100000-0000-4000-8000-000000000020','Synthetic open charge',4600,0,'2026-10-05','2026-10-01','2026-10-31','pending'),
 ('fa100000-0000-4000-8000-000000000061','fa100000-0000-4000-8000-000000000010','fa100000-0000-4000-8000-000000000030','fa100000-0000-4000-8000-000000000050','fa100000-0000-4000-8000-000000000020','Synthetic partial charge',4600,1000,'2026-09-05','2026-09-01','2026-09-30','partial');
insert into public.payments(id,clinic_id,charge_id,amount_cents,method,paid_at,idempotency_key) values
 ('fa100000-0000-4000-8000-000000000070','fa100000-0000-4000-8000-000000000010','fa100000-0000-4000-8000-000000000061',1000,'pix','2026-09-05T12:00:00Z','secfin001-partial-fixture');

select ok(not has_table_privilege('authenticated','public.charges','INSERT') and not has_table_privilege('authenticated','public.charges','UPDATE') and not has_table_privilege('authenticated','public.charges','DELETE'),'authenticated has no direct charge DML');
select ok(not has_table_privilege('authenticated','public.enrollments','INSERT') and not has_table_privilege('authenticated','public.enrollments','UPDATE') and not has_table_privilege('authenticated','public.enrollments','DELETE'),'authenticated has no direct enrollment DML');
select ok(not has_table_privilege('authenticated','public.plans','INSERT') and not has_table_privilege('authenticated','public.plans','UPDATE') and not has_table_privilege('authenticated','public.plans','DELETE'),'authenticated has no direct plan DML');
select ok(not has_table_privilege('authenticated','public.audit_events','UPDATE') and not has_table_privilege('authenticated','public.audit_events','DELETE'),'authenticated cannot update or delete audit');
select ok(not has_function_privilege('anon','public.correct_unpaid_charge_amount(uuid,integer,integer,text,uuid)','EXECUTE'),'anon cannot call amount correction RPC');
select ok(not has_function_privilege('anon','public.set_enrollment_contract_amount(uuid,integer,integer,date,text,uuid)','EXECUTE'),'anon cannot call contract RPC');

select set_config('request.jwt.claim.sub','fa100000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($$select public.correct_unpaid_charge_amount('fa100000-0000-4000-8000-000000000060',4600,22000,'Synthetic approved correction',gen_random_uuid())$$,'reception without finance role can correct an open charge');
select is((select amount_cents from public.charges where id='fa100000-0000-4000-8000-000000000060'),22000,'synthetic open amount updated');
select lives_ok($$select public.set_enrollment_contract_amount('fa100000-0000-4000-8000-000000000050',null,22000,'2027-01-01','Synthetic approved recurring amount',gen_random_uuid())$$,'reception without finance role can set recurring monthly amount');
select is((select contract_amount_cents from public.enrollments where id='fa100000-0000-4000-8000-000000000050'),22000,'synthetic recurring amount persisted');
reset role;
select ok((select count(*)=2 from public.audit_events where user_id='fa100000-0000-4000-8000-000000000001' and entity_id in ('fa100000-0000-4000-8000-000000000060','fa100000-0000-4000-8000-000000000050')),'both adjustments create audit events attributed to receptionist');
set local role authenticated;
select throws_ok($$select public.correct_unpaid_charge_amount('fa100000-0000-4000-8000-000000000061',4600,22000,'Synthetic partial protected',gen_random_uuid())$$,'P0001','CHARGE_AMOUNT_CONFLICT','partial charge cannot be edited');
select throws_ok($$select public.set_enrollment_contract_amount('fa100000-0000-4000-8000-000000000050',4600,23000,'2027-01-01','Synthetic concurrent conflict',gen_random_uuid())$$,'P0001','CONTRACT_AMOUNT_CONFLICT','stale contract amount rejected');
reset role;

select set_config('request.jwt.claim.sub','fa100000-0000-4000-8000-000000000002',true);
set local role authenticated;
select throws_ok($$select public.correct_unpaid_charge_amount('fa100000-0000-4000-8000-000000000060',22000,23000,'No enrollment view permission',gen_random_uuid())$$,'P0001','FORBIDDEN','reception without enrollment view permission rejected');
reset role;
select set_config('request.jwt.claim.sub','fa100000-0000-4000-8000-000000000004',true);
set local role authenticated;
select throws_ok($$select public.correct_unpaid_charge_amount('fa100000-0000-4000-8000-000000000060',22000,23000,'Reception from other unit',gen_random_uuid())$$,'P0001','UNIT_FORBIDDEN','reception assigned to another unit is rejected');
reset role;
select set_config('request.jwt.claim.sub','fa100000-0000-4000-8000-000000000005',true);
set local role authenticated;
select throws_ok($$select public.correct_unpaid_charge_amount('fa100000-0000-4000-8000-000000000060',22000,23000,'Reception from other clinic',gen_random_uuid())$$,'P0001','CHARGE_NOT_FOUND','reception from another clinic cannot see target charge');
reset role;
select set_config('request.jwt.claim.sub','fa100000-0000-4000-8000-000000000003',true);
set local role authenticated;
select throws_ok($$select public.correct_unpaid_charge_amount('fa100000-0000-4000-8000-000000000060',22000,23000,'Finance lacks edit permission',gen_random_uuid())$$,'P0001','FORBIDDEN','finance without edit permission remains rejected');
reset role;

select set_config('request.jwt.claim.sub','fa100000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($$select public.register_payment('fa100000-0000-4000-8000-000000000060',3000,'pix','2026-10-05T12:00:00Z','reception-operational-receipt',gen_random_uuid())$$,'reception records receipt on its authorized enrollment');
select lives_ok($$select public.register_payment('fa100000-0000-4000-8000-000000000060',3000,'pix','2026-10-05T12:00:00Z','reception-operational-receipt',gen_random_uuid())$$,'replaying the same receipt is idempotent');
reset role;
select is((select count(*)::integer from public.payments where idempotency_key='reception-operational-receipt'),1,'replay creates one payment');
select is((select paid_cents from public.charges where id='fa100000-0000-4000-8000-000000000060'),3000,'receipt updates charge balance');
select ok((select count(*)=1 from public.audit_events where action='payment.created' and user_id='fa100000-0000-4000-8000-000000000001'),'receipt is attributed to receptionist in audit');

select set_config('request.jwt.claim.sub','fa100000-0000-4000-8000-000000000002',true);
set local role authenticated;
select throws_ok($$select public.register_payment('fa100000-0000-4000-8000-000000000060',100,'pix','2026-10-05T12:00:00Z','receipt-no-grant',gen_random_uuid())$$,'P0001','FORBIDDEN','reception without enrollment permission cannot receive');
reset role;
select set_config('request.jwt.claim.sub','fa100000-0000-4000-8000-000000000004',true);
set local role authenticated;
select throws_ok($$select public.register_payment('fa100000-0000-4000-8000-000000000060',100,'pix','2026-10-05T12:00:00Z','receipt-other-unit',gen_random_uuid())$$,'P0001','UNIT_FORBIDDEN','reception in another unit cannot receive');
reset role;
select set_config('request.jwt.claim.sub','fa100000-0000-4000-8000-000000000005',true);
set local role authenticated;
select throws_ok($$select public.register_payment('fa100000-0000-4000-8000-000000000060',100,'pix','2026-10-05T12:00:00Z','receipt-other-clinic',gen_random_uuid())$$,'P0001','CHARGE_NOT_FOUND','reception in another clinic cannot receive');
reset role;
select set_config('request.jwt.claim.sub','fa100000-0000-4000-8000-000000000003',true);
set local role authenticated;
select throws_ok($$select public.register_payment('fa100000-0000-4000-8000-000000000060',100,'pix','2026-10-05T12:00:00Z','receipt-finance-viewer',gen_random_uuid())$$,'P0001','FORBIDDEN','finance viewer still cannot receive');
reset role;

select set_config('request.jwt.claim.sub','fa100000-0000-4000-8000-000000000006',true);
set local role authenticated;
select ok(public.can_create_financial_charge('fa100000-0000-4000-8000-000000000030','fa100000-0000-4000-8000-000000000020','fa100000-0000-4000-8000-000000000051'),'finance editor may validate a historical enrollment');
select lives_ok($$select public.create_enrollment_charge('{"patient_id":"fa100000-0000-4000-8000-000000000030","enrollment_id":"fa100000-0000-4000-8000-000000000051","unit_id":"fa100000-0000-4000-8000-000000000020","description":"Synthetic August regularization","due_at":"2026-08-05","coverage_from":"2026-08-01","coverage_to":"2026-08-31"}'::jsonb,gen_random_uuid())$$,'finance editor creates missing historical charge at contracted price');
select throws_ok($$select public.create_enrollment_charge('{"patient_id":"fa100000-0000-4000-8000-000000000030","enrollment_id":"fa100000-0000-4000-8000-000000000051","unit_id":"fa100000-0000-4000-8000-000000000020","description":"Synthetic invalid future charge","due_at":"2026-11-05","coverage_from":"2026-11-01","coverage_to":"2026-11-30"}'::jsonb,gen_random_uuid())$$,'P0001','INVALID_ENROLLMENT','expired enrollment cannot be charged outside historical period');
reset role;
select set_config('request.jwt.claim.sub','fa100000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($$select public.register_payment((select id from public.charges where enrollment_id='fa100000-0000-4000-8000-000000000051'),4600,'pix','2026-08-05T12:00:00Z','historical-operational-receipt',gen_random_uuid())$$,'reception can settle a historical charge on an expired enrollment');
reset role;

select * from finish();
rollback;
