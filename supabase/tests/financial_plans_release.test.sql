begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();

insert into auth.users(id) values
 ('f7000000-0000-4000-8000-000000000001'),
 ('f7000000-0000-4000-8000-000000000002'),
 ('f7000000-0000-4000-8000-000000000003'),
 ('f7000000-0000-4000-8000-000000000004'),
 ('f7000000-0000-4000-8000-000000000005'),
 ('f7000000-0000-4000-8000-000000000006');

alter table public.clinics alter column owner_profile_id drop not null;
insert into public.clinics(id,name,owner_profile_id) values
 ('f7000000-0000-4000-8000-000000000010','Synthetic status clinic one',null),
 ('f7000000-0000-4000-8000-000000000011','Synthetic status clinic two',null);
insert into public.profiles(id,clinic_id,name,role,status) values
 ('f7000000-0000-4000-8000-000000000001','f7000000-0000-4000-8000-000000000010','Synthetic finance editor','finance','active'),
 ('f7000000-0000-4000-8000-000000000002','f7000000-0000-4000-8000-000000000010','Synthetic edit only','reception','active'),
 ('f7000000-0000-4000-8000-000000000003','f7000000-0000-4000-8000-000000000010','Synthetic view only','reception','active'),
 ('f7000000-0000-4000-8000-000000000004','f7000000-0000-4000-8000-000000000010','Synthetic other unit','finance','active'),
 ('f7000000-0000-4000-8000-000000000005','f7000000-0000-4000-8000-000000000011','Synthetic foreign clinic','finance','active'),
 ('f7000000-0000-4000-8000-000000000006','f7000000-0000-4000-8000-000000000010','Synthetic no permission','finance','active');
update public.clinics set owner_profile_id = case id
  when 'f7000000-0000-4000-8000-000000000010' then 'f7000000-0000-4000-8000-000000000001'::uuid
  else 'f7000000-0000-4000-8000-000000000005'::uuid end;
alter table public.clinics alter column owner_profile_id set not null;

insert into public.units(id,clinic_id,name) values
 ('f7000000-0000-4000-8000-000000000020','f7000000-0000-4000-8000-000000000010','Synthetic status unit one'),
 ('f7000000-0000-4000-8000-000000000021','f7000000-0000-4000-8000-000000000010','Synthetic status unit two'),
 ('f7000000-0000-4000-8000-000000000022','f7000000-0000-4000-8000-000000000011','Synthetic status foreign unit');
insert into public.profile_units(profile_id,unit_id) values
 ('f7000000-0000-4000-8000-000000000001','f7000000-0000-4000-8000-000000000020'),
 ('f7000000-0000-4000-8000-000000000002','f7000000-0000-4000-8000-000000000020'),
 ('f7000000-0000-4000-8000-000000000003','f7000000-0000-4000-8000-000000000020'),
 ('f7000000-0000-4000-8000-000000000004','f7000000-0000-4000-8000-000000000021'),
 ('f7000000-0000-4000-8000-000000000005','f7000000-0000-4000-8000-000000000022'),
 ('f7000000-0000-4000-8000-000000000006','f7000000-0000-4000-8000-000000000020');
insert into public.profile_permissions(profile_id,module,can_view,can_edit) values
 ('f7000000-0000-4000-8000-000000000001','enrollments',true,true),
 ('f7000000-0000-4000-8000-000000000001','finance',true,true),
 ('f7000000-0000-4000-8000-000000000002','enrollments',true,true),
 ('f7000000-0000-4000-8000-000000000003','enrollments',true,false),
 ('f7000000-0000-4000-8000-000000000004','enrollments',true,true),
 ('f7000000-0000-4000-8000-000000000005','enrollments',true,true);
insert into public.patients(id,clinic_id,primary_unit_id,name) values
 ('f7000000-0000-4000-8000-000000000030','f7000000-0000-4000-8000-000000000010','f7000000-0000-4000-8000-000000000020','Synthetic status patient');

