-- Os horários pertencem à grade fixa; os dias pertencem à alocação do paciente.
alter table public.group_slot_memberships
  add column if not exists weekdays smallint[];

update public.group_slot_memberships membership
set weekdays = slot.weekdays
from public.group_slots slot
where slot.id = membership.group_slot_id
  and membership.weekdays is null;

alter table public.group_slot_memberships
  alter column weekdays set not null,
  drop constraint if exists group_slot_memberships_weekdays_check,
  add constraint group_slot_memberships_weekdays_check
    check (cardinality(weekdays) between 1 and 5 and weekdays <@ array[1,2,3,4,5]::smallint[]);

-- Migra vínculos de turmas antigas (por dias) para o horário fixo equivalente.
-- O vínculo preserva os dias antigos e passa a poder ser editado por paciente.
do $$
declare
  legacy_slot record;
  fixed_slot_id uuid;
  membership_record record;
  existing_membership record;
begin
  for legacy_slot in
    select legacy.id, legacy.clinic_id, legacy.unit_id, legacy.starts_at
    from public.group_slots legacy
    where legacy.deleted_at is null
      and legacy.active = true
      and legacy.name !~* '^Horário fixo'
  loop
    select fixed.id into fixed_slot_id
    from public.group_slots fixed
    where fixed.clinic_id = legacy_slot.clinic_id
      and fixed.unit_id = legacy_slot.unit_id
      and fixed.starts_at = legacy_slot.starts_at
      and fixed.deleted_at is null
      and fixed.active = true
      and fixed.name ~* '^Horário fixo'
    order by fixed.created_at
    limit 1;

    if fixed_slot_id is null then
      continue;
    end if;

    for membership_record in
      select *
      from public.group_slot_memberships
      where group_slot_id = legacy_slot.id
        and deleted_at is null
        and status = 'active'
    loop
      select * into existing_membership
      from public.group_slot_memberships
      where group_slot_id = fixed_slot_id
        and patient_id = membership_record.patient_id
        and deleted_at is null
        and status = 'active'
      order by created_at
      limit 1;

      if existing_membership.id is not null then
        update public.group_slot_memberships
        set weekdays = (
              select array_agg(distinct day order by day)::smallint[]
              from unnest(existing_membership.weekdays || membership_record.weekdays) day
            ),
            starts_at = least(existing_membership.starts_at, membership_record.starts_at),
            ends_at = case
              when existing_membership.ends_at is null or membership_record.ends_at is null then null
              else greatest(existing_membership.ends_at, membership_record.ends_at)
            end,
            updated_at = now()
        where id = existing_membership.id;

        update public.group_slot_memberships
        set status = 'cancelled', deleted_at = now(), updated_at = now()
        where id = membership_record.id;
      else
        update public.group_slot_memberships
        set group_slot_id = fixed_slot_id, updated_at = now()
        where id = membership_record.id;
      end if;
    end loop;

    update public.group_slots
    set active = false, deleted_at = now(), updated_at = now()
    where id = legacy_slot.id;
  end loop;
end $$;

create index if not exists group_slot_memberships_weekdays_idx
  on public.group_slot_memberships using gin (weekdays)
  where deleted_at is null and status = 'active';
