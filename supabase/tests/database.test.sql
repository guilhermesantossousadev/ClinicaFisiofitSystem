begin;
select plan(8);

select has_table('public', 'patients', 'pacientes existe');
select has_table('public', 'group_slots', 'turmas semanais existem');
select has_table('public', 'group_slot_memberships', 'vínculos de alunos às turmas existem');
select has_table('public', 'clinical_records', 'prontuário existe');
select has_function('public', 'register_payment', 'pagamento transacional existe');
select has_function('public', 'complete_appointment', 'conclusão idempotente de atendimento existe');
select has_function('public', 'check_appointment_conflict', 'verificação de conflito existe');

select col_default_is(
  'public',
  'group_slots',
  'capacity',
  '7',
  'capacidade padrão da turma é sete'
);

select * from finish();
rollback;
