begin;
select plan(26);

insert into auth.users(id) values
 ('f8100000-0000-4000-8000-000000000001'),
 ('f8100000-0000-4000-8000-000000000002'),
 ('f8100000-0000-4000-8000-000000000003'),
 ('f8100000-0000-4000-8000-000000000004');

-- The schema has a circular clinic-owner/profile relationship with immediate
-- FKs. Temporarily nullable owner is restored before commit; no trigger or FK
-- is disabled or altered.
alter table public.clinics alter column owner_profile_id drop not null;
insert into public.clinics(id,name,owner_profile_id) values
 ('f8100000-0000-4000-8000-000000000010','Synthetic clinic one',null),
 ('f8100000-0000-4000-8000-000000000011','Synthetic clinic two',null);
insert into public.profiles(id,clinic_id,name,role,status) values
 ('f8100000-0000-4000-8000-000000000001','f8100000-0000-4000-8000-000000000010','Synthetic finance editor','finance','active'),
 ('f8100000-0000-4000-8000-000000000002','f8100000-0000-4000-8000-000000000010','Synthetic finance viewer','finance','active'),
 ('f8100000-0000-4000-8000-000000000003','f8100000-0000-4000-8000-000000000010','Synthetic clinic peer','finance','active'),
 ('f8100000-0000-4000-8000-000000000004','f8100000-0000-4000-8000-000000000011','Synthetic foreign user','finance','active');
update public.clinics set owner_profile_id = case id
  when 'f8100000-0000-4000-8000-000000000010' then 'f8100000-0000-4000-8000-000000000001'::uuid
  else 'f8100000-0000-4000-8000-000000000004'::uuid end;
alter table public.clinics alter column owner_profile_id set not null;

insert into public.units(id,clinic_id,name) values
 ('f8100000-0000-4000-8000-000000000020','f8100000-0000-4000-8000-000000000010','Synthetic unit one'),
 ('f8100000-0000-4000-8000-000000000021','f8100000-0000-4000-8000-000000000010','Synthetic unit two'),
 ('f8100000-0000-4000-8000-000000000022','f8100000-0000-4000-8000-000000000011','Synthetic foreign unit');
insert into public.profile_units(profile_id,unit_id) values
 ('f8100000-0000-4000-8000-000000000001','f8100000-0000-4000-8000-000000000020'),
 ('f8100000-0000-4000-8000-000000000002','f8100000-0000-4000-8000-000000000020'),
 ('f8100000-0000-4000-8000-000000000003','f8100000-0000-4000-8000-000000000021'),
 ('f8100000-0000-4000-8000-000000000004','f8100000-0000-4000-8000-000000000022');
insert into public.profile_permissions(profile_id,module,can_view,can_edit) values
 ('f8100000-0000-4000-8000-000000000001','patients',false,false),
 ('f8100000-0000-4000-8000-000000000001','finance',true,true),
 ('f8100000-0000-4000-8000-000000000001','enrollments',true,false),
 ('f8100000-0000-4000-8000-000000000002','patients',false,false),
 ('f8100000-0000-4000-8000-000000000002','finance',true,false),
 ('f8100000-0000-4000-8000-000000000002','enrollments',true,false),
 ('f8100000-0000-4000-8000-000000000003','patients',false,false),
 ('f8100000-0000-4000-8000-000000000003','finance',true,true),
 ('f8100000-0000-4000-8000-000000000003','enrollments',false,false),
 ('f8100000-0000-4000-8000-000000000004','patients',false,false),
 ('f8100000-0000-4000-8000-000000000004','finance',true,true),
 ('f8100000-0000-4000-8000-000000000004','enrollments',true,false);
insert into public.patients(id,clinic_id,primary_unit_id,name) values
 ('f8100000-0000-4000-8000-000000000030','f8100000-0000-4000-8000-000000000010','f8100000-0000-4000-8000-000000000020','Synthetic patient one'),
 ('f8100000-0000-4000-8000-000000000031','f8100000-0000-4000-8000-000000000010','f8100000-0000-4000-8000-000000000021','Synthetic patient other unit'),
 ('f8100000-0000-4000-8000-000000000032','f8100000-0000-4000-8000-000000000011','f8100000-0000-4000-8000-000000000022','Synthetic foreign patient');
