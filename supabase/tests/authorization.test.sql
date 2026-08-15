begin;
select plan(24);

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

select ok(not has_function_privilege('anon', 'public.complete_appointment(uuid,uuid)', 'EXECUTE'), 'anon não executa complete_appointment');
select ok(not has_function_privilege('anon', 'public.register_payment(uuid,integer,text,timestamptz,text,uuid)', 'EXECUTE'), 'anon não executa register_payment');
select ok(not has_function_privilege('anon', 'public.reverse_payment(uuid,text,uuid)', 'EXECUTE'), 'anon não executa reverse_payment');
select ok(not has_function_privilege('anon', 'public.rollback_import_batch(uuid,text,uuid)', 'EXECUTE'), 'anon não executa rollback_import_batch');

select ok(has_function_privilege('authenticated', 'public.complete_appointment(uuid,uuid)', 'EXECUTE'), 'authenticated pode chamar complete_appointment sujeito à validação interna');
select ok(has_function_privilege('authenticated', 'public.register_payment(uuid,integer,text,timestamptz,text,uuid)', 'EXECUTE'), 'authenticated pode chamar register_payment sujeito à validação interna');

select ok(exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'clinical_files_select'), 'arquivos clínicos possuem política de leitura');
select ok(exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'financial_files_select'), 'arquivos financeiros possuem política de leitura');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'audit_events' and policyname = 'audit_events_insert'), 'auditoria exige política de inserção');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profile_units' and policyname = 'profile_units_admin_write'), 'vínculos de unidade possuem política administrativa');

select * from finish();
rollback;
