begin;
select plan(23);

insert into auth.users(id) values
 ('f3000000-0000-4000-8000-000000000001'),
 ('f3000000-0000-4000-8000-000000000002');
alter table public.clinics alter column owner_profile_id drop not null;
insert into public.clinics(id,name,owner_profile_id) values ('f3000000-0000-4000-8000-000000000010','Artificial contract clinic',null);
insert into public.profiles(id,clinic_id,name,role,status) values
 ('f3000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000010','Artificial finance editor','finance','active'),
 ('f3000000-0000-4000-8000-000000000002','f3000000-0000-4000-8000-000000000010','Artificial finance viewer','finance','active');
update public.clinics set owner_profile_id='f3000000-0000-4000-8000-000000000001' where id='f3000000-0000-4000-8000-000000000010';
alter table public.clinics alter column owner_profile_id set not null;
insert into public.units(id,clinic_id,name) values ('f3000000-0000-4000-8000-000000000020','f3000000-0000-4000-8000-000000000010','Artificial unit');
insert into public.profile_units(profile_id,unit_id) values
 ('f3000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000020'),
 ('f3000000-0000-4000-8000-000000000002','f3000000-0000-4000-8000-000000000020');
insert into public.profile_permissions(profile_id,module,can_view,can_edit) values
 ('f3000000-0000-4000-8000-000000000001','finance',true,true),
 ('f3000000-0000-4000-8000-000000000002','finance',true,false),
 ('f3000000-0000-4000-8000-000000000001','enrollments',true,false),
 ('f3000000-0000-4000-8000-000000000002','enrollments',true,false);
insert into public.patients(id,clinic_id,primary_unit_id,name) values
 ('f3000000-0000-4000-8000-000000000030','f3000000-0000-4000-8000-000000000010','f3000000-0000-4000-8000-000000000020','Artificial patient');
insert into public.plans(id,clinic_id,name,kind,sessions_included,duration_days,price_cents) values
 ('f3000000-0000-4000-8000-000000000040','f3000000-0000-4000-8000-000000000010','Artificial global plan','monthly',8,30,4600);
insert into public.enrollments(id,clinic_id,patient_id,plan_id,unit_id,starts_at,due_day,discount_cents,surcharge_cents)
values ('f3000000-0000-4000-8000-000000000050','f3000000-0000-4000-8000-000000000010','f3000000-0000-4000-8000-000000000030','f3000000-0000-4000-8000-000000000040','f3000000-0000-4000-8000-000000000020','2026-10-01',5,2000,500);
insert into public.charges(id,clinic_id,patient_id,enrollment_id,unit_id,description,amount_cents,due_at,coverage_from,coverage_to,status)
values ('f3000000-0000-4000-8000-000000000060','f3000000-0000-4000-8000-000000000010','f3000000-0000-4000-8000-000000000030','f3000000-0000-4000-8000-000000000050','f3000000-0000-4000-8000-000000000020','Artificial initial charge',4600,'2026-10-05','2026-10-01','2026-10-31','pending');

