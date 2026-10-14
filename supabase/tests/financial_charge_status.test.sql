begin;
select plan(26);

insert into auth.users(id) values
 ('f6200000-0000-4000-8000-000000000001'),
 ('f6200000-0000-4000-8000-000000000002'),
 ('f6200000-0000-4000-8000-000000000003'),
 ('f6200000-0000-4000-8000-000000000004'),
 ('f6200000-0000-4000-8000-000000000005'),
 ('f6200000-0000-4000-8000-000000000006');

alter table public.clinics alter column owner_profile_id drop not null;
insert into public.clinics(id,name,owner_profile_id) values
 ('f6200000-0000-4000-8000-000000000010','Synthetic status clinic one',null),
 ('f6200000-0000-4000-8000-000000000011','Synthetic status clinic two',null);
insert into public.profiles(id,clinic_id,name,role,status) values
 ('f6200000-0000-4000-8000-000000000001','f6200000-0000-4000-8000-000000000010','Synthetic finance editor','finance','active'),
 ('f6200000-0000-4000-8000-000000000002','f6200000-0000-4000-8000-000000000010','Synthetic edit only','finance','active'),
 ('f6200000-0000-4000-8000-000000000003','f6200000-0000-4000-8000-000000000010','Synthetic view only','finance','active'),
 ('f6200000-0000-4000-8000-000000000004','f6200000-0000-4000-8000-000000000010','Synthetic other unit','finance','active'),
 ('f6200000-0000-4000-8000-000000000005','f6200000-0000-4000-8000-000000000011','Synthetic foreign clinic','finance','active'),
 ('f6200000-0000-4000-8000-000000000006','f6200000-0000-4000-8000-000000000010','Synthetic no permission','finance','active');
update public.clinics set owner_profile_id = case id
  when 'f6200000-0000-4000-8000-000000000010' then 'f6200000-0000-4000-8000-000000000001'::uuid
  else 'f6200000-0000-4000-8000-000000000005'::uuid end;
alter table public.clinics alter column owner_profile_id set not null;

insert into public.units(id,clinic_id,name) values
 ('f6200000-0000-4000-8000-000000000020','f6200000-0000-4000-8000-000000000010','Synthetic status unit one'),
 ('f6200000-0000-4000-8000-000000000021','f6200000-0000-4000-8000-000000000010','Synthetic status unit two'),
 ('f6200000-0000-4000-8000-000000000022','f6200000-0000-4000-8000-000000000011','Synthetic status foreign unit');
insert into public.profile_units(profile_id,unit_id) values
 ('f6200000-0000-4000-8000-000000000001','f6200000-0000-4000-8000-000000000020'),
 ('f6200000-0000-4000-8000-000000000002','f6200000-0000-4000-8000-000000000020'),
 ('f6200000-0000-4000-8000-000000000003','f6200000-0000-4000-8000-000000000020'),
 ('f6200000-0000-4000-8000-000000000004','f6200000-0000-4000-8000-000000000021'),
 ('f6200000-0000-4000-8000-000000000005','f6200000-0000-4000-8000-000000000022'),
 ('f6200000-0000-4000-8000-000000000006','f6200000-0000-4000-8000-000000000020');
insert into public.profile_permissions(profile_id,module,can_view,can_edit) values
 ('f6200000-0000-4000-8000-000000000001','enrollments',true,true),
 ('f6200000-0000-4000-8000-000000000001','finance',true,true),
 ('f6200000-0000-4000-8000-000000000002','enrollments',false,true),
 ('f6200000-0000-4000-8000-000000000003','enrollments',true,false),
 ('f6200000-0000-4000-8000-000000000004','enrollments',true,true),
 ('f6200000-0000-4000-8000-000000000005','enrollments',true,true);
insert into public.patients(id,clinic_id,primary_unit_id,name) values
 ('f6200000-0000-4000-8000-000000000030','f6200000-0000-4000-8000-000000000010','f6200000-0000-4000-8000-000000000020','Synthetic status patient');
insert into public.charges(id,clinic_id,patient_id,unit_id,description,amount_cents,paid_cents,due_at,status) values
 ('f6200000-0000-4000-8000-000000000040','f6200000-0000-4000-8000-000000000010','f6200000-0000-4000-8000-000000000030','f6200000-0000-4000-8000-000000000020','Synthetic open status charge',4600,0,'2026-10-05','pending'),
 ('f6200000-0000-4000-8000-000000000041','f6200000-0000-4000-8000-000000000010','f6200000-0000-4000-8000-000000000030','f6200000-0000-4000-8000-000000000020','Synthetic partial status charge',4600,0,'2026-10-05','pending'),
 ('f6200000-0000-4000-8000-000000000042','f6200000-0000-4000-8000-000000000010','f6200000-0000-4000-8000-000000000030','f6200000-0000-4000-8000-000000000020','Synthetic paid status charge',4600,0,'2026-10-05','pending');

select has_function('public','update_unpaid_charge_status',array['uuid','charge_status','uuid'],'status RPC is installed');
select ok((select prosecdef from pg_proc where oid='public.update_unpaid_charge_status(uuid,public.charge_status,uuid)'::regprocedure),'status RPC is SECURITY DEFINER');
select ok(has_function_privilege('authenticated','public.update_unpaid_charge_status(uuid,public.charge_status,uuid)','EXECUTE'),'authenticated may execute the internally authorized status RPC');
select ok(not has_function_privilege('anon','public.update_unpaid_charge_status(uuid,public.charge_status,uuid)','EXECUTE'),'anon cannot execute the status RPC');
select ok(not has_table_privilege('authenticated','public.charges','UPDATE'),'status changes do not grant direct charge UPDATE');
select ok(not has_table_privilege('authenticated','public.charges','DELETE'),'status changes do not grant direct charge DELETE');

