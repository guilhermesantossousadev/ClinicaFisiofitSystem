-- Os horários continuam fixos, mas cada combinação de dias representa uma turma.
-- O paciente pertence à turma inteira; os dias não são mais escolhidos por aluno.

do $$
declare
  fixed_slot record;
  member_days smallint[];
  class_slot_id uuid;
  days_label text;
begin
  for fixed_slot in
    select *
    from public.group_slots
    where deleted_at is null
      and active = true
      and name ~* '^Horário fixo'
  loop
    for member_days in
      select distinct membership.weekdays
      from public.group_slot_memberships membership
      where membership.group_slot_id = fixed_slot.id
        and membership.deleted_at is null
        and membership.status = 'active'
    loop
      select string_agg(
        case day
          when 1 then 'Seg'
          when 2 then 'Ter'
          when 3 then 'Qua'
          when 4 then 'Qui'
          when 5 then 'Sex'
        end,
        '/' order by day
      ) into days_label
      from unnest(member_days) day;

      insert into public.group_slots (
        clinic_id,
        unit_id,
        room_id,
        professional_id,
        service_id,
        name,
        weekdays,
        starts_at,
        starts_on,
        ends_on,
        duration_minutes,
        capacity,
        active
      ) values (
        fixed_slot.clinic_id,
        fixed_slot.unit_id,
        fixed_slot.room_id,
        fixed_slot.professional_id,
        fixed_slot.service_id,
        format('Turma %s %s', days_label, to_char(fixed_slot.starts_at, 'HH24:MI')),
        member_days,
        fixed_slot.starts_at,
        fixed_slot.starts_on,
        fixed_slot.ends_on,
        fixed_slot.duration_minutes,
        fixed_slot.capacity,
        true
      ) returning id into class_slot_id;

      update public.group_slot_memberships
      set group_slot_id = class_slot_id,
          weekdays = member_days,
          updated_at = now()
      where group_slot_id = fixed_slot.id
        and weekdays = member_days
        and deleted_at is null
        and status = 'active';

      update public.class_attendances attendance
      set group_slot_id = class_slot_id,
          updated_at = now()
      from public.group_slot_memberships membership
      where attendance.membership_id = membership.id
        and membership.group_slot_id = class_slot_id;
    end loop;

    update public.group_slots
    set active = false,
        deleted_at = now(),
        updated_at = now()
    where id = fixed_slot.id;
  end loop;
end $$;

create or replace function public.sync_membership_weekdays_from_group()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select weekdays into new.weekdays
  from public.group_slots
  where id = new.group_slot_id;

  return new;
end;
$$;

drop trigger if exists group_slot_membership_sync_weekdays on public.group_slot_memberships;
create trigger group_slot_membership_sync_weekdays
before insert or update of group_slot_id on public.group_slot_memberships
for each row execute function public.sync_membership_weekdays_from_group();

create or replace function public.propagate_group_weekdays_to_members()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.group_slot_memberships
  set weekdays = new.weekdays,
      updated_at = now()
  where group_slot_id = new.id
    and deleted_at is null
    and status = 'active';

  return new;
end;
$$;

drop trigger if exists group_slot_propagate_weekdays on public.group_slots;
create trigger group_slot_propagate_weekdays
after update of weekdays on public.group_slots
for each row
when (old.weekdays is distinct from new.weekdays)
execute function public.propagate_group_weekdays_to_members();
