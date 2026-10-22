-- Correct imported enrollment dates without rewriting receipts.
-- Prepaid plans require a single fully receipted charge and exact 90/180-day term.
-- Existing charge amounts and payments remain financial snapshots.
create or replace function public.correct_monthly_enrollment_dates(
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
  if selected_plan.duration_days not in (30,90,180) then raise exception 'INVALID_PLAN_DURATION'; end if;
  if selected_plan.duration_days > 30 then
    if p_ends_at is distinct from p_starts_at + selected_plan.duration_days - 1 then
      raise exception 'INVALID_PREPAID_PERIOD';
    end if;
    if (select count(*) from public.charges c where c.enrollment_id = target.id and c.deleted_at is null and c.status <> 'cancelled') <> 1
      or exists(select 1 from public.charges c where c.enrollment_id = target.id and c.deleted_at is null and c.status <> 'cancelled'
        and (c.paid_cents <> c.amount_cents or c.coverage_from is not null or c.coverage_to is not null
          or (select coalesce(sum(pay.amount_cents),0) from public.payments pay where pay.charge_id = c.id and pay.reversed_at is null) <> c.amount_cents)) then
      raise exception 'PREPAID_HISTORY_CONFLICT';
    end if;
  end if;
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

-- Fill missing coverage on an imported charge without changing its amount or receipts.
-- Prepaid plans require a single fully receipted charge covering exactly 90/180 days.
create or replace function public.correct_legacy_charge_coverage(
  p_charge_id uuid,
  p_expected_from date,
  p_expected_to date,
  p_coverage_from date,
  p_coverage_to date,
  p_reason text,
  p_request_id uuid
) returns public.charges
language plpgsql security definer set search_path = '' as $$
declare
  target public.charges;
  enrollment public.enrollments;
  selected_plan public.plans;
  result public.charges;
begin
  perform public.require_enrollment_financial_editor();
  if p_coverage_from is null or p_coverage_to is null or p_coverage_to < p_coverage_from
    or length(trim(coalesce(p_reason,''))) < 10 then
    raise exception 'INVALID_COVERAGE_CORRECTION';
  end if;
  select * into target from public.charges where id = p_charge_id
    and clinic_id = public.current_clinic_id() and deleted_at is null for update;
  if target.id is null then raise exception 'CHARGE_NOT_FOUND'; end if;
  if not public.has_unit_access(target.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
  if target.enrollment_id is null or target.status = 'cancelled' then
    raise exception 'COVERAGE_CORRECTION_UNAVAILABLE';
  end if;
  if target.coverage_from is distinct from p_expected_from
    or target.coverage_to is distinct from p_expected_to then
    raise exception 'CHARGE_COVERAGE_CONFLICT';
  end if;
  if target.coverage_from is not null and target.coverage_to is not null then
    raise exception 'COVERAGE_ALREADY_SET';
  end if;
  if (target.coverage_from is not null and target.coverage_from <> p_coverage_from)
    or (target.coverage_to is not null and target.coverage_to <> p_coverage_to) then
    raise exception 'CHARGE_COVERAGE_CONFLICT';
  end if;
  select * into enrollment from public.enrollments where id = target.enrollment_id
    and clinic_id = target.clinic_id and deleted_at is null for share;
  if enrollment.id is null or p_coverage_from < enrollment.starts_at
    or (enrollment.ends_at is not null and p_coverage_to > enrollment.ends_at) then
    raise exception 'ENROLLMENT_OUTSIDE_COVERAGE';
  end if;
  select * into selected_plan from public.plans where id = enrollment.plan_id
    and clinic_id = enrollment.clinic_id;
  if selected_plan.duration_days not in (30,90,180) then raise exception 'INVALID_PLAN_DURATION'; end if;
  if selected_plan.duration_days > 30 then
    if p_coverage_from <> enrollment.starts_at
      or p_coverage_to <> enrollment.starts_at + selected_plan.duration_days - 1
      or (enrollment.ends_at is not null and p_coverage_to <> enrollment.ends_at)
      or target.paid_cents <> target.amount_cents
      or (select coalesce(sum(pay.amount_cents),0) from public.payments pay where pay.charge_id = target.id and pay.reversed_at is null) <> target.amount_cents
      or (select count(*) from public.charges c where c.enrollment_id = enrollment.id and c.deleted_at is null and c.status <> 'cancelled') <> 1 then
      raise exception 'PREPAID_HISTORY_CONFLICT';
    end if;
  end if;
  if exists(select 1 from public.charges c where c.enrollment_id = enrollment.id
    and c.id <> target.id and c.deleted_at is null and c.status <> 'cancelled'
    and c.coverage_from <= p_coverage_to and c.coverage_to >= p_coverage_from) then
    raise exception 'CHARGE_ALREADY_EXISTS';
  end if;
  update public.charges set coverage_from = p_coverage_from,
    coverage_to = p_coverage_to, updated_at = now()
    where id = target.id returning * into result;
  insert into public.audit_events(clinic_id,unit_id,user_id,action,entity_type,
    entity_id,request_id,metadata)
  values(target.clinic_id,target.unit_id,auth.uid(),'charge.coverage_corrected',
    'charge',target.id,p_request_id,jsonb_build_object(
      'previous_from',target.coverage_from,'previous_to',target.coverage_to,
      'coverage_from',p_coverage_from,'coverage_to',p_coverage_to,
      'amount_cents',target.amount_cents,'paid_cents',target.paid_cents,
      'reason',trim(p_reason)));
  return result;
end $$;

revoke all on function public.correct_legacy_charge_coverage(uuid,date,date,date,date,text,uuid) from public,anon;
grant execute on function public.correct_legacy_charge_coverage(uuid,date,date,date,date,text,uuid) to authenticated;


create or replace function public.create_enrollment_charge(p_input jsonb,p_request_id uuid)
returns public.charges
language plpgsql security definer set search_path = '' as $$
declare
  target public.enrollments;
  selected_plan public.plans;
  result public.charges;
  clinic uuid := public.current_clinic_id();
  unit uuid := (p_input->>'unit_id')::uuid;
  patient uuid := (p_input->>'patient_id')::uuid;
  enrollment_id uuid := (p_input->>'enrollment_id')::uuid;
  coverage_start date := (p_input->>'coverage_from')::date;
  coverage_end date := (p_input->>'coverage_to')::date;
  base_amount integer;
  amount integer;
begin
  if clinic is null or not public.has_module_permission('enrollments',false)
     or not public.has_module_permission('enrollments',true) then raise exception 'FORBIDDEN'; end if;
  select * into target from public.enrollments
   where id=enrollment_id and clinic_id=clinic and patient_id=patient and unit_id=unit
     and (status='active' or (status in ('paused','expired') and coverage_end < current_date))
     and deleted_at is null for update;
  if target.id is null then raise exception 'INVALID_ENROLLMENT'; end if;
  if not public.has_unit_access(unit) then raise exception 'UNIT_FORBIDDEN'; end if;
  if coverage_start is null or coverage_end is null or coverage_end<coverage_start
     or coverage_start<target.starts_at or target.ends_at is not null and coverage_end>target.ends_at then
    raise exception 'ENROLLMENT_OUTSIDE_COVERAGE';
  end if;
  if exists(select 1 from public.charges c where c.enrollment_id=target.id and c.clinic_id=clinic
      and c.coverage_from<=coverage_end and c.coverage_to>=coverage_start
      and c.status<>'cancelled' and c.deleted_at is null) then raise exception 'CHARGE_ALREADY_EXISTS'; end if;
  select * into selected_plan from public.plans where id=target.plan_id and clinic_id=clinic and deleted_at is null;
  if selected_plan.id is null then raise exception 'ENROLLMENT_PRICE_UNAVAILABLE'; end if;
  -- A legacy charge without coverage still belongs to the initial prepaid term.
  if selected_plan.duration_days in (90,180) and coverage_start < target.starts_at + selected_plan.duration_days
    and exists(select 1 from public.charges c where c.enrollment_id=target.id and c.clinic_id=clinic
      and c.deleted_at is null and c.status<>'cancelled'
      and (c.coverage_from is null or c.coverage_to is null)
      and date_trunc('month',c.due_at)=date_trunc('month',target.starts_at)) then
    raise exception 'CHARGE_ALREADY_EXISTS';
  end if;
  amount:=public.enrollment_amount_at(target.id,coverage_start,coverage_end);
  if amount<=0 then raise exception 'ENROLLMENT_PRICE_UNAVAILABLE'; end if;
  insert into public.charges(clinic_id,patient_id,enrollment_id,unit_id,description,amount_cents,due_at,coverage_from,coverage_to,status)
  values(clinic,patient,enrollment_id,unit,trim(p_input->>'description'),amount,(p_input->>'due_at')::date,coverage_start,coverage_end,'pending')
  returning * into result;
  insert into public.audit_events(clinic_id,unit_id,user_id,action,entity_type,entity_id,request_id,metadata)
  values(clinic,unit,auth.uid(),'charge.created','charge',result.id,p_request_id,
    jsonb_build_object('enrollment_id',enrollment_id,'amount_cents',amount,'coverage_from',coverage_start,'coverage_to',coverage_end,'contract_pricing',target.contract_amount_cents is not null));
  return result;
end $$;
