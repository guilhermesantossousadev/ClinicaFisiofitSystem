-- AGENDA-HOTFIX-001: room is informational; professional conflicts are tenant-wide
-- and patient conflicts are enforced by the current legacy appointment authority.

drop function if exists public.check_appointment_conflict(uuid, uuid, uuid, timestamptz, timestamptz, uuid, uuid);

create function public.check_appointment_conflict(
  p_unit_id uuid,
  p_professional_id uuid,
  p_room_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_exclude_id uuid default null,
  p_group_slot_id uuid default null,
  p_patient_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role(array['admin','manager','reception','professional']::public.user_role[])
     or not public.has_unit_access(p_unit_id) then
    raise exception 'FORBIDDEN';
  end if;
  if public.current_role() = 'professional' and p_professional_id is distinct from public.current_professional_id() then
    raise exception 'PROFESSIONAL_FORBIDDEN';
  end if;

  return jsonb_build_object(
    'professional_conflict', exists(
      select 1
      from public.appointments a
      where a.clinic_id = public.current_clinic_id()
        and a.deleted_at is null
        and a.status not in ('cancelled', 'missed')
        and a.id is distinct from p_exclude_id
        and a.professional_id = p_professional_id
        and a.group_slot_id is distinct from p_group_slot_id
        and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
    ),
    'patient_conflict', case when p_patient_id is null then false else exists(
      select 1
      from public.appointments a
      where a.clinic_id = public.current_clinic_id()
        and a.deleted_at is null
        and a.status not in ('cancelled', 'missed')
        and a.id is distinct from p_exclude_id
        and a.patient_id = p_patient_id
        and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
    ) end,
    'capacity_reached', case when p_group_slot_id is null then false else coalesce((
      select count(a.id) >= gs.capacity
      from public.group_slots gs
      left join public.appointments a on a.group_slot_id = gs.id
        and a.deleted_at is null and a.status not in ('cancelled','missed')
        and a.id is distinct from p_exclude_id
        and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
      where gs.id = p_group_slot_id and gs.unit_id = p_unit_id
      group by gs.capacity
    ), false) end
  );
end
$$;

revoke execute on function public.check_appointment_conflict(uuid, uuid, uuid, timestamptz, timestamptz, uuid, uuid, uuid) from public, anon;
grant execute on function public.check_appointment_conflict(uuid, uuid, uuid, timestamptz, timestamptz, uuid, uuid, uuid) to authenticated;