select has_function('public','set_enrollment_contract_amount',array['uuid','integer','integer','date','text','uuid'],'RPC de condição contratual instalada');
select ok((select prosecdef from pg_proc where oid='public.set_enrollment_contract_amount(uuid,integer,integer,date,text,uuid)'::regprocedure),'RPC usa SECURITY DEFINER');
select ok(has_function_privilege('authenticated','public.set_enrollment_contract_amount(uuid,integer,integer,date,text,uuid)','EXECUTE'),'authenticated executa RPC com validação interna');
select ok(not has_function_privilege('anon','public.set_enrollment_contract_amount(uuid,integer,integer,date,text,uuid)','EXECUTE'),'anon não executa RPC');
select ok(not exists(select 1 from aclexplode((select proacl from pg_proc where oid='public.set_enrollment_contract_amount(uuid,integer,integer,date,text,uuid)'::regprocedure)) a where a.grantee=0 and a.privilege_type='EXECUTE'),'PUBLIC não executa RPC');
select has_function('public','create_enrollment_charge',array['jsonb','uuid'],'RPC de cobrança vinculada instalada');
select ok((select prosecdef from pg_proc where oid='public.create_enrollment_charge(jsonb,uuid)'::regprocedure),'RPC de criação usa SECURITY DEFINER');
select ok(position('for update' in lower(pg_get_functiondef('public.create_enrollment_charge(jsonb,uuid)'::regprocedure)))>0 and position('for update' in lower(pg_get_functiondef('public.set_enrollment_contract_amount(uuid,integer,integer,date,text,uuid)'::regprocedure)))>0,'criação de cobrança e edição recorrente serializam pela matrícula');
select ok(has_function_privilege('authenticated','public.create_enrollment_charge(jsonb,uuid)','EXECUTE'),'authenticated pode chamar criação com validação interna');
select ok(not has_function_privilege('anon','public.create_enrollment_charge(jsonb,uuid)','EXECUTE'),'anon não pode criar cobrança pela RPC');
select set_config('request.jwt.claim.sub','f3000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($$select public.set_enrollment_contract_amount('f3000000-0000-4000-8000-000000000050',null,22000,'2026-11-01','Contrato individual confirmado',gen_random_uuid())$$,'finance configura mensalidade individual futura');
reset role;
select is((select contract_amount_cents from public.enrollments where id='f3000000-0000-4000-8000-000000000050'),23500,'valor-base individual persiste em centavos preservando ajustes');
select is((select price_cents from public.plans where id='f3000000-0000-4000-8000-000000000040'),4600,'preço global do plano não muda');
select ok(exists(select from public.audit_events where entity_id='f3000000-0000-4000-8000-000000000050' and action='enrollment.contract_amount_changed' and metadata->>'amount_cents'='23500' and metadata->>'monthly_final_amount_cents'='22000' and metadata->>'effective_from'='2026-11-01' and metadata->>'reason'='Contrato individual confirmado'),'auditoria distingue valor-base de mensalidade final e registra a vigência');
set local role authenticated;
select lives_ok($$select public.create_enrollment_charge('{"patient_id":"f3000000-0000-4000-8000-000000000030","enrollment_id":"f3000000-0000-4000-8000-000000000050","unit_id":"f3000000-0000-4000-8000-000000000020","description":"Artificial next-month charge","due_at":"2026-11-05","coverage_from":"2026-11-01","coverage_to":"2026-11-30"}'::jsonb,gen_random_uuid())$$,'criação transacional lê contrato vigente');
select is((select amount_cents from public.charges where enrollment_id='f3000000-0000-4000-8000-000000000050' and coverage_from='2026-11-01'),22000,'mensalidade líquida configurada persiste após desconto e adicional');
select throws_ok($$select public.create_enrollment_charge('{"patient_id":"f3000000-0000-4000-8000-000000000030","enrollment_id":"f3000000-0000-4000-8000-000000000050","unit_id":"f3000000-0000-4000-8000-000000000020","description":"Duplicate artificial charge","due_at":"2026-11-05","coverage_from":"2026-11-01","coverage_to":"2026-11-30"}'::jsonb,gen_random_uuid())$$,'P0001','CHARGE_ALREADY_EXISTS','mesma cobertura não duplica cobrança');
select lives_ok($$select public.set_enrollment_contract_amount('f3000000-0000-4000-8000-000000000050',23500,22000,'2026-11-01','Cobrança futura já reconciliada',gen_random_uuid())$$,'cobrança futura já corrigida permite alinhar a recorrência');
select throws_ok($$select public.set_enrollment_contract_amount('f3000000-0000-4000-8000-000000000050',23500,23000,'2026-11-01','Concorrência de valor',gen_random_uuid())$$,'P0001','CONTRACT_HAS_FUTURE_CHARGES','cobrança futura impede trocar contrato silenciosamente');
reset role;
select set_config('request.jwt.claim.sub','f3000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select throws_ok($$select public.set_enrollment_contract_amount('f3000000-0000-4000-8000-000000000050',23500,23000,'2026-12-01','Usuário sem acesso',gen_random_uuid())$$,'P0001','FORBIDDEN','finance sem edição não altera valor recorrente');
reset role;
select set_config('request.jwt.claim.sub','f3000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select throws_ok($$select public.set_enrollment_contract_amount('f3000000-0000-4000-8000-000000000050',23500,23000,'2026-11-15','Data inválida',gen_random_uuid())$$,'P0001','INVALID_CONTRACT_TERMS','vigência exige primeiro dia do mês');
reset role;
create function pg_temp.fail_hf003_contract_audit() returns trigger language plpgsql as $$ begin if new.action='enrollment.contract_amount_changed' then raise exception 'ARTIFICIAL_CONTRACT_AUDIT_FAILURE'; end if; return new; end $$;
create trigger fail_hf003_contract_audit before insert on public.audit_events for each row execute function pg_temp.fail_hf003_contract_audit();
set local role authenticated;
select throws_ok($$select public.set_enrollment_contract_amount('f3000000-0000-4000-8000-000000000050',23500,23000,'2026-12-01','Falha artificial de auditoria',gen_random_uuid())$$,'P0001','ARTIFICIAL_CONTRACT_AUDIT_FAILURE','falha de auditoria reverte atualização contratual');
reset role;
select is((select contract_amount_cents from public.enrollments where id='f3000000-0000-4000-8000-000000000050'),23500,'rollback da auditoria mantém o valor anterior');
select * from finish();
rollback;
