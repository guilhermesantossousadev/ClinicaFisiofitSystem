-- Fill missing coverage on an imported charge without changing its amount or receipts.
create function public.correct_legacy_charge_coverage(
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
  if selected_plan.duration_days <> 30 then raise exception 'MONTHLY_ENROLLMENT_REQUIRED'; end if;
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
