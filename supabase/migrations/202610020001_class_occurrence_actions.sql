-- AGENDA-012: point-in-time changes belong to the materialized occurrence.

alter table public.class_occurrences
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id),
  add column if not exists cancellation_reason text;

create or replace function public.update_class_occurrence(
  p_occurrence_id uuid,
  p_start_time time,
  p_end_time time,
  p_actual_professional_id uuid,
  p_room_id uuid
) returns public.class_occurrences
language plpgsql security definer set search_path = '' as $$
declare target public.class_occurrences; target_professional uuid; result public.class_occurrences;
begin
  select * into target from public.class_occurrences
   where id = p_occurrence_id and clinic_id = public.current_clinic_id() for update;
  if not found or not public.can_access_class(target.class_id) then raise exception 'CLASS_OCCURRENCE_NOT_FOUND'; end if;
  if not public.has_role(array['admin','manager','reception']::public.user_role[]) then raise exception 'FORBIDDEN'; end if;
  if target.status = 'cancelled' then raise exception 'OCCURRENCE_CANCELLED'; end if;
  if p_start_time >= p_end_time then raise exception 'INVALID_TIME_RANGE'; end if;
  target_professional := coalesce(p_actual_professional_id, target.planned_professional_id);
  if target_professional is not null then
    if not exists (select 1 from public.professionals p join public.professional_units pu on pu.professional_id = p.id where p.id = target_professional and p.clinic_id = target.clinic_id and p.active and p.deleted_at is null and pu.unit_id = target.unit_id) then
      raise exception 'PROFESSIONAL_NOT_AVAILABLE_FOR_UNIT';
    end if;
    if exists (select 1 from public.class_occurrences o where o.clinic_id = target.clinic_id and o.id <> target.id and o.status in ('planned','in_progress') and coalesce(o.actual_professional_id, o.planned_professional_id) = target_professional and (target.local_date + p_start_time) at time zone target.timezone < o.end_at and o.start_at < (target.local_date + p_end_time) at time zone target.timezone)
      or exists (select 1 from public.appointments a where a.clinic_id = target.clinic_id and a.professional_id = target_professional and a.deleted_at is null and a.status not in ('cancelled','completed') and (target.local_date + p_start_time) at time zone target.timezone < a.ends_at and a.starts_at < (target.local_date + p_end_time) at time zone target.timezone) then
      raise exception 'PROFESSIONAL_SCHEDULE_CONFLICT';
    end if;
  end if;
  update public.class_occurrences set local_start_time = p_start_time, local_end_time = p_end_time,
    start_at = (target.local_date + p_start_time) at time zone target.timezone,
    end_at = (target.local_date + p_end_time) at time zone target.timezone,
    actual_professional_id = p_actual_professional_id, room_id = p_room_id, updated_at = now()
  where id = target.id returning * into result;
  return result;
end $$;

create or replace function public.cancel_class_occurrence(p_occurrence_id uuid)
returns public.class_occurrences
language plpgsql security definer set search_path = '' as $$
declare target public.class_occurrences; result public.class_occurrences;
begin
  select * into target from public.class_occurrences where id = p_occurrence_id and clinic_id = public.current_clinic_id() for update;
  if not found or not public.can_access_class(target.class_id) then raise exception 'CLASS_OCCURRENCE_NOT_FOUND'; end if;
  if not public.has_role(array['admin','manager','reception']::public.user_role[]) then raise exception 'FORBIDDEN'; end if;
  if target.status = 'cancelled' then return target; end if;
  if target.status in ('completed','in_progress') then raise exception 'INVALID_OCCURRENCE_STATE_TRANSITION'; end if;
  update public.class_occurrences set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), updated_at = now() where id = target.id returning * into result;
  return result;
end $$;

revoke all on function public.update_class_occurrence(uuid,time,time,uuid,uuid), public.cancel_class_occurrence(uuid) from public, anon;
grant execute on function public.update_class_occurrence(uuid,time,time,uuid,uuid), public.cancel_class_occurrence(uuid) to authenticated;
