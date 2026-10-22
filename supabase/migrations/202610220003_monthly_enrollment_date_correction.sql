-- Correct an imported monthly enrollment's start/end dates without rewriting receipts.
-- Existing charge amounts and payments remain financial snapshots.
create function public.correct_monthly_enrollment_dates(
  p_enrollment_id uuid,
  p_expected_starts_at date,
  p_expected_ends_at date,
  p_starts_at date,
  p_ends_at date,
  p_reason text,
  p_request_id uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  target public.enrollments;
  selected_plan public.plans;
  corrected_charges integer := 0;
begin
  perform public.require_enrollment_financial_editor();
  if length(trim(coalesce(p_reason,''))) < 10 then raise exception 'DATE_CORRECTION_REASON_REQUIRED'; end if;
  if p_starts_at is null or (p_ends_at is not null and p_ends_at < p_starts_at) then
    raise exception 'INVALID_PERIOD';
  end if;

  select * into target from public.enrollments
    where id = p_enrollment_id and clinic_id = public.current_clinic_id() and deleted_at is null for update;
  if target.id is null then raise exception 'ENROLLMENT_NOT_FOUND'; end if;
  if not public.has_unit_access(target.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
  if target.status <> 'active' then raise exception 'ENROLLMENT_NOT_ACTIVE'; end if;
  if target.starts_at is distinct from p_expected_starts_at
    or target.ends_at is distinct from p_expected_ends_at then raise exception 'ENROLLMENT_DATES_CONFLICT'; end if;
  select * into selected_plan from public.plans where id = target.plan_id and clinic_id = target.clinic_id;
  if selected_plan.duration_days <> 30 then raise exception 'MONTHLY_ENROLLMENT_REQUIRED'; end if;
  if date_trunc('month', p_starts_at) <> date_trunc('month', target.starts_at) then
    raise exception 'START_DATE_MONTH_CONFLICT';
  end if;
  if p_starts_at = target.starts_at and p_ends_at is not distinct from target.ends_at then
    raise exception 'ENROLLMENT_DATES_UNCHANGED';
  end if;

  perform 1 from public.charges where enrollment_id = target.id and deleted_at is null order by id for update;
  if p_starts_at is distinct from target.starts_at then
    if target.sessions_used > 0
      or exists(select 1 from public.appointments a where a.enrollment_id = target.id and a.deleted_at is null)
      or exists(select 1 from public.class_attendances a where a.enrollment_id = target.id)
      or exists(select 1 from public.attendances a join public.occurrence_participants p on p.id = a.occurrence_participant_id
        where p.source_type = 'membership' and p.source_id in
          (select m.id from public.class_memberships m where m.enrollment_id = target.id)) then
      raise exception 'ENROLLMENT_START_HAS_ATTENDANCE';
    end if;
    if exists(select 1 from public.charges c where c.enrollment_id = target.id and c.deleted_at is null
      and c.status <> 'cancelled' and c.coverage_from < p_starts_at and c.coverage_from <> target.starts_at) then
      raise exception 'ENROLLMENT_START_CHARGE_CONFLICT';
    end if;
    if exists(select 1 from public.charges c where c.enrollment_id = target.id and c.deleted_at is null
      and c.status <> 'cancelled' and c.coverage_from = target.starts_at and c.coverage_to < p_starts_at) then
      raise exception 'ENROLLMENT_START_CHARGE_CONFLICT';
    end if;
    update public.charges set coverage_from = p_starts_at, updated_at = now()
      where enrollment_id = target.id and deleted_at is null and coverage_from = target.starts_at;
    get diagnostics corrected_charges = row_count;
  end if;
  if p_ends_at is not null and exists(select 1 from public.charges c
    where c.enrollment_id = target.id and c.deleted_at is null and c.status <> 'cancelled'
      and coalesce(c.coverage_to,c.due_at) > p_ends_at) then
    raise exception 'ENROLLMENT_END_CHARGE_CONFLICT';
  end if;

  update public.enrollments set starts_at = p_starts_at, ends_at = p_ends_at, updated_at = now()
    where id = target.id;
  insert into public.audit_events(clinic_id,unit_id,user_id,action,entity_type,entity_id,request_id,metadata)
    values(target.clinic_id,target.unit_id,auth.uid(),'enrollment.dates_corrected','enrollment',target.id,p_request_id,
      jsonb_build_object('previous_starts_at',target.starts_at,'previous_ends_at',target.ends_at,
        'starts_at',p_starts_at,'ends_at',p_ends_at,'charge_coverage_starts_corrected',corrected_charges,
        'reason',trim(p_reason)));
  return jsonb_build_object('enrollment_id',target.id,'starts_at',p_starts_at,'ends_at',p_ends_at,
    'charge_coverage_starts_corrected',corrected_charges);
end $$;

revoke all on function public.correct_monthly_enrollment_dates(uuid,date,date,date,date,text,uuid) from public,anon;
grant execute on function public.correct_monthly_enrollment_dates(uuid,date,date,date,date,text,uuid) to authenticated;