insert into public.charges(id,clinic_id,patient_id,unit_id,description,amount_cents,due_at,status) values
 ('f8100000-0000-4000-8000-000000000040','f8100000-0000-4000-8000-000000000010','f8100000-0000-4000-8000-000000000030','f8100000-0000-4000-8000-000000000020','Synthetic charge one',1000,'2026-10-05','pending'),
 ('f8100000-0000-4000-8000-000000000041','f8100000-0000-4000-8000-000000000010','f8100000-0000-4000-8000-000000000031','f8100000-0000-4000-8000-000000000021','Synthetic charge other unit',1000,'2026-10-05','pending'),
 ('f8100000-0000-4000-8000-000000000042','f8100000-0000-4000-8000-000000000011','f8100000-0000-4000-8000-000000000032','f8100000-0000-4000-8000-000000000022','Synthetic foreign charge',1000,'2026-10-05','pending');

select has_function('public','can_create_financial_charge',array['uuid','uuid','uuid'],'financial patient scope function exists');
select ok((select prosecdef from pg_proc where oid='public.can_create_financial_charge(uuid,uuid,uuid)'::regprocedure),'scope function is SECURITY DEFINER');
select ok(has_function_privilege('authenticated','public.can_create_financial_charge(uuid,uuid,uuid)','EXECUTE'),'authenticated may invoke scope function');
select ok(not has_function_privilege('anon','public.can_create_financial_charge(uuid,uuid,uuid)','EXECUTE'),'anon cannot invoke scope function');
select ok(has_column_privilege('authenticated','public.profiles','id','SELECT') and has_column_privilege('authenticated','public.profiles','deleted_at','SELECT'),'authenticated has only required profile column grants');
select ok(not has_column_privilege('anon','public.profiles','id','SELECT'),'anon has no profile read grant');
select ok(has_column_privilege('authenticated','public.profile_permissions','module','SELECT') and has_column_privilege('authenticated','public.profile_permissions','can_edit','SELECT'),'authenticated has required permission column grants');
select ok(not has_column_privilege('anon','public.profile_permissions','module','SELECT'),'anon has no permission read grant');
select ok(has_table_privilege('authenticated','public.charges','SELECT'),'authenticated can query charges subject to RLS');
select ok(not has_table_privilege('anon','public.charges','SELECT'),'anon cannot query charges');
select ok(has_table_privilege('authenticated','public.patients','SELECT') and (select relrowsecurity from pg_class where oid='public.patients'::regclass),'authenticated patient SELECT is mediated by RLS');
select ok(not has_column_privilege('authenticated','public.profiles','last_activity_at','SELECT'),'unneeded profile column remains ungranted');

select set_config('request.jwt.claim.sub','f8100000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is((select count(*)::integer from public.profiles),1,'profile RLS exposes only caller profile');
select is((select count(*)::integer from public.profile_permissions),3,'permission RLS exposes only caller permissions');
select is((select count(*)::integer from public.charges),1,'charge select scoped to assigned unit');
select is((select count(*)::integer from public.patients),0,'finance cannot directly read patient rows');
select ok(public.can_create_financial_charge('f8100000-0000-4000-8000-000000000030','f8100000-0000-4000-8000-000000000020',null),'authorized finance can validate eligible same-unit patient');
select ok(not public.can_create_financial_charge('f8100000-0000-4000-8000-000000000031','f8100000-0000-4000-8000-000000000020',null),'patient in another unit rejected');
select ok(not public.can_create_financial_charge('f8100000-0000-4000-8000-000000000032','f8100000-0000-4000-8000-000000000022',null),'patient from another clinic rejected');
select ok(not public.can_create_financial_charge('f8100000-0000-4000-8000-000000000030','f8100000-0000-4000-8000-000000000020','f8100000-0000-4000-8000-000000000099'),'invalid enrollment rejected');
reset role;
select set_config('request.jwt.claim.sub','f8100000-0000-4000-8000-000000000002',true);
set local role authenticated;
select ok(not public.can_create_financial_charge('f8100000-0000-4000-8000-000000000030','f8100000-0000-4000-8000-000000000020',null),'finance without edit permission rejected');
select is((select count(*)::integer from public.charges),1,'finance read permission allows same-unit charges');
reset role;
select set_config('request.jwt.claim.sub','f8100000-0000-4000-8000-000000000003',true);
set local role authenticated;
select is((select count(*)::integer from public.charges),0,'finance without enrollment view cannot read charges');
select ok(not public.can_create_financial_charge('f8100000-0000-4000-8000-000000000030','f8100000-0000-4000-8000-000000000020',null),'unassigned unit rejected');
reset role;
select set_config('request.jwt.claim.sub','f8100000-0000-4000-8000-000000000004',true);
set local role authenticated;
select is((select count(*)::integer from public.charges),1,'foreign clinic sees only its own unit charges');
select ok(not public.can_create_financial_charge('f8100000-0000-4000-8000-000000000030','f8100000-0000-4000-8000-000000000020',null),'cross-clinic patient and unit rejected');
reset role;

select * from finish();
rollback;
