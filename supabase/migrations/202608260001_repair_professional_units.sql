-- Reconstitui vínculos de unidade comprovados pelo histórico operacional.
-- Isso corrige profissionais ativos que já atendem na unidade, mas perderam o
-- registro correspondente em professional_units durante migrações anteriores.
insert into public.professional_units (professional_id, unit_id)
select distinct source.professional_id, source.unit_id
from (
  select professional_id, unit_id from public.group_slots
  where professional_id is not null and deleted_at is null
  union
  select professional_id, unit_id from public.appointments
  where professional_id is not null and deleted_at is null
  union
  select professional_id, unit_id from public.clinical_records
  where professional_id is not null and deleted_at is null
  union
  select professional_id, unit_id from public.commissions
  where professional_id is not null
) source
join public.professionals professional on professional.id = source.professional_id
join public.units unit on unit.id = source.unit_id
where professional.clinic_id = unit.clinic_id
  and professional.deleted_at is null
  and unit.deleted_at is null
on conflict do nothing;

-- Em clínicas com uma única unidade, um profissional sem qualquer vínculo só
-- pode pertencer àquela unidade. O backfill evita um estado impossível de
-- corrigir pela Agenda para cadastros antigos.
insert into public.professional_units (professional_id, unit_id)
select professional.id, min(unit.id::text)::uuid
from public.professionals professional
join public.units unit
  on unit.clinic_id = professional.clinic_id
 and unit.deleted_at is null
 and unit.active = true
where professional.deleted_at is null
  and not exists (
    select 1 from public.professional_units link
    where link.professional_id = professional.id
  )
group by professional.id
having count(unit.id) = 1
on conflict do nothing;