select set_config('request.jwt.claim.sub','f6200000-0000-4000-8000-000000000001',true);
set local role authenticated;
select throws_ok($$select public.update_unpaid_charge_status('f6200000-0000-4000-8000-000000000040','paid','f6200000-0000-4000-8000-000000000090')$$,'P0001','STATUS_MANAGED_BY_PAYMENT','manual paid status is rejected');
select lives_ok($$select public.update_unpaid_charge_status('f6200000-0000-4000-8000-000000000040','overdue','f6200000-0000-4000-8000-000000000090')$$,'authorized user may change an unpaid administrative status');
select is((select status::text from public.charges where id='f6200000-0000-4000-8000-000000000040'),'overdue','administrative status is persisted');
select lives_ok($$select public.update_unpaid_charge_status('f6200000-0000-4000-8000-000000000040','pending','f6200000-0000-4000-8000-000000000091')$$,'authorized user may return an unpaid charge to pending');
select lives_ok($$select public.update_unpaid_charge_status('f6200000-0000-4000-8000-000000000040','cancelled','f6200000-0000-4000-8000-000000000092')$$,'authorized user may cancel an unpaid charge');
select lives_ok($$select public.update_unpaid_charge_status('f6200000-0000-4000-8000-000000000040','pending','f6200000-0000-4000-8000-000000000093')$$,'historically accepted reopen transition remains available without payment');
reset role;
select ok((select count(*)=4 from public.audit_events where user_id='f6200000-0000-4000-8000-000000000001' and entity_id='f6200000-0000-4000-8000-000000000040' and action='charge.status_updated'),'each administrative status change is audited');

set local role authenticated;
select public.register_payment('f6200000-0000-4000-8000-000000000040',4600,'pix',now(),'status-test-full-payment',gen_random_uuid());
select is((select status::text||':'||paid_cents::text from public.charges where id='f6200000-0000-4000-8000-000000000040'),'paid:4600','register_payment owns paid state and balance');
select throws_ok($$select public.update_unpaid_charge_status('f6200000-0000-4000-8000-000000000040','pending','f6200000-0000-4000-8000-000000000094')$$,'P0001','CHARGE_HAS_PAYMENTS','paid charge cannot be changed by administrative status RPC');
reset role;
select public.reverse_payment((select id from public.payments where idempotency_key='status-test-full-payment'),'Synthetic reversal for status test',gen_random_uuid());
set local role authenticated;
select is((select status::text||':'||paid_cents::text from public.charges where id='f6200000-0000-4000-8000-000000000040'),'pending:0','reverse_payment owns restoration of unpaid state');
select lives_ok($$select public.update_unpaid_charge_status('f6200000-0000-4000-8000-000000000040','overdue','f6200000-0000-4000-8000-000000000095')$$,'reversed payment leaves no active balance conflict');

select public.register_payment('f6200000-0000-4000-8000-000000000041',500,'pix',now(),'status-test-partial-payment',gen_random_uuid());
select is((select status::text||':'||paid_cents::text from public.charges where id='f6200000-0000-4000-8000-000000000041'),'partial:500','register_payment owns partial state and balance');
select throws_ok($$select public.update_unpaid_charge_status('f6200000-0000-4000-8000-000000000041','cancelled','f6200000-0000-4000-8000-000000000096')$$,'P0001','CHARGE_HAS_PAYMENTS','partially paid charge cannot be changed administratively');
select throws_ok($$select public.update_unpaid_charge_status('f6200000-0000-4000-8000-000000000041','partial','f6200000-0000-4000-8000-000000000097')$$,'P0001','STATUS_MANAGED_BY_PAYMENT','partial status cannot be assigned directly');
reset role;

select set_config('request.jwt.claim.sub','f6200000-0000-4000-8000-000000000002',true);
set local role authenticated;
select is((select count(*)::integer from public.charges where id='f6200000-0000-4000-8000-000000000040'),0,'edit=true/view=false cannot read charge details under RLS');
select throws_ok($$select public.update_unpaid_charge_status('f6200000-0000-4000-8000-000000000040','overdue','f6200000-0000-4000-8000-000000000098')$$,'P0001','FORBIDDEN','edit=true/view=false is denied by the command permission check');
reset role;

select set_config('request.jwt.claim.sub','f6200000-0000-4000-8000-000000000003',true);
set local role authenticated;
select throws_ok($$select public.update_unpaid_charge_status('f6200000-0000-4000-8000-000000000040','overdue','f6200000-0000-4000-8000-000000000099')$$,'P0001','FORBIDDEN','view=true/edit=false cannot change status');
reset role;

select set_config('request.jwt.claim.sub','f6200000-0000-4000-8000-000000000004',true);
set local role authenticated;
select throws_ok($$select public.update_unpaid_charge_status('f6200000-0000-4000-8000-000000000040','overdue','f6200000-0000-4000-8000-000000000100')$$,'P0001','UNIT_FORBIDDEN','other unit cannot change status');
reset role;

select set_config('request.jwt.claim.sub','f6200000-0000-4000-8000-000000000005',true);
set local role authenticated;
select throws_ok($$select public.update_unpaid_charge_status('f6200000-0000-4000-8000-000000000040','overdue','f6200000-0000-4000-8000-000000000101')$$,'P0001','CHARGE_NOT_FOUND','other clinic cannot find or change status');
reset role;

select set_config('request.jwt.claim.sub','f6200000-0000-4000-8000-000000000006',true);
set local role authenticated;
select throws_ok($$select public.update_unpaid_charge_status('f6200000-0000-4000-8000-000000000040','overdue','f6200000-0000-4000-8000-000000000102')$$,'P0001','FORBIDDEN','user without module permissions cannot change status');
reset role;

select * from finish();
rollback;
