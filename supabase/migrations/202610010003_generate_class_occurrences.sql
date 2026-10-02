-- AGENDA-004: materialize ClassSchedule dates inside an explicit [from, to) window.

create or replace function public.generate_class_occurrences(
  p_class_schedule_id uuid,
  p_from date,
  p_to date
) returns table(created_count integer, existing_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.class_schedules;
  target_class public.classes;
  effective_from date;
  effective_to date;
begin
  if p_to <= p_from then
    raise exception 'INVALID_OCCURRENCE_WINDOW';
  end if;
  if not public.has_role(array['admin','manager','reception']::public.user_role[]) then
    raise exception 'FORBIDDEN';
  end if;

  select s.*
    into target
    from public.class_schedules s
    join public.classes c on c.id = s.class_id
   where s.id = p_class_schedule_id
     and s.clinic_id = public.current_clinic_id()
     and c.clinic_id = public.current_clinic_id()
     and public.has_unit_access(c.unit_id);

  if not found or not public.can_access_class(target.class_id) then
    raise exception 'CLASS_SCHEDULE_NOT_FOUND';
  end if;
  select c.*
    into target_class
    from public.classes c
   where c.id = target.class_id
     and c.clinic_id = public.current_clinic_id();
  if target_class.status <> 'active' then
    return query select 0, 0;
    return;
  end if;

  effective_from := greatest(p_from, target.effective_from);
  effective_to := least(p_to, coalesce(target.effective_to, p_to));
  if effective_from >= effective_to then
    return query select 0, 0;
    return;
  end if;

  return query
  with candidate_dates as (
    select day::date as local_date
    from generate_series(effective_from, effective_to - 1, interval '1 day') as day
    where target.weekdays @> array[
      (case extract(isodow from day)::integer
        when 1 then 'monday'
        when 2 then 'tuesday'
        when 3 then 'wednesday'
        when 4 then 'thursday'
        when 5 then 'friday'
        when 6 then 'saturday'
        when 7 then 'sunday'
      end)::public.class_weekday
    ]
  ), inserted as (
    insert into public.class_occurrences (
      clinic_id, class_id, class_schedule_id, unit_id, service_id, local_date,
      local_start_time, local_end_time, timezone, start_at, end_at,
      planned_professional_id, actual_professional_id, effective_capacity, room_id,
      status, created_by
    )
    select
      target.clinic_id, target.class_id, target.id, target_class.unit_id, target_class.service_id, candidate.local_date,
      target.start_time, target.end_time, target.timezone,
      (candidate.local_date + target.start_time) at time zone target.timezone,
      (candidate.local_date + target.end_time) at time zone target.timezone,
      target.planned_professional_id, null, target.effective_capacity, target.room_id,
      'planned'::public.class_occurrence_status, auth.uid()
    from candidate_dates candidate
    on conflict (class_schedule_id, local_date) do nothing
    returning id
  )
  select
    (select count(*)::integer from inserted),
    (select count(*)::integer from candidate_dates) - (select count(*)::integer from inserted);
end
$$;

revoke execute on function public.generate_class_occurrences(uuid, date, date) from public, anon;
grant execute on function public.generate_class_occurrences(uuid, date, date) to authenticated;
