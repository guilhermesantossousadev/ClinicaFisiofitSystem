-- AGENDA-008: explicit, idempotent operational backfill. It never mutates legacy rows.

alter table public.classes add column if not exists legacy_source text;
alter table public.classes add column if not exists legacy_source_id uuid;
alter table public.class_schedules add column if not exists legacy_source text;
alter table public.class_schedules add column if not exists legacy_source_id uuid;
alter table public.class_memberships add column if not exists legacy_source text;
alter table public.class_memberships add column if not exists legacy_source_id uuid;

create unique index if not exists classes_legacy_source_unique
  on public.classes (clinic_id, legacy_source, legacy_source_id)
  where legacy_source is not null and legacy_source_id is not null;
create unique index if not exists class_schedules_legacy_source_unique
  on public.class_schedules (clinic_id, legacy_source, legacy_source_id)
  where legacy_source is not null and legacy_source_id is not null;
create unique index if not exists class_memberships_legacy_source_unique
  on public.class_memberships (clinic_id, legacy_source, legacy_source_id)
  where legacy_source is not null and legacy_source_id is not null;

create or replace function public.backfill_active_group_slots_to_classes(
  p_cutoff date default (current_date - extract(dow from current_date)::integer),
  p_weeks integer default 8
) returns table(
  group_slots_active integer, classes_created integer, classes_reused integer,
  schedules_created integer, schedules_reused integer, memberships_migrated integer,
  memberships_reused integer, occurrences_generated integer, occurrences_existing integer,
  failures integer, ignored integer
)
language plpgsql security definer set search_path = ''
as $$
declare
  slot record; membership record; target_class public.classes; target_schedule public.class_schedules;
  effective_from date; effective_to date; membership_from date; membership_to date;
  result record;
begin
  if p_weeks < 1 or p_weeks > 12 then raise exception 'INVALID_OCCURRENCE_WINDOW'; end if;
  if not public.has_role(array['admin']::public.user_role[]) then raise exception 'FORBIDDEN'; end if;
  group_slots_active := 0; classes_created := 0; classes_reused := 0; schedules_created := 0; schedules_reused := 0;
  memberships_migrated := 0; memberships_reused := 0; occurrences_generated := 0; occurrences_existing := 0; failures := 0; ignored := 0;

  for slot in
    select gs.*
      from public.group_slots gs
     where gs.clinic_id = public.current_clinic_id()
       and gs.active and gs.deleted_at is null
  loop
    group_slots_active := group_slots_active + 1;
    effective_from := greatest(p_cutoff, coalesce(slot.starts_on, p_cutoff));
    effective_to := case when slot.ends_on is null then null else slot.ends_on + 1 end;
    if effective_to is not null and effective_from >= effective_to then ignored := ignored + 1; continue; end if;
    if not exists (select 1 from public.units u where u.id = slot.unit_id and u.clinic_id = slot.clinic_id and u.deleted_at is null)
       or not exists (select 1 from public.services s where s.id = slot.service_id and s.clinic_id = slot.clinic_id and s.deleted_at is null)
       or not exists (select 1 from public.professionals p join public.professional_units pu on pu.professional_id = p.id where p.id = slot.professional_id and p.clinic_id = slot.clinic_id and p.active and p.deleted_at is null and pu.unit_id = slot.unit_id)
       or not exists (select 1 from public.rooms r where r.id = slot.room_id and r.clinic_id = slot.clinic_id and r.unit_id = slot.unit_id and r.deleted_at is null) then
      ignored := ignored + 1; continue;
    end if;
    begin
      select * into target_class from public.classes c where c.clinic_id = slot.clinic_id and c.legacy_source = 'group_slot' and c.legacy_source_id = slot.id;
      if found then classes_reused := classes_reused + 1;
      else
        insert into public.classes (clinic_id, unit_id, name, service_id, status, created_by, legacy_source, legacy_source_id)
        values (slot.clinic_id, slot.unit_id, slot.name, slot.service_id, 'active', auth.uid(), 'group_slot', slot.id)
        returning * into target_class;
        classes_created := classes_created + 1;
      end if;
      select * into target_schedule from public.class_schedules s where s.clinic_id = slot.clinic_id and s.legacy_source = 'group_slot' and s.legacy_source_id = slot.id;
      if found then schedules_reused := schedules_reused + 1;
      else
        insert into public.class_schedules (clinic_id, class_id, effective_from, effective_to, weekdays, start_time, end_time, timezone, planned_professional_id, effective_capacity, room_id, created_by, legacy_source, legacy_source_id)
        values (
          slot.clinic_id, target_class.id, effective_from, effective_to,
          array(select (case weekday when 0 then 'sunday' when 1 then 'monday' when 2 then 'tuesday' when 3 then 'wednesday' when 4 then 'thursday' when 5 then 'friday' when 6 then 'saturday' end)::public.class_weekday from unnest(slot.weekdays) weekday order by weekday),
          slot.starts_at, slot.starts_at + make_interval(mins => slot.duration_minutes), 'America/Sao_Paulo', slot.professional_id, slot.capacity, slot.room_id, auth.uid(), 'group_slot', slot.id
        ) returning * into target_schedule;
        schedules_created := schedules_created + 1;
      end if;
      select * into result from public.generate_class_occurrences(target_schedule.id, p_cutoff, p_cutoff + (p_weeks * 7));
      occurrences_generated := occurrences_generated + result.created_count;
      occurrences_existing := occurrences_existing + result.existing_count;
      for membership in
        select m.* from public.group_slot_memberships m
         where m.clinic_id = slot.clinic_id and m.group_slot_id = slot.id and m.status = 'active' and m.deleted_at is null
           and (m.ends_at is null or m.ends_at >= p_cutoff)
      loop
        membership_from := greatest(p_cutoff, membership.starts_at);
        membership_to := case when membership.ends_at is null then null else membership.ends_at + 1 end;
        if membership_to is not null and membership_from >= membership_to then ignored := ignored + 1; continue; end if;
        if exists (select 1 from public.class_memberships cm where cm.clinic_id = slot.clinic_id and cm.legacy_source = 'group_slot_membership' and cm.legacy_source_id = membership.id) then
          memberships_reused := memberships_reused + 1;
        elsif exists (select 1 from public.class_memberships cm where cm.class_id = target_class.id and cm.patient_id = membership.patient_id and daterange(cm.effective_from, cm.effective_to, '[)') && daterange(membership_from, membership_to, '[)')) then
          ignored := ignored + 1;
        else
          insert into public.class_memberships (clinic_id, class_id, patient_id, enrollment_id, effective_from, effective_to, created_by, legacy_source, legacy_source_id)
          values (slot.clinic_id, target_class.id, membership.patient_id, membership.enrollment_id, membership_from, membership_to, auth.uid(), 'group_slot_membership', membership.id);
          memberships_migrated := memberships_migrated + 1;
        end if;
      end loop;
    exception when others then
      failures := failures + 1;
    end;
  end loop;
  return next;
end $$;

revoke execute on function public.backfill_active_group_slots_to_classes(date, integer) from public, anon;
grant execute on function public.backfill_active_group_slots_to_classes(date, integer) to authenticated;
