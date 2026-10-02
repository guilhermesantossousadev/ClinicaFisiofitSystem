-- AGENDA-010: an explicit ClassMembership frequency is a subset of its ClassSchedule.
-- NULL is deliberate legacy compatibility: use the schedule weekdays until an admin edits it.

alter table public.class_memberships
  add column weekdays public.class_weekday[];

alter table public.class_memberships
  add constraint class_memberships_weekdays_valid
  check (weekdays is null or (cardinality(weekdays) between 1 and 7 and public.class_weekdays_are_unique(weekdays)));

create or replace function public.change_class_schedule_from_date(
  p_class_id uuid, p_effective_from date, p_weekdays public.class_weekday[], p_start_time time,
  p_end_time time, p_timezone text, p_planned_professional_id uuid, p_effective_capacity integer, p_room_id uuid
) returns public.class_schedules
language plpgsql security definer set search_path = ''
as $$
declare target_class public.classes; current_schedule public.class_schedules; created_schedule public.class_schedules;
begin
  select * into target_class from public.classes where id = p_class_id and clinic_id = public.current_clinic_id() for update;
  if not found or not public.has_unit_access(target_class.unit_id) then raise exception 'CLASS_NOT_FOUND'; end if;
  if not public.has_role(array['admin','manager','reception']::public.user_role[]) then raise exception 'FORBIDDEN'; end if;
  select * into current_schedule from public.class_schedules where class_id = p_class_id and effective_from <= p_effective_from and (effective_to is null or p_effective_from < effective_to) order by effective_from desc for update;
  if not found then raise exception 'INVALID_SCHEDULE_EFFECTIVE_DATE'; end if;
  if p_effective_from <= current_schedule.effective_from then raise exception 'INVALID_SCHEDULE_EFFECTIVE_DATE'; end if;
  if p_effective_capacity <= 0 then raise exception 'INVALID_CAPACITY'; end if;
  if cardinality(p_weekdays) not between 1 and 7 or not public.class_weekdays_are_unique(p_weekdays) then raise exception 'INVALID_WEEKDAYS'; end if;
  if p_start_time >= p_end_time then raise exception 'INVALID_TIME_RANGE'; end if;
  if p_planned_professional_id is not null and not exists (select 1 from public.professionals p join public.professional_units pu on pu.professional_id = p.id where p.id = p_planned_professional_id and p.clinic_id = target_class.clinic_id and p.active and p.deleted_at is null and pu.unit_id = target_class.unit_id) then raise exception 'PROFESSIONAL_NOT_AVAILABLE_FOR_UNIT'; end if;
  if p_room_id is not null and not exists (select 1 from public.rooms r where r.id = p_room_id and r.clinic_id = target_class.clinic_id and r.unit_id = target_class.unit_id and r.deleted_at is null) then raise exception 'CLASS_SCHEDULE_NOT_FOUND'; end if;
  -- Explicit membership weekdays cannot become invalid; NULL legacy memberships adapt to the new schedule.
  if exists (select 1 from public.class_memberships cm where cm.class_id = p_class_id and cm.weekdays is not null and daterange(cm.effective_from, cm.effective_to, '[)') && daterange(p_effective_from, current_schedule.effective_to, '[)') and not (cm.weekdays <@ p_weekdays)) then
    raise exception 'CLASS_MEMBERSHIP_WEEKDAYS_CONFLICT';
  end if;
  update public.class_schedules set effective_to = p_effective_from where id = current_schedule.id;
  insert into public.class_schedules (clinic_id, class_id, effective_from, effective_to, weekdays, start_time, end_time, timezone, planned_professional_id, effective_capacity, room_id, created_by)
  values (target_class.clinic_id, p_class_id, p_effective_from, current_schedule.effective_to, p_weekdays, p_start_time, p_end_time, coalesce(nullif(trim(p_timezone), ''), current_schedule.timezone), p_planned_professional_id, p_effective_capacity, p_room_id, auth.uid())
  returning * into created_schedule;
  return created_schedule;
exception when exclusion_violation then raise exception 'CLASS_SCHEDULE_OVERLAP';
end $$;

comment on column public.class_memberships.weekdays is 'Explicit attendance weekdays. NULL means legacy membership and resolves to the effective ClassSchedule weekdays.';
