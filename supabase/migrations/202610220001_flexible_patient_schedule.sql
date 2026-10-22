-- Patient weekdays are part of the enrollment transaction. Keep the existing
-- financial predecessor, which owns charge creation and contract snapshots.
-- Legacy triggers used to replace every patient's days with the old group
-- weekdays. Preserve explicit choices and stop propagating group edits.
create or replace function public.sync_membership_weekdays_from_group()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.weekdays is null then
    select weekdays into new.weekdays from public.group_slots where id = new.group_slot_id;
  end if;
  return new;
end $$;
drop trigger if exists group_slot_propagate_weekdays on public.group_slots;

do $patch$
declare
  definition text := pg_get_functiondef('public.save_enrollment_before_financial_release(jsonb,uuid,uuid)'::regprocedure);
  old_fields text := $old$array['patient_id','plan_id','unit_id','starts_at','ends_at','due_day','discount_cents','surcharge_cents','group_slot_id']$old$;
  new_fields text := $new$array['patient_id','plan_id','unit_id','starts_at','ends_at','due_day','discount_cents','surcharge_cents','group_slot_id','weekdays']$new$;
  old_insert text := $old$insert into public.group_slot_memberships(clinic_id,group_slot_id,enrollment_id,patient_id,starts_at,ends_at) values(clinic,group_id,target.id,patient,starts,ends);$old$;
  new_insert text := $new$insert into public.group_slot_memberships(clinic_id,group_slot_id,enrollment_id,patient_id,starts_at,ends_at,weekdays) values(clinic,group_id,target.id,patient,starts,ends,case when p_input?'weekdays' then array(select jsonb_array_elements_text(p_input->'weekdays')::smallint) else selected_slot.weekdays end);$new$;
  old_update text := $old$update public.group_slot_memberships set enrollment_id=target.id,updated_at=now() where id=membership.id;$old$;
  new_update text := $new$update public.group_slot_memberships set enrollment_id=target.id,weekdays=case when p_input?'weekdays' then array(select jsonb_array_elements_text(p_input->'weekdays')::smallint) else weekdays end,updated_at=now() where id=membership.id;$new$;
begin
  if position(old_fields in definition)=0 or position(old_insert in definition)=0 or position(old_update in definition)=0 then
    raise exception 'FLEXIBLE_ENROLLMENT_PRECONDITION_FAILED';
  end if;
  definition := replace(definition,old_fields,new_fields);
  definition := replace(definition,old_insert,new_insert);
  definition := replace(definition,old_update,new_update);
  execute definition;
end $patch$;

create or replace function public.save_enrollment(p_input jsonb,p_request_id uuid,p_id uuid default null)
returns public.enrollments language plpgsql security definer set search_path='' as $$
declare
  e public.enrollments;
  selected_days smallint[];
  group_id uuid;
  target_class public.classes;
  target_schedule public.class_schedules;
begin
  if p_id is not null then
    select * into e from public.enrollments where id=p_id and clinic_id=public.current_clinic_id() and deleted_at is null for update;
    if e.id is null then raise exception 'ENROLLMENT_NOT_FOUND'; end if;
    if (p_input ? 'plan_id' and (p_input->>'plan_id')::uuid is distinct from e.plan_id)
      or (p_input ? 'starts_at' and (p_input->>'starts_at')::date is distinct from e.starts_at)
      or (p_input ? 'ends_at' and nullif(p_input->>'ends_at','')::date is distinct from e.ends_at) then raise exception 'USE_PLAN_CHANGE'; end if;
  else
    perform 1 from public.plans where id=(p_input->>'plan_id')::uuid and clinic_id=public.current_clinic_id() for share;
  end if;

  if p_input ? 'weekdays' then
    if p_id is not null or jsonb_typeof(p_input->'weekdays') <> 'array' then raise exception 'INVALID_MEMBERSHIP_WEEKDAYS'; end if;
    group_id := nullif(p_input->>'group_slot_id','')::uuid;
    if group_id is null then raise exception 'INVALID_MEMBERSHIP_WEEKDAYS'; end if;
    select array(select day::smallint from jsonb_array_elements_text(p_input->'weekdays') day) into selected_days;
    if selected_days is null or cardinality(selected_days) not between 1 and 5
      or exists(select 1 from unnest(selected_days) day where day not between 1 and 5)
      or cardinality(selected_days)<>(select count(distinct day) from unnest(selected_days) day)
    then raise exception 'INVALID_MEMBERSHIP_WEEKDAYS'; end if;
    select * into target_class from public.classes
      where clinic_id=public.current_clinic_id() and legacy_source='group_slot' and legacy_source_id=group_id and status='active';
    if target_class.id is null then raise exception 'LEGACY_RECONCILIATION_REQUIRED'; end if;
    select * into target_schedule from public.class_schedules
      where class_id=target_class.id and effective_from<=(p_input->>'starts_at')::date
        and (effective_to is null or (p_input->>'starts_at')::date<effective_to)
      order by effective_from desc limit 1;
    if target_schedule.id is null or not (public.agenda_weekdays(selected_days) <@ target_schedule.weekdays)
    then raise exception 'INVALID_MEMBERSHIP_WEEKDAYS'; end if;
  end if;
  return public.save_enrollment_before_financial_release(p_input,p_request_id,p_id);
