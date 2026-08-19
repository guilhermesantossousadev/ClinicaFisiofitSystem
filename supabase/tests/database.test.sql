begin;
select plan(15);

select has_table('public', 'patients', 'pacientes existe');
select has_table('public', 'group_slots', 'turmas semanais existem');
select has_table('public', 'group_slot_memberships', 'vínculos de alunos às turmas existem');
select has_column('public', 'group_slot_memberships', 'weekdays', 'vínculo da turma guarda os dias do paciente');
select has_table('public', 'clinical_records', 'prontuário existe');
select has_function('public', 'register_payment', 'pagamento transacional existe');
select has_function('public', 'complete_appointment', 'conclusão idempotente de atendimento existe');
select has_function('public', 'approve_commission', 'aprovação transacional de comissão existe');
select has_function('public', 'import_rows_transactional', 'importação transacional em lote existe');
select has_function('public', 'check_appointment_conflict', 'verificação de conflito existe');
select has_column('public', 'clinics', 'owner_profile_id', 'clínica possui conta proprietária');
select has_table('public', 'data_subject_requests', 'solicitações LGPD existem');
select has_table('public', 'privacy_incidents', 'incidentes de privacidade existem');
select has_table('public', 'class_attendances', 'chamadas diárias existem');
select has_trigger('public', 'profiles', 'profiles_protect_clinic_owner', 'conta proprietária é protegida no banco');

select col_default_is(
  'public',
  'group_slots',
  'capacity',
  '7',
  'capacidade padrão da turma é sete'
);

select * from finish();
rollback;
