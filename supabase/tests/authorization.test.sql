begin;
select plan(39);

-- Fixtures integradas: cinco papéis reais, duas unidades e dados sensíveis.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email, crypt('test-only', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'admin.authorization@fisiofit.test'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'manager.authorization@fisiofit.test'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'reception.authorization@fisiofit.test'),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'professional.authorization@fisiofit.test'),
  ('a0000000-0000-4000-8000-000000000005'::uuid, 'finance.authorization@fisiofit.test')
) fixture_users(id, email);

insert into public.units (id, clinic_id, name)
select fixture.id, clinic.id, fixture.name
from (select id from public.clinics order by created_at limit 1) clinic
cross join (values
  ('b0000000-0000-4000-8000-000000000001'::uuid, 'Unidade RLS A'),
  ('b0000000-0000-4000-8000-000000000002'::uuid, 'Unidade RLS B')
) fixture(id, name);

insert into public.profiles (id, clinic_id, name, role, status)
select fixture.id, clinic.id, fixture.name, fixture.role::public.user_role, 'active'
from (select id from public.clinics order by created_at limit 1) clinic
cross join (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'Admin RLS', 'admin'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'Manager RLS', 'manager'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'Reception RLS', 'reception'),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'Professional RLS', 'professional'),
  ('a0000000-0000-4000-8000-000000000005'::uuid, 'Finance RLS', 'finance')
) fixture(id, name, role);

insert into public.profile_units (profile_id, unit_id)
select profile_id, 'b0000000-0000-4000-8000-000000000001'::uuid
from unnest(array[
  'a0000000-0000-4000-8000-000000000002'::uuid,
  'a0000000-0000-4000-8000-000000000003'::uuid,
  'a0000000-0000-4000-8000-000000000004'::uuid,
  'a0000000-0000-4000-8000-000000000005'::uuid
]) profile_id;

insert into public.professionals (id, clinic_id, profile_id, name)
select 'c0000000-0000-4000-8000-000000000001', id, 'a0000000-0000-4000-8000-000000000004', 'Professional RLS'
from public.clinics order by created_at limit 1;
insert into public.professionals (id, clinic_id, name)
select 'c0000000-0000-4000-8000-000000000002', id, 'Outro Professional RLS'
from public.clinics order by created_at limit 1;
insert into public.professional_units (professional_id, unit_id) values
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001');

insert into public.patients (id, clinic_id, primary_unit_id, name)
select fixture.id, clinic.id, fixture.unit_id, fixture.name
from (select id from public.clinics order by created_at limit 1) clinic
cross join (values
  ('d0000000-0000-4000-8000-000000000001'::uuid, 'b0000000-0000-4000-8000-000000000001'::uuid, 'Paciente RLS A'),
  ('d0000000-0000-4000-8000-000000000002'::uuid, 'b0000000-0000-4000-8000-000000000002'::uuid, 'Paciente RLS B')
) fixture(id, unit_id, name);

insert into public.financial_entries (id, clinic_id, unit_id, kind, description, category, amount_cents, competence_date)
select fixture.id, clinic.id, fixture.unit_id, 'income', fixture.description, 'Teste RLS', 10000, current_date
from (select id from public.clinics order by created_at limit 1) clinic
cross join (values
  ('e0000000-0000-4000-8000-000000000001'::uuid, 'b0000000-0000-4000-8000-000000000001'::uuid, 'Financeiro unidade A'),
  ('e0000000-0000-4000-8000-000000000002'::uuid, 'b0000000-0000-4000-8000-000000000002'::uuid, 'Financeiro unidade B')
) fixture(id, unit_id, description);

insert into public.clinical_records (id, clinic_id, patient_id, professional_id, unit_id, kind, payload)
select fixture.id, clinic.id, fixture.patient_id, fixture.professional_id, fixture.unit_id, 'evolution', '{}'::jsonb
from (select id from public.clinics order by created_at limit 1) clinic
cross join (values
  ('f0000000-0000-4000-8000-000000000001'::uuid, 'd0000000-0000-4000-8000-000000000001'::uuid, 'c0000000-0000-4000-8000-000000000001'::uuid, 'b0000000-0000-4000-8000-000000000001'::uuid),
  ('f0000000-0000-4000-8000-000000000002'::uuid, 'd0000000-0000-4000-8000-000000000001'::uuid, 'c0000000-0000-4000-8000-000000000002'::uuid, 'b0000000-0000-4000-8000-000000000001'::uuid),
  ('f0000000-0000-4000-8000-000000000003'::uuid, 'd0000000-0000-4000-8000-000000000002'::uuid, 'c0000000-0000-4000-8000-000000000001'::uuid, 'b0000000-0000-4000-8000-000000000002'::uuid)
) fixture(id, patient_id, professional_id, unit_id);

select ok(
  not exists (select 1 from pg_policies where schemaname = 'public' and policyname like '%_clinic_select'),
  'políticas amplas baseadas somente na clínica foram removidas'
);

select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'patients' and policyname = 'patients_select'), 'patients possui política de leitura restritiva');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'appointments' and policyname = 'appointments_select'), 'appointments possui política de leitura restritiva');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'clinical_records' and policyname = 'clinical_records_select'), 'prontuário possui política clínica');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'financial_entries' and policyname = 'financial_entries_access'), 'financeiro possui política própria');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profile_permissions' and policyname = 'profile_permissions_admin_write'), 'permissões possuem política administrativa');