insert into public.profile_permissions(profile_id,module,can_view,can_edit) values
 ('f7000000-0000-4000-8000-000000000004','finance',true,true),
 ('f7000000-0000-4000-8000-000000000005','finance',true,true);
create function pg_temp.fixture_id(n integer) returns uuid language sql immutable as $$ select ('f7000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid $$;
create function pg_temp.month(n integer) returns date language sql stable as $$ select (date_trunc('month',current_date)+make_interval(months=>n))::date $$;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id(1)::text,true);
set local role authenticated;
-- Prices below are synthetic test inputs, never catalogue seed values.
select lives_ok($test$do $do$ declare d integer; f integer; begin
 foreach d in array array[30,90,180] loop for f in 1..3 loop
 perform public.save_plan(jsonb_build_object('duration_days',d,'sessions_included',d/30*f*4,'price_cents',22000+d+f),gen_random_uuid());
 end loop; end loop; end $do$ $test$,'nine combinations can be created with supplied test prices');
reset role;
select is((select count(*)::integer from public.plans where clinic_id=pg_temp.fixture_id(10)),9,'all nine combinations exist without seeds');
create temp table ids(key text primary key,id uuid);
insert into ids select 'old_plan',id from public.plans where clinic_id=pg_temp.fixture_id(10) and duration_days=30 and sessions_included=8;
insert into ids select 'new_plan',id from public.plans where clinic_id=pg_temp.fixture_id(10) and duration_days=90 and sessions_included=24;
insert into public.enrollments(id,clinic_id,unit_id,patient_id,plan_id,starts_at,due_day,contract_amount_cents,contract_effective_from)
values(pg_temp.fixture_id(50),pg_temp.fixture_id(10),pg_temp.fixture_id(20),pg_temp.fixture_id(30),(select id from ids where key='old_plan'),pg_temp.month(-1),5,22000,pg_temp.month(-1));
insert into public.charges(id,clinic_id,unit_id,patient_id,enrollment_id,description,amount_cents,due_at,coverage_from,coverage_to,status) values
(pg_temp.fixture_id(40),pg_temp.fixture_id(10),pg_temp.fixture_id(20),pg_temp.fixture_id(30),pg_temp.fixture_id(50),'Synthetic discrepancy',26600,pg_temp.month(0)+4,pg_temp.month(0),pg_temp.month(1)-1,'pending'),
(pg_temp.fixture_id(41),pg_temp.fixture_id(10),pg_temp.fixture_id(20),pg_temp.fixture_id(30),pg_temp.fixture_id(50),'Synthetic no payment',26600,pg_temp.month(-1)+4,pg_temp.month(-1),pg_temp.month(0)-1,'pending'),
(pg_temp.fixture_id(42),pg_temp.fixture_id(10),pg_temp.fixture_id(20),pg_temp.fixture_id(30),pg_temp.fixture_id(50),'Synthetic future',22000,pg_temp.month(1)+4,pg_temp.month(1),pg_temp.month(2)-1,'pending');
grant all on ids to authenticated;
set local role authenticated;
select public.register_payment(pg_temp.fixture_id(40),22000,'pix',now(),'release007-partial',gen_random_uuid());
reset role;
create temp table receipts_before as select to_jsonb(p) row from public.payments p where charge_id=pg_temp.fixture_id(40);
create temp table entries_before as select to_jsonb(f) row from public.financial_entries f where clinic_id=pg_temp.fixture_id(10);
set local role authenticated;
select lives_ok($$select public.adjust_charge_amount(pg_temp.fixture_id(40),26600,22000,22000,'Synthetic contracted price correction',gen_random_uuid())$$,'266 due / 220 received is adjusted without invented receipt');
select is((select amount_cents||':'||paid_cents||':'||(amount_cents-paid_cents)||':'||status from public.charges where id=pg_temp.fixture_id(40)),'22000:22000:0:paid','adjusted amount, paid amount, zero balance and paid status agree');
select lives_ok($$select public.adjust_charge_amount(pg_temp.fixture_id(41),26600,0,22000,'Synthetic no payment correction',gen_random_uuid())$$,'unpaid discrepancy can be adjusted');
select ok((select paid_cents=0 and status in('pending','overdue') from public.charges where id=pg_temp.fixture_id(41)),'unpaid remains unpaid');
select throws_ok($$select public.adjust_charge_amount(pg_temp.fixture_id(40),22000,22000,21000,'Synthetic below received correction',gen_random_uuid())$$,'P0001','AMOUNT_BELOW_RECEIVED','amount below real receipts is blocked');
select throws_ok($$select public.adjust_charge_amount(pg_temp.fixture_id(40),22000,0,23000,'Synthetic stale received correction',gen_random_uuid())$$,'P0001','CHARGE_AMOUNT_CONFLICT','receipt concurrency is checked');
reset role;
select results_eq($$select to_jsonb(p) from public.payments p where charge_id=pg_temp.fixture_id(40)$$,$$select row from receipts_before$$,'every receipt field preserved');
select results_eq($$select to_jsonb(f) from public.financial_entries f where clinic_id=pg_temp.fixture_id(10)$$,$$select row from entries_before$$,'financial ledger unchanged by adjustment');
select ok(exists(select 1 from public.audit_events where entity_id=pg_temp.fixture_id(40) and action='charge.amount_corrected' and metadata->>'paid_cents'='22000'),'correction is audited with paid amount');
set local role authenticated;
select lives_ok($$select public.save_plan(jsonb_build_object('price_cents',25000),gen_random_uuid(),(select id from ids where key='old_plan'))$$,'catalogue price can be edited');
select is(public.enrollment_amount_at(pg_temp.fixture_id(50),pg_temp.month(0),pg_temp.month(1)-1),22000,'catalogue price change preserves contracted price');
select is((select amount_cents from public.charges where id=pg_temp.fixture_id(40)),22000,'catalogue edit leaves historical charge unchanged');
select throws_ok($$select public.save_plan(jsonb_build_object('duration_days',30,'sessions_included',8,'price_cents',22000),gen_random_uuid())$$,'P0001','PLAN_COMBINATION_EXISTS','catalogue duplicate is rejected');
select lives_ok($$select public.save_plan('{"active":false}',gen_random_uuid(),(select id from ids where key='new_plan'))$$,'plan can be deactivated');
select throws_ok($$select public.preview_enrollment_plan_change(pg_temp.fixture_id(50),(select id from ids where key='new_plan'),pg_temp.month(1))$$,'P0001','PLAN_INACTIVE','inactive plan cannot be selected for change');
select public.save_plan('{"active":true}',gen_random_uuid(),(select id from ids where key='new_plan'));
select throws_ok($$select public.set_enrollment_contract_amount(pg_temp.fixture_id(50),22000,24000,pg_temp.month(1),'Synthetic conflicting future contract',gen_random_uuid())$$,'P0001','CONTRACT_HAS_FUTURE_CHARGES','incompatible future charge produces explicit cause');
select throws_ok($$select public.set_enrollment_contract_amount(pg_temp.fixture_id(50),21000,22000,pg_temp.month(1),'Synthetic stale contract update',gen_random_uuid())$$,'P0001','CONTRACT_AMOUNT_CONFLICT','contract concurrency produces explicit cause');
select public.register_payment(pg_temp.fixture_id(42),100,'pix',now(),'release007-future-partial',gen_random_uuid());
select throws_ok($$select public.preview_enrollment_plan_change(pg_temp.fixture_id(50),(select id from ids where key='new_plan'),pg_temp.month(1))$$,'P0001','PLAN_CHANGE_FUTURE_RECEIPTS','future partial receipt blocks change explicitly');
reset role;
select public.reverse_payment((select id from public.payments where idempotency_key='release007-future-partial'),'Synthetic reversal to clear fixture',gen_random_uuid());
set local role authenticated;
select lives_ok($$select public.set_enrollment_contract_amount(pg_temp.fixture_id(50),22000,24000,pg_temp.month(2),'Synthetic new contract terms',gen_random_uuid())$$,'future contractual condition can be saved');
select is(public.enrollment_amount_at(pg_temp.fixture_id(50),pg_temp.month(0),pg_temp.month(1)-1),22000,'previous contract price survives new terms');
select is(public.enrollment_amount_at(pg_temp.fixture_id(50),pg_temp.month(2),pg_temp.month(3)-1),24000,'future contract price follows effective date');
select lives_ok($$select public.set_enrollment_contract_amount(pg_temp.fixture_id(50),24000,22000,pg_temp.month(0),'Synthetic historical contract confirmation',gen_random_uuid())$$,'historical condition can be confirmed without overwriting future condition');
select is((select contract_amount_cents from public.enrollments where id=pg_temp.fixture_id(50)),24000,'future contractual snapshot remains unchanged');
select is(public.enrollment_amount_at(pg_temp.fixture_id(50),pg_temp.month(0),pg_temp.month(1)-1),22000,'historical condition uses approved price');
select throws_ok($$select public.set_enrollment_contract_terms(pg_temp.fixture_id(50),'2000-01-01',24000,24000,pg_temp.month(3),'Synthetic stale equal price update',gen_random_uuid())$$,'P0001','CONTRACT_AMOUNT_CONFLICT','revision detects concurrent equal price changes');
select throws_ok($$select public.save_enrollment(jsonb_build_object('plan_id',(select id from ids where key='new_plan')),gen_random_uuid(),pg_temp.fixture_id(50))$$,'P0001','USE_PLAN_CHANGE','old edit flow cannot silently change historical commercial terms');
reset role;
create temp table preview as select public.preview_enrollment_plan_change(pg_temp.fixture_id(50),(select id from ids where key='new_plan'),pg_temp.month(1)) value;
grant all on preview to authenticated;
set local role authenticated;
select is((select jsonb_array_length(value->'cancel_charge_ids') from preview),1,'preview identifies only unpaid future charge to cancel');
select throws_ok($$select public.change_enrollment_plan(pg_temp.fixture_id(50),(select id from ids where key='new_plan'),pg_temp.month(1),'stale','Synthetic stale plan change',gen_random_uuid())$$,'P0001','CONTRACT_AMOUNT_CONFLICT','stale plan preview cannot confirm');
select lives_ok($$insert into ids select 'successor',(public.change_enrollment_plan(pg_temp.fixture_id(50),(select id from ids where key='new_plan'),pg_temp.month(1),(select value->>'token' from preview),'Synthetic approved plan change',gen_random_uuid())->'enrollment'->>'id')::uuid$$,'plan change works with old paid charge and creates successor');
reset role;
select is((select ends_at from public.enrollments where id=pg_temp.fixture_id(50)),pg_temp.month(1)-1,'old enrollment preserved with explicit end date');
select is((select status::text from public.charges where id=pg_temp.fixture_id(42)),'cancelled','future unpaid charge preserved as cancelled');
select is((select status::text from public.charges where id=pg_temp.fixture_id(40)),'paid','old paid charge preserved');
select is((select paid_cents from public.charges where id=pg_temp.fixture_id(40)),22000,'old received amount preserved after plan change');
select ok((select c.amount_cents=p.price_cents and c.paid_cents=0 and c.coverage_from=pg_temp.month(1) and c.coverage_to=pg_temp.month(4)-1 from public.charges c join public.enrollments e on e.id=c.enrollment_id join public.plans p on p.id=e.plan_id where e.id=(select id from ids where key='successor')),'new future charge follows new plan price and quarterly coverage');
select results_eq($$select to_jsonb(p) from public.payments p where charge_id=pg_temp.fixture_id(40)$$,$$select row from receipts_before$$,'receipts remain identical after plan change');
select ok(exists(select 1 from public.audit_events where entity_id=pg_temp.fixture_id(50) and action='enrollment.plan_changed'),'plan change audited');
-- Scope and reception capabilities apply inside RPCs, including direct RPC access.
insert into public.enrollments(id,clinic_id,unit_id,patient_id,plan_id,starts_at,status) values(pg_temp.fixture_id(51),pg_temp.fixture_id(10),pg_temp.fixture_id(20),pg_temp.fixture_id(30),(select id from ids where key='old_plan'),pg_temp.month(-3),'paused');
set local role authenticated;
select lives_ok($$select public.save_plan('{"price_cents":26000}',gen_random_uuid(),(select id from ids where key='old_plan'))$$,'global price remains editable with legacy contracts');
select throws_ok($$select public.enrollment_amount_at(pg_temp.fixture_id(51),pg_temp.month(0),pg_temp.month(1)-1)$$,'P0001','CONTRACT_PRICE_UNCONFIRMED','legacy contract never inherits mutable catalogue price');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id(2)::text,true);
set local role authenticated;
select lives_ok($$select public.adjust_charge_amount(pg_temp.fixture_id(41),22000,0,23000,'Synthetic reception authorized correction',gen_random_uuid())$$,'reception with enrollments edit may adjust a charge');
select throws_ok($$select public.register_payment(pg_temp.fixture_id(41),100,'pix',now(),'release007-reception-denied',gen_random_uuid())$$,'P0001','FORBIDDEN','reception cannot register receipts');
select throws_ok($$select public.save_plan('{"price_cents":99999}',gen_random_uuid(),(select id from ids where key='new_plan'))$$,'P0001','FORBIDDEN','reception cannot change global prices');
select lives_ok($$select public.preview_enrollment_plan_change((select id from ids where key='successor'),(select id from ids where key='old_plan'),pg_temp.month(4))$$,'reception may preview next plan change after paid coverage');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id(3)::text,true);
set local role authenticated;
select throws_ok($$select public.adjust_charge_amount(pg_temp.fixture_id(41),23000,0,22000,'Synthetic readonly reception correction',gen_random_uuid())$$,'P0001','FORBIDDEN','reception view only cannot adjust charges');
select throws_ok($$select public.preview_enrollment_plan_change(pg_temp.fixture_id(50),(select id from ids where key='new_plan'),pg_temp.month(1))$$,'P0001','FORBIDDEN','reception view only cannot change plans');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id(4)::text,true);
set local role authenticated;
select throws_ok($$select public.adjust_charge_amount(pg_temp.fixture_id(41),23000,0,22000,'Synthetic cross unit correction',gen_random_uuid())$$,'P0001','UNIT_FORBIDDEN','cross unit adjustment denied');
select throws_ok($$select public.preview_enrollment_plan_change(pg_temp.fixture_id(50),(select id from ids where key='new_plan'),pg_temp.month(1))$$,'P0001','UNIT_FORBIDDEN','cross unit plan change denied');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id(5)::text,true);
set local role authenticated;
select throws_ok($$select public.adjust_charge_amount(pg_temp.fixture_id(41),23000,0,22000,'Synthetic cross clinic correction',gen_random_uuid())$$,'P0001','CHARGE_NOT_FOUND','cross clinic adjustment denied');
select throws_ok($$select public.preview_enrollment_plan_change(pg_temp.fixture_id(50),(select id from ids where key='new_plan'),pg_temp.month(1))$$,'P0001','ENROLLMENT_NOT_FOUND','cross clinic plan change denied');
reset role;
select ok(not has_function_privilege('authenticated','public.save_enrollment_before_financial_release(jsonb,uuid,uuid)','execute'),'internal old commercial edit RPC is not callable by authenticated');
select ok(not has_function_privilege('anon','public.change_enrollment_plan(uuid,uuid,date,text,text,uuid)','execute'),'anonymous plan changes denied');
select ok(not has_table_privilege('authenticated','public.charges','update'),'no direct charge update grant introduced');
select * from finish();
rollback;