end $$;
revoke all on function public.save_enrollment(jsonb,uuid,uuid) from public,anon;
grant execute on function public.save_enrollment(jsonb,uuid,uuid) to authenticated;

-- Schedule edits must not add weekdays to memberships that still inherit the
-- schedule. A new version starts at the requested date; old dates stay intact.
create function public.prepare_flexible_group_change(p_class_id uuid,p_old_schedule_id uuid,p_from date,p_new_days public.class_weekday[])
returns void language plpgsql security definer set search_path='' as $$
declare
  old_schedule public.class_schedules;
  member public.class_memberships;
begin
  if not public.has_agenda_permission(true) or not public.has_role(array['admin','manager','reception']::public.user_role[]) then raise exception 'FORBIDDEN'; end if;
  select * into old_schedule from public.class_schedules where id=p_old_schedule_id and class_id=p_class_id and clinic_id=public.current_clinic_id() for update;
  if old_schedule.id is null or p_from<current_date then raise exception 'INVALID_SCHEDULE_EFFECTIVE_DATE'; end if;

  if not (p_new_days <@ old_schedule.weekdays) then
    for member in
      select m.* from public.class_memberships m
      left join public.group_slot_memberships lm on m.legacy_source='group_slot_membership' and lm.id=m.legacy_source_id
      where m.class_id=p_class_id and m.clinic_id=old_schedule.clinic_id and m.weekdays is null
        and (m.effective_to is null or m.effective_to>p_from) and lm.id is null
      order by m.effective_from for update of m
    loop
      if member.effective_from < p_from then
        update public.class_memberships set effective_to=p_from where id=member.id;
        insert into public.class_memberships(clinic_id,class_id,patient_id,enrollment_id,effective_from,effective_to,weekdays,created_by)
        values(member.clinic_id,member.class_id,member.patient_id,member.enrollment_id,p_from,member.effective_to,old_schedule.weekdays,auth.uid());
      else
        update public.class_memberships set weekdays=old_schedule.weekdays where id=member.id;
      end if;
    end loop;
  end if;

  if exists(
    select 1 from public.class_occurrences o
    left join public.occurrence_participants op on op.class_occurrence_id=o.id and op.status='active'
    left join public.attendances a on a.occurrence_participant_id=op.id
    where o.class_schedule_id=p_old_schedule_id and o.local_date>=p_from
      and (o.status<>'planned' or o.updated_at<>o.created_at or a.id is not null
        or op.source_type in ('makeup_reservation','ad_hoc_admission'))
  ) then raise exception 'SCHEDULE_HAS_ATTENDANCE'; end if;

  update public.class_occurrences
    set status='cancelled',cancelled_at=now(),cancelled_by=auth.uid(),cancellation_reason='Schedule replaced',updated_at=now()
    where class_schedule_id=p_old_schedule_id and local_date>=p_from and status='planned';
end $$;
revoke all on function public.prepare_flexible_group_change(uuid,uuid,date,public.class_weekday[]) from public,anon,authenticated;

do $patch$
declare
  definition text := pg_get_functiondef('public.change_class_schedule_from_date(uuid,date,public.class_weekday[],time,time,text,uuid,integer,uuid)'::regprocedure);
  marker text := $marker$update public.class_schedules set effective_to = p_effective_from where id = current_schedule.id;$marker$;
begin
  if position(marker in definition)=0 then raise exception 'FLEXIBLE_GROUP_PRECONDITION_FAILED'; end if;
  definition := replace(definition,marker,
    $replacement$perform public.prepare_flexible_group_change(p_class_id,current_schedule.id,p_effective_from,p_weekdays);
  update public.class_schedules set effective_to = p_effective_from where id = current_schedule.id;$replacement$);
  execute definition;
end $patch$;
