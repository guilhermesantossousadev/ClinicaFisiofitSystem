create or replace function public.can_access_group_slot(target_slot uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.group_slots gs
     where gs.id = target_slot
       and gs.clinic_id = public.current_clinic_id()
       and gs.deleted_at is null
       and public.has_unit_access(gs.unit_id)
       and (
         public.has_role(array['admin','manager','reception']::public.user_role[])
         or (
           public.current_role() = 'professional'
           and gs.professional_id = public.current_professional_id()
         )
       )
  )
$$;

revoke execute on function public.can_access_group_slot(uuid) from public, anon;
grant execute on function public.can_access_group_slot(uuid) to authenticated;

drop policy if exists group_slots_select on public.group_slots;
create policy group_slots_select on public.group_slots for select
using (
  clinic_id = public.current_clinic_id()
  and public.has_unit_access(unit_id)
  and (
    public.has_role(array['admin','manager','reception']::public.user_role[])
    or (
      public.current_role() = 'professional'
      and professional_id = public.current_professional_id()
    )
  )
);

create or replace function public.complete_appointment(
  p_appointment_id uuid,
  p_request_id uuid
) returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.appointments;
  consume_session boolean := false;
begin
  if not public.has_role(array['admin','manager','reception','professional']::public.user_role[]) then
    raise exception 'FORBIDDEN';
  end if;

  select * into result
    from public.appointments
   where id = p_appointment_id
     and clinic_id = public.current_clinic_id()
     and deleted_at is null
   for update;
  if result.id is null then raise exception 'APPOINTMENT_NOT_FOUND'; end if;
  if not public.has_unit_access(result.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
  if public.current_role() = 'professional'
     and result.professional_id is distinct from public.current_professional_id() then
    raise exception 'PROFESSIONAL_FORBIDDEN';
  end if;

  consume_session := result.enrollment_id is not null and result.session_consumed_at is null;
  if result.status = 'completed' and not consume_session then return result; end if;

  update public.appointments
     set status = 'completed',
         session_consumed_at = case when consume_session then now() else session_consumed_at end,
         updated_at = now()
   where id = result.id
   returning * into result;

  if consume_session then
    update public.enrollments
       set sessions_used = sessions_used + 1, updated_at = now()
     where id = result.enrollment_id
       and clinic_id = result.clinic_id
       and unit_id = result.unit_id
       and deleted_at is null;
    if not found then raise exception 'ENROLLMENT_NOT_FOUND'; end if;
  end if;

  insert into public.audit_events(
    clinic_id, unit_id, user_id, action, entity_type, entity_id, request_id, metadata
  ) values (
    result.clinic_id, result.unit_id, auth.uid(), 'appointment.completed',
    'appointment', result.id, p_request_id,
    jsonb_build_object('session_consumed', consume_session)
  );

  return result;
end
$$;

revoke execute on function public.complete_appointment(uuid, uuid) from public, anon;
grant execute on function public.complete_appointment(uuid, uuid) to authenticated;