select ok(
  not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'profile_permissions'
       and policyname = 'profile_permissions_admin_write'
       and trim(with_check) = 'true'
  ),
  'profile_permissions não usa WITH CHECK true'
);

select ok(
  (select qual like '%has_unit_access%' from pg_policies where schemaname = 'public' and tablename = 'appointments' and policyname = 'appointments_select'),
  'leitura da agenda valida unidade'
);
select ok(
  (select qual like '%current_professional_id%' from pg_policies where schemaname = 'public' and tablename = 'clinical_records' and policyname = 'clinical_records_select'),
  'leitura de prontuário limita o profissional'
);
select ok(
  (select qual like '%finance%' from pg_policies where schemaname = 'public' and tablename = 'financial_entries' and policyname = 'financial_entries_access'),
  'política financeira exige papel financeiro'
);

select ok((select prosecdef from pg_proc where oid = 'public.complete_appointment(uuid,uuid)'::regprocedure), 'complete_appointment é SECURITY DEFINER');
select ok((select prosecdef from pg_proc where oid = 'public.register_payment(uuid,integer,text,timestamptz,text,uuid)'::regprocedure), 'register_payment é SECURITY DEFINER');
select ok((select prosecdef from pg_proc where oid = 'public.reverse_payment(uuid,text,uuid)'::regprocedure), 'reverse_payment é SECURITY DEFINER');
select ok((select prosecdef from pg_proc where oid = 'public.rollback_import_batch(uuid,text,uuid)'::regprocedure), 'rollback_import_batch é SECURITY DEFINER');
select ok((select prosecdef from pg_proc where oid = 'public.approve_commission(uuid,uuid)'::regprocedure), 'approve_commission é SECURITY DEFINER');
select ok((select prosecdef from pg_proc where oid = 'public.import_rows_transactional(text,text,uuid,jsonb,jsonb,jsonb,text,uuid)'::regprocedure), 'import_rows_transactional é SECURITY DEFINER');

select ok(not has_function_privilege('anon', 'public.complete_appointment(uuid,uuid)', 'EXECUTE'), 'anon não executa complete_appointment');
select ok(not has_function_privilege('anon', 'public.register_payment(uuid,integer,text,timestamptz,text,uuid)', 'EXECUTE'), 'anon não executa register_payment');
select ok(not has_function_privilege('anon', 'public.reverse_payment(uuid,text,uuid)', 'EXECUTE'), 'anon não executa reverse_payment');
select ok(not has_function_privilege('anon', 'public.rollback_import_batch(uuid,text,uuid)', 'EXECUTE'), 'anon não executa rollback_import_batch');
select ok(not has_function_privilege('anon', 'public.approve_commission(uuid,uuid)', 'EXECUTE'), 'anon não executa approve_commission');
select ok(not has_function_privilege('anon', 'public.import_rows_transactional(text,text,uuid,jsonb,jsonb,jsonb,text,uuid)', 'EXECUTE'), 'anon não executa import_rows_transactional');

select ok(has_function_privilege('authenticated', 'public.complete_appointment(uuid,uuid)', 'EXECUTE'), 'authenticated pode chamar complete_appointment sujeito à validação interna');
select ok(has_function_privilege('authenticated', 'public.register_payment(uuid,integer,text,timestamptz,text,uuid)', 'EXECUTE'), 'authenticated pode chamar register_payment sujeito à validação interna');

select ok(exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'clinical_files_select'), 'arquivos clínicos possuem política de leitura');
select ok(exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'financial_files_select'), 'arquivos financeiros possuem política de leitura');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'audit_events' and policyname = 'audit_events_insert'), 'auditoria exige política de inserção');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profile_units' and policyname = 'profile_units_admin_write'), 'vínculos de unidade possuem política administrativa');

select is((select count(*) from public.profiles where id between 'a0000000-0000-4000-8000-000000000001' and 'a0000000-0000-4000-8000-000000000005'), 5::bigint, 'fixtures cobrem os cinco papéis');
select is((select count(*) from public.units where id in ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002')), 2::bigint, 'fixtures cobrem unidades distintas');

set local role authenticated;

set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000004';
select is((select count(*) from public.financial_entries), 0::bigint, 'profissional não acessa o financeiro');
select is((select count(*) from public.clinical_records), 1::bigint, 'profissional acessa somente o próprio prontuário na unidade vinculada');

set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000003';
select is((select count(*) from public.clinical_records), 0::bigint, 'recepção não acessa dados de prontuário');

set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000005';
select is((select count(*) from public.financial_entries), 1::bigint, 'financeiro acessa lançamentos da unidade vinculada');
select is((select count(*) from public.financial_entries where unit_id = 'b0000000-0000-4000-8000-000000000002'), 0::bigint, 'financeiro não atravessa unidades');

set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000002';
select is((select count(*) from public.clinical_records), 2::bigint, 'manager acessa prontuários da unidade vinculada');
select is((select count(*) from public.clinical_records where unit_id = 'b0000000-0000-4000-8000-000000000002'), 0::bigint, 'manager não atravessa unidades');

set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000001';
select is((select count(*) from public.financial_entries), 2::bigint, 'admin acessa o financeiro de todas as unidades da clínica');
select is((select count(*) from public.clinical_records), 3::bigint, 'admin acessa os prontuários de todas as unidades da clínica');

select * from finish();
rollback;
