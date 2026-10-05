-- Synthetic DEV-only legacy fixture for INFRA-DEV-001. Never run against production.
do $$
declare clinic uuid; cutoff date := current_date - extract(dow from current_date)::integer;
begin
  select id into clinic from public.clinics where deleted_at is null order by created_at limit 1;
  insert into public.units (id, clinic_id, name) values ('11111111-1111-4111-8111-111111111111', clinic, 'Unidade DEV') on conflict (id) do nothing;
  insert into public.services (id, clinic_id, name, duration_minutes, price_cents) values ('66666666-6666-4666-8666-666666666666', clinic, 'Pilates DEV', 60, 0) on conflict (id) do nothing;
  insert into public.rooms (id, clinic_id, unit_id, name, capacity) values
    ('44444444-4444-4444-8444-444444444444', clinic, '11111111-1111-4111-8111-111111111111', 'Sala DEV A', 8),
    ('55555555-5555-4555-8555-555555555555', clinic, '11111111-1111-4111-8111-111111111111', 'Sala DEV B', 8)
  on conflict (id) do nothing;
  insert into public.professionals (id, clinic_id, name) values
    ('22222222-2222-4222-8222-222222222222', clinic, 'Profissional DEV Ana'),
    ('33333333-3333-4333-8333-333333333333', clinic, 'Profissional DEV Bia')
  on conflict (id) do nothing;
  insert into public.professional_units (professional_id, unit_id) values
    ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111'),
    ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111')
  on conflict do nothing;
  insert into public.patients (id, clinic_id, primary_unit_id, name) values
    ('70000000-0000-4000-8000-000000000001', clinic, '11111111-1111-4111-8111-111111111111', 'Paciente DEV 01'),
    ('70000000-0000-4000-8000-000000000002', clinic, '11111111-1111-4111-8111-111111111111', 'Paciente DEV 02'),
    ('70000000-0000-4000-8000-000000000003', clinic, '11111111-1111-4111-8111-111111111111', 'Paciente DEV 03'),
    ('70000000-0000-4000-8000-000000000004', clinic, '11111111-1111-4111-8111-111111111111', 'Paciente DEV 04'),
    ('70000000-0000-4000-8000-000000000005', clinic, '11111111-1111-4111-8111-111111111111', 'Paciente DEV 05'),
    ('70000000-0000-4000-8000-000000000006', clinic, '11111111-1111-4111-8111-111111111111', 'Paciente DEV 06'),
    ('70000000-0000-4000-8000-000000000007', clinic, '11111111-1111-4111-8111-111111111111', 'Paciente DEV 07'),
    ('70000000-0000-4000-8000-000000000008', clinic, '11111111-1111-4111-8111-111111111111', 'Paciente DEV 08'),
    ('70000000-0000-4000-8000-000000000009', clinic, '11111111-1111-4111-8111-111111111111', 'Paciente DEV 09'),
    ('70000000-0000-4000-8000-000000000010', clinic, '11111111-1111-4111-8111-111111111111', 'Paciente DEV 10')
  on conflict (id) do nothing;
  insert into public.group_slots (id, clinic_id, unit_id, room_id, professional_id, service_id, name, weekdays, starts_at, duration_minutes, capacity) values
    ('80000000-0000-4000-8000-000000000001', clinic, '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222', '66666666-6666-4666-8666-666666666666', 'Turma DEV A', array[1,3]::smallint[], '08:00', 60, 4),
    ('80000000-0000-4000-8000-000000000002', clinic, '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222', '66666666-6666-4666-8666-666666666666', 'Turma DEV B', array[2,4]::smallint[], '08:00', 60, 3),
    ('80000000-0000-4000-8000-000000000003', clinic, '11111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555555', '33333333-3333-4333-8333-333333333333', '66666666-6666-4666-8666-666666666666', 'Turma DEV C', array[5]::smallint[], '10:00', 60, 3)
  on conflict (id) do nothing;
  insert into public.group_slot_memberships (clinic_id, group_slot_id, patient_id, weekdays, starts_at) values
    (clinic, '80000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', array[1,3]::smallint[], cutoff),
    (clinic, '80000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000002', array[1,3]::smallint[], cutoff),
    (clinic, '80000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000003', array[1,3]::smallint[], cutoff),
    (clinic, '80000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000004', array[1,3]::smallint[], cutoff),
    (clinic, '80000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000005', array[2,4]::smallint[], cutoff),
    (clinic, '80000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000006', array[2,4]::smallint[], cutoff),
    (clinic, '80000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000007', array[2,4]::smallint[], cutoff),
    (clinic, '80000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000008', array[5]::smallint[], cutoff),
    (clinic, '80000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000009', array[5]::smallint[], cutoff),
    (clinic, '80000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000010', array[5]::smallint[], cutoff)
  on conflict (group_slot_id, patient_id, starts_at) do nothing;
end $$;
