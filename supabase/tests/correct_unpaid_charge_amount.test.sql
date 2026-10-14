begin;
select plan(17);

insert into auth.users(id) values
 ('f2000000-0000-4000-8000-000000000001'),
 ('f2000000-0000-4000-8000-000000000002');
alter table public.clinics alter column owner_profile_id drop not null;
insert into public.clinics(id,name,owner_profile_id) values ('f2000000-0000-4000-8000-000000000010','Artificial charge correction clinic',null);
insert into public.profiles(id,clinic_id,name,role,status) values
 ('f2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000010','Artificial finance editor','finance','active'),
 ('f2000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000010','Artificial finance viewer','finance','active');
update public.clinics set owner_profile_id='f2000000-0000-4000-8000-000000000001' where id='f2000000-0000-4000-8000-000000000010';
alter table public.clinics alter column owner_profile_id set not null;
insert into public.units(id,clinic_id,name) values ('f2000000-0000-4000-8000-000000000020','f2000000-0000-4000-8000-000000000010','Artificial unit');
insert into public.profile_units(profile_id,unit_id) values
 ('f2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000020'),
 ('f2000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000020');
insert into public.profile_permissions(profile_id,module,can_view,can_edit) values
 ('f2000000-0000-4000-8000-000000000001','finance',true,true),
 ('f2000000-0000-4000-8000-000000000002','finance',true,false),
 ('f2000000-0000-4000-8000-000000000001','enrollments',true,false),
 ('f2000000-0000-4000-8000-000000000002','enrollments',true,false);
insert into public.patients(id,clinic_id,primary_unit_id,name) values
 ('f2000000-0000-4000-8000-000000000030','f2000000-0000-4000-8000-000000000010','f2000000-0000-4000-8000-000000000020','Artificial patient one'),
 ('f2000000-0000-4000-8000-000000000031','f2000000-0000-4000-8000-000000000010','f2000000-0000-4000-8000-000000000020','Artificial patient two');
insert into public.charges(id,clinic_id,patient_id,unit_id,description,amount_cents,due_at,status) values
 ('f2000000-0000-4000-8000-000000000040','f2000000-0000-4000-8000-000000000010','f2000000-0000-4000-8000-000000000030','f2000000-0000-4000-8000-000000000020','Artificial current month',4600,'2026-10-05','pending'),
 ('f2000000-0000-4000-8000-000000000041','f2000000-0000-4000-8000-000000000010','f2000000-0000-4000-8000-000000000030','f2000000-0000-4000-8000-000000000020','Artificial paid charge',4600,'2026-10-05','pending'),
 ('f2000000-0000-4000-8000-000000000042','f2000000-0000-4000-8000-000000000010','f2000000-0000-4000-8000-000000000031','f2000000-0000-4000-8000-000000000020','Artificial other patient',4600,'2026-10-05','pending'),
 ('f2000000-0000-4000-8000-000000000043','f2000000-0000-4000-8000-000000000010','f2000000-0000-4000-8000-000000000030','f2000000-0000-4000-8000-000000000020','Artificial next month',4600,'2026-11-05','pending');
insert into public.payments(id,clinic_id,charge_id,amount_cents,method,paid_at,idempotency_key) values
 ('f2000000-0000-4000-8000-000000000050','f2000000-0000-4000-8000-000000000010','f2000000-0000-4000-8000-000000000041',1000,'pix','2026-10-05T12:00:00Z','hf002-artificial-payment');

