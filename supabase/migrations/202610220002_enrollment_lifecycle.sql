-- Operational enrollment cancellation and guarded rollback.
-- An incorrect enrollment is hidden with a tombstone; audit data is retained.
create or replace function public.inspect_enrollment_lifecycle(p_enrollment_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  target public.enrollments;
  charge_count integer;
  payment_count integer;
  paid_cents integer;
  ledger_count integer;
  appointment_count integer;
  clinical_count integer;
  legacy_attendance_count integer;
  occurrence_attendance_count integer;
  blocked boolean;
begin
  if not public.has_role(array['admin','manager','finance','reception']::public.user_role[])
    or not public.has_module_permission('enrollments',false) then raise exception 'FORBIDDEN'; end if;
  select * into target from public.enrollments
    where id=p_enrollment_id and clinic_id=public.current_clinic_id() and deleted_at is null;
  if target.id is null then raise exception 'ENROLLMENT_NOT_FOUND'; end if;
  if not public.has_unit_access(target.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;

  select count(*),coalesce(sum(c.paid_cents),0) into charge_count,paid_cents
    from public.charges c where c.enrollment_id=target.id;
  select count(*) into payment_count from public.payments p
    join public.charges c on c.id=p.charge_id where c.enrollment_id=target.id;
  select count(*) into ledger_count from public.financial_entries f
    join public.charges c on c.id=f.charge_id where c.enrollment_id=target.id;
  select count(*) into appointment_count from public.appointments a
    where a.enrollment_id=target.id;
  select count(*) into clinical_count from public.clinical_records r
    join public.appointments a on a.id=r.appointment_id where a.enrollment_id=target.id;
  select count(*) into legacy_attendance_count from public.class_attendances a
    where a.enrollment_id=target.id or a.membership_id in
      (select m.id from public.group_slot_memberships m where m.enrollment_id=target.id);
  select count(*) into occurrence_attendance_count from public.attendances a
    join public.occurrence_participants p on p.id=a.occurrence_participant_id
    where p.source_type='membership' and p.source_id in
      (select m.id from public.class_memberships m where m.enrollment_id=target.id);
  blocked := payment_count>0 or paid_cents>0 or ledger_count>0
    or target.sessions_used>0 or appointment_count>0 or clinical_count>0
    or legacy_attendance_count>0 or occurrence_attendance_count>0;
  return jsonb_build_object(
    'enrollment_id',target.id,'status',target.status,'sessions_used',target.sessions_used,
    'charge_count',charge_count,'paid_cents',paid_cents,'payment_count',payment_count,
    'ledger_count',ledger_count,'appointment_count',appointment_count,
    'clinical_record_count',clinical_count,'legacy_attendance_count',legacy_attendance_count,
    'occurrence_attendance_count',occurrence_attendance_count,'can_undo',not blocked);
end $$;

revoke all on function public.inspect_enrollment_lifecycle(uuid) from public,anon;
grant execute on function public.inspect_enrollment_lifecycle(uuid) to authenticated;

create or replace function public.rollback_enrollment(p_enrollment_id uuid,p_reason text,p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare target public.enrollments; evidence jsonb; affected integer := 0;
begin
  perform public.require_enrollment_financial_editor();
  if length(trim(coalesce(p_reason,'')))<10 then raise exception 'ROLLBACK_REASON_REQUIRED'; end if;
  select * into target from public.enrollments
    where id=p_enrollment_id and clinic_id=public.current_clinic_id() and deleted_at is null for update;
  if target.id is null then raise exception 'ENROLLMENT_NOT_FOUND'; end if;
  if not public.has_unit_access(target.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
  perform 1 from public.charges where enrollment_id=target.id order by id for update;
  perform 1 from public.group_slot_memberships where enrollment_id=target.id order by id for update;
  perform 1 from public.class_memberships where enrollment_id=target.id order by id for update;
  evidence:=public.inspect_enrollment_lifecycle(target.id);
  if not (evidence->>'can_undo')::boolean then raise exception 'ENROLLMENT_HAS_HISTORY'; end if;
  update public.class_memberships set enrollment_id=null where enrollment_id=target.id;
  update public.group_slot_memberships set enrollment_id=null,updated_at=now()
    where enrollment_id=target.id and deleted_at is null;
  get diagnostics affected=row_count;
  update public.charges set deleted_at=now(),updated_at=now()
    where enrollment_id=target.id and paid_cents=0 and deleted_at is null;
  update public.enrollments set deleted_at=now(),updated_at=now() where id=target.id;
  insert into public.audit_events(clinic_id,unit_id,user_id,action,entity_type,entity_id,request_id,metadata)
    values(target.clinic_id,target.unit_id,auth.uid(),'enrollment.rolled_back','enrollment',
      target.id,p_request_id,jsonb_build_object('reason',trim(p_reason),'evidence',evidence,
      'memberships_unlinked',affected));
  return jsonb_build_object('enrollment_id',target.id,'memberships_unlinked',affected);
end $$;

revoke all on function public.rollback_enrollment(uuid,text,uuid) from public,anon;
grant execute on function public.rollback_enrollment(uuid,text,uuid) to authenticated;

create or replace function public.cancel_enrollment(
  p_enrollment_id uuid,p_effective_from date,p_reason text,p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare target public.enrollments; clinic_today date := (now() at time zone 'America/Sao_Paulo')::date;
  closed_memberships integer := 0; cancelled_appointments integer := 0;
begin
  perform public.require_enrollment_financial_editor();
  if length(trim(coalesce(p_reason,'')))<10 then raise exception 'CANCELLATION_REASON_REQUIRED'; end if;
  if p_effective_from is distinct from clinic_today then raise exception 'CANCELLATION_DATE_MUST_BE_TODAY'; end if;
  select * into target from public.enrollments
    where id=p_enrollment_id and clinic_id=public.current_clinic_id() and deleted_at is null for update;
  if target.id is null then raise exception 'ENROLLMENT_NOT_FOUND'; end if;
  if not public.has_unit_access(target.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
  if target.status='cancelled' then raise exception 'ENROLLMENT_ALREADY_CANCELLED'; end if;
  update public.class_memberships m
    set effective_to=least(coalesce(m.effective_to,p_effective_from),
      greatest(m.effective_from,p_effective_from))
    where m.enrollment_id=target.id and (m.effective_to is null or m.effective_to>p_effective_from);
  get diagnostics closed_memberships=row_count;
  update public.group_slot_memberships m
    set ends_at=least(coalesce(m.ends_at,p_effective_from-1),p_effective_from-1),
      status='cancelled',updated_at=now()
    where m.enrollment_id=target.id and m.deleted_at is null;
  update public.appointments a set status='cancelled',updated_at=now()
    where a.enrollment_id=target.id and a.deleted_at is null
      and a.starts_at>=now() and a.status in ('scheduled','confirmed')
      and a.session_consumed_at is null
      and not exists(select 1 from public.clinical_records r where r.appointment_id=a.id);
  get diagnostics cancelled_appointments=row_count;
  update public.charges c set status='cancelled',updated_at=now()
    where c.enrollment_id=target.id and c.deleted_at is null and c.status<>'cancelled'
      and c.coverage_from>=p_effective_from and c.paid_cents=0
      and not exists(select 1 from public.payments p where p.charge_id=c.id);
  update public.enrollments set status='cancelled',
    ends_at=greatest(starts_at,least(coalesce(ends_at,p_effective_from-1),p_effective_from-1)),
    updated_at=now() where id=target.id;
  insert into public.audit_events(clinic_id,unit_id,user_id,action,entity_type,entity_id,request_id,metadata)
    values(target.clinic_id,target.unit_id,auth.uid(),'enrollment.cancelled','enrollment',
      target.id,p_request_id,jsonb_build_object('reason',trim(p_reason),
      'effective_from',p_effective_from,'memberships_closed',closed_memberships,
      'appointments_cancelled',cancelled_appointments));
  return jsonb_build_object('enrollment_id',target.id,'effective_from',p_effective_from,
    'memberships_closed',closed_memberships,'appointments_cancelled',cancelled_appointments);
end $$;

revoke all on function public.cancel_enrollment(uuid,date,text,uuid) from public,anon;
grant execute on function public.cancel_enrollment(uuid,date,text,uuid) to authenticated;
