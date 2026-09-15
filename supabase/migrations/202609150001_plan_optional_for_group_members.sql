-- Patients may join a fixed group before choosing or paying for a plan.
alter table public.group_slot_memberships
  alter column enrollment_id drop not null;

alter table public.class_attendances
  alter column enrollment_id drop not null;

create or replace function public.link_pending_group_memberships_to_enrollment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is not null then
    update public.class_attendances attendance
       set enrollment_id = null,
           updated_at = now()
     where attendance.enrollment_id = new.id;

    update public.group_slot_memberships membership
       set enrollment_id = null,
           updated_at = now()
     where membership.enrollment_id = new.id;
  elsif new.status = 'active' then
    update public.group_slot_memberships membership
       set enrollment_id = new.id,
           updated_at = now()
     where membership.clinic_id = new.clinic_id
       and membership.patient_id = new.patient_id
       and membership.enrollment_id is null
       and membership.status = 'active'
       and membership.deleted_at is null
       and membership.group_slot_id in (
         select slot.id
           from public.group_slots slot
          where slot.clinic_id = new.clinic_id
            and slot.unit_id = new.unit_id
            and slot.deleted_at is null
       );

    update public.class_attendances attendance
       set enrollment_id = new.id,
           updated_at = now()
     where attendance.enrollment_id is null
       and attendance.membership_id in (
         select membership.id
           from public.group_slot_memberships membership
          where membership.enrollment_id = new.id
       );
  end if;
  return new;
end;
$$;

revoke all on function public.link_pending_group_memberships_to_enrollment() from public, anon, authenticated;

drop trigger if exists enrollment_link_pending_group_memberships on public.enrollments;
create trigger enrollment_link_pending_group_memberships
after insert or update of status, deleted_at on public.enrollments
for each row execute function public.link_pending_group_memberships_to_enrollment();

-- Reverting a financial enrollment must not remove the patient's place in a
-- group. It only disconnects that independent schedule membership from the plan.
create or replace function public.rollback_enrollment(p_enrollment_id uuid, p_reason text, p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare target public.enrollments; affected integer := 0;
begin
  if not public.has_role(array['admin','manager','finance']::public.user_role[]) then raise exception 'FORBIDDEN'; end if;
  if length(trim(p_reason)) < 10 then raise exception 'ROLLBACK_REASON_REQUIRED'; end if;
  select * into target from public.enrollments where id = p_enrollment_id and clinic_id = public.current_clinic_id() and deleted_at is null for update;
  if target.id is null then raise exception 'ENROLLMENT_NOT_FOUND'; end if;
  if not public.has_unit_access(target.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
  update public.class_attendances set enrollment_id = null, updated_at = now() where enrollment_id = target.id;
  update public.group_slot_memberships set enrollment_id = null, updated_at = now() where enrollment_id = target.id and deleted_at is null;
  get diagnostics affected = row_count;
  update public.charges set deleted_at = now(), updated_at = now() where enrollment_id = target.id and clinic_id = target.clinic_id and paid_cents = 0 and deleted_at is null;
  update public.enrollments set deleted_at = now(), updated_at = now() where id = target.id;
  insert into public.audit_events(clinic_id, unit_id, user_id, action, entity_type, entity_id, request_id, metadata)
  values(target.clinic_id, target.unit_id, auth.uid(), 'enrollment.rolled_back', 'enrollment', target.id, p_request_id, jsonb_build_object('reason', trim(p_reason), 'memberships_unlinked', affected));
  return jsonb_build_object('enrollment_id', target.id, 'memberships_unlinked', affected);
end
$$;