select has_function('public', 'correct_unpaid_charge_amount', array['uuid','integer','integer','text','uuid'], 'RPC de correção é instalada');
select ok((select prosecdef from pg_proc where oid='public.correct_unpaid_charge_amount(uuid,integer,integer,text,uuid)'::regprocedure), 'RPC usa SECURITY DEFINER com escopo explícito');
select ok(has_function_privilege('authenticated','public.correct_unpaid_charge_amount(uuid,integer,integer,text,uuid)','EXECUTE'), 'authenticated pode executar a RPC validada internamente');
select ok(not has_function_privilege('anon','public.correct_unpaid_charge_amount(uuid,integer,integer,text,uuid)','EXECUTE'), 'anon não pode executar a RPC');
select ok(not exists(select 1 from aclexplode((select proacl from pg_proc where oid='public.correct_unpaid_charge_amount(uuid,integer,integer,text,uuid)'::regprocedure)) a where a.grantee=0 and a.privilege_type='EXECUTE'), 'PUBLIC não recebeu EXECUTE');
select ok(position('for update' in lower(pg_get_functiondef('public.correct_unpaid_charge_amount(uuid,integer,integer,text,uuid)'::regprocedure)))>0, 'RPC serializa edição e recebimento pelo lock da cobrança');

select set_config('request.jwt.claim.sub','f2000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($$select public.correct_unpaid_charge_amount('f2000000-0000-4000-8000-000000000040',4600,22000,'Valor contratual confirmado',gen_random_uuid())$$, 'R$ 46,00 fictícios podem ser corrigidos para R$ 220,00');
select is((select amount_cents from public.charges where id='f2000000-0000-4000-8000-000000000040'),22000,'22000 centavos ficam persistidos');
reset role;
select ok(exists(select from public.audit_events where entity_id='f2000000-0000-4000-8000-000000000040' and action='charge.amount_corrected' and user_id=auth.uid() and metadata->>'previous_amount_cents'='4600' and metadata->>'amount_cents'='22000' and metadata->>'reason'='Valor contratual confirmado'),'auditoria inclui usuário, valor anterior/novo e justificativa');
set local role authenticated;
select throws_ok($$select public.correct_unpaid_charge_amount('f2000000-0000-4000-8000-000000000041',4600,22000,'Cobrança possui pagamento',gen_random_uuid())$$,'P0001','CHARGE_HAS_PAYMENTS','recebimento vinculado impede edição');
select throws_ok($$select public.correct_unpaid_charge_amount('f2000000-0000-4000-8000-000000000040',4600,23000,'Valor desatualizado',gen_random_uuid())$$,'P0001','CHARGE_AMOUNT_CONFLICT','valor anterior protege contra edição concorrente/obsoleta');
select throws_ok($$select public.correct_unpaid_charge_amount('f2000000-0000-4000-8000-000000000042',4600,22000,'',gen_random_uuid())$$,'P0001','CHARGE_REASON_REQUIRED','justificativa é obrigatória');
select is((select amount_cents from public.charges where id='f2000000-0000-4000-8000-000000000042'),4600,'outra paciente permanece inalterada');
select is((select amount_cents from public.charges where id='f2000000-0000-4000-8000-000000000043'),4600,'cobrança do próximo mês permanece inalterada');

reset role;
create function pg_temp.fail_hf002_audit() returns trigger language plpgsql as $$ begin raise exception 'ARTIFICIAL_AUDIT_FAILURE'; end $$;
create trigger fail_hf002_audit before insert on public.audit_events for each row execute function pg_temp.fail_hf002_audit();
set local role authenticated;
select throws_ok($$select public.correct_unpaid_charge_amount('f2000000-0000-4000-8000-000000000040',22000,23000,'Rollback on audit failure',gen_random_uuid())$$,'P0001','ARTIFICIAL_AUDIT_FAILURE','falha ao auditar reverte toda a edição');
select is((select amount_cents from public.charges where id='f2000000-0000-4000-8000-000000000040'),22000,'falha na auditoria preserva o valor anterior');
reset role;
select set_config('request.jwt.claim.sub','f2000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select throws_ok($$select public.correct_unpaid_charge_amount('f2000000-0000-4000-8000-000000000042',4600,22000,'Sem permissão financeira',gen_random_uuid())$$,'P0001','FORBIDDEN','finance sem can_edit não pode alterar');

select * from finish();
rollback;
