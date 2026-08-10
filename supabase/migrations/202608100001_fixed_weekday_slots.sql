-- Cria a grade semanal fixa das unidades.
-- Sala, profissional e serviço são atribuídos posteriormente.

alter table public.group_slots
  alter column room_id drop not null,
  alter column professional_id drop not null,
  alter column service_id drop not null;

do $$
declare
  unit_record record;
  slot_hour integer;
begin
  for unit_record in
    select id, clinic_id
    from public.units
    where deleted_at is null
  loop
    for slot_hour in 6..20 loop
      insert into public.group_slots (
        clinic_id,
        unit_id,
        room_id,
        professional_id,
        service_id,
        name,
        weekdays,
        starts_at,
        duration_minutes,
        capacity
      )
      select
        unit_record.clinic_id,
        unit_record.id,
        null,
        null,
        null,
        format('Horário fixo %s:00', lpad(slot_hour::text, 2, '0')),
        array[1, 2, 3, 4, 5]::smallint[],
        make_time(slot_hour, 0, 0),
        60,
        7
      where not exists (
        select 1
        from public.group_slots existing
        where existing.clinic_id = unit_record.clinic_id
          and existing.unit_id = unit_record.id
          and existing.starts_at = make_time(slot_hour, 0, 0)
          and existing.weekdays = array[1, 2, 3, 4, 5]::smallint[]
          and existing.deleted_at is null
      );
    end loop;
  end loop;
end $$;
