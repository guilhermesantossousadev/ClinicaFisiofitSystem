-- AGENDA-005: atomic commands for Class and versioned ClassSchedule. No occurrence reconciliation.

create or replace function public.create_class_schedule(
  p_class_id uuid, p_effective_from date, p_weekdays public.class_weekday[],
  p_start_time time, p_end_time time, p_timezone text, p_planned_professional_id uuid,
  p_effective_capacity integer, p_room_id uuid
) returns public.class_schedules
language plpgsql security definer set search_path = ''
as $$
declare target_class public.classes; created_schedule public.class_schedules;
begin
  select * into target_class from public.classes
   where id = p_class_id and clinic_id = public.current_clinic_id() for update;
  if not found or not public.has_unit_access(target_class.unit_id) then raise exception 'CLASS_NOT_FOUND'; end if;
  if not public.has_role(array['admin','manager','reception']::public.user_role[]) then raise exception 'FORBIDDEN'; end if;
  if p_effective_capacity <= 0 then raise exception 'INVALID_CAPACITY'; end if;
  if cardinality(p_weekdays) not between 1 and 7 or not public.class_weekdays_are_unique(p_weekdays) then raise exception 'INVALID_WEEKDAYS'; end if;
  if p_start_time >= p_end_time then raise exception 'INVALID_TIME_RANGE'; end if;
  if nullif(trim(p_timezone), '') is null then raise exception 'INVALID_TIME_RANGE'; end if;
  if p_planned_professional_id is not null and not exists (
    select 1 from public.professionals p join public.professional_units pu on pu.professional_id = p.id
     where p.id = p_planned_professional_id and p.clinic_id = target_class.clinic_id and p.active and p.deleted_at is null and pu.unit_id = target_class.unit_id
  ) then raise exception 'PROFESSIONAL_NOT_AVAILABLE_FOR_UNIT'; end if;
  if p_room_id is not null and not exists (
    select 1 from public.rooms r where r.id = p_room_id and r.clinic_id = target_class.clinic_id and r.unit_id = target_class.unit_id and r.deleted_at is null
  ) then raise exception 'CLASS_SCHEDULE_NOT_FOUND'; end if;
  if exists (select 1 from public.class_schedules s where s.class_id = p_class_id and daterange(s.effective_from, s.effective_to, '[)') && daterange(p_effective_from, null, '[)')) then
    raise exception 'CLASS_SCHEDULE_OVERLAP';
  end if;
  insert into public.class_schedules (clinic_id, class_id, effective_from, weekdays, start_time, end_time, timezone, planned_professional_id, effective_capacity, room_id, created_by)
  values (target_class.clinic_id, p_class_id, p_effective_from, p_weekdays, p_start_time, p_end_time, trim(p_timezone), p_planned_professional_id, p_effective_capacity, p_room_id, auth.uid())
  returning * into created_schedule;
  return created_schedule;
exception when exclusion_violation then raise exception 'CLASS_SCHEDULE_OVERLAP';
end $$;

create or replace function public.create_class_with_schedule(
  p_unit_id uuid, p_name text, p_service_id uuid, p_status public.class_status,
  p_effective_from date, p_weekdays public.class_weekday[], p_start_time time, p_end_time time,
  p_timezone text, p_planned_professional_id uuid, p_effective_capacity integer, p_room_id uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare created_class public.classes; created_schedule public.class_schedules;
begin
  if not public.has_role(array['admin','manager','reception']::public.user_role[]) or not public.has_unit_access(p_unit_id) then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.units u where u.id = p_unit_id and u.clinic_id = public.current_clinic_id() and u.deleted_at is null) then raise exception 'CLASS_NOT_FOUND'; end if;
  if p_service_id is not null and not exists (select 1 from public.services s where s.id = p_service_id and s.clinic_id = public.current_clinic_id() and s.deleted_at is null) then raise exception 'CLASS_NOT_FOUND'; end if;
  insert into public.classes (clinic_id, unit_id, name, service_id, status, created_by)
  values (public.current_clinic_id(), p_unit_id, trim(p_name), p_service_id, p_status, auth.uid()) returning * into created_class;
  created_schedule := public.create_class_schedule(created_class.id, p_effective_from, p_weekdays, p_start_time, p_end_time, p_timezone, p_planned_professional_id, p_effective_capacity, p_room_id);
  return jsonb_build_object('class', to_jsonb(created_class), 'schedule', to_jsonb(created_schedule));
end $$;

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
  select * into current_schedule from public.class_schedules
   where class_id = p_class_id and effective_from <= p_effective_from and (effective_to is null or p_effective_from < effective_to)
   order by effective_from desc for update;
  if not found then raise exception 'INVALID_SCHEDULE_EFFECTIVE_DATE'; end if;
  if p_effective_from <= current_schedule.effective_from then raise exception 'INVALID_SCHEDULE_EFFECTIVE_DATE'; end if;
  if p_effective_capacity <= 0 then raise exception 'INVALID_CAPACITY'; end if;
  if cardinality(p_weekdays) not between 1 and 7 or not public.class_weekdays_are_unique(p_weekdays) then raise exception 'INVALID_WEEKDAYS'; end if;
  if p_start_time >= p_end_time then raise exception 'INVALID_TIME_RANGE'; end if;
  if p_planned_professional_id is not null and not exists (
    select 1 from public.professionals p join public.professional_units pu on pu.professional_id = p.id
     where p.id = p_planned_professional_id and p.clinic_id = target_class.clinic_id and p.active and p.deleted_at is null and pu.unit_id = target_class.unit_id
  ) then raise exception 'PROFESSIONAL_NOT_AVAILABLE_FOR_UNIT'; end if;
  if p_room_id is not null and not exists (select 1 from public.rooms r where r.id = p_room_id and r.clinic_id = target_class.clinic_id and r.unit_id = target_class.unit_id and r.deleted_at is null) then raise exception 'CLASS_SCHEDULE_NOT_FOUND'; end if;
  update public.class_schedules set effective_to = p_effective_from where id = current_schedule.id;
  insert into public.class_schedules (clinic_id, class_id, effective_from, effective_to, weekdays, start_time, end_time, timezone, planned_professional_id, effective_capacity, room_id, created_by)
  values (target_class.clinic_id, p_class_id, p_effective_from, current_schedule.effective_to, p_weekdays, p_start_time, p_end_time, coalesce(nullif(trim(p_timezone), ''), current_schedule.timezone), p_planned_professional_id, p_effective_capacity, p_room_id, auth.uid())
  returning * into created_schedule;
  return created_schedule;
end $$;

revoke execute on function public.create_class_schedule(uuid, date, public.class_weekday[], time, time, text, uuid, integer, uuid) from public, anon;
revoke execute on function public.create_class_with_schedule(uuid, text, uuid, public.class_status, date, public.class_weekday[], time, time, text, uuid, integer, uuid) from public, anon;
revoke execute on function public.change_class_schedule_from_date(uuid, date, public.class_weekday[], time, time, text, uuid, integer, uuid) from public, anon;
grant execute on function public.create_class_schedule(uuid, date, public.class_weekday[], time, time, text, uuid, integer, uuid) to authenticated;
grant execute on function public.create_class_with_schedule(uuid, text, uuid, public.class_status, date, public.class_weekday[], time, time, text, uuid, integer, uuid) to authenticated;
grant execute on function public.change_class_schedule_from_date(uuid, date, public.class_weekday[], time, time, text, uuid, integer, uuid) to authenticated;
