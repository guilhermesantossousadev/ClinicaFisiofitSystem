-- Create one reviewed, backdated monthly charge without changing recurring terms
-- or touching any previous charge or receipt.
create function public.create_historical_monthly_charge(
  p_enrollment_id uuid,
  p_month date,
  p_coverage_from date,
  p_amount_cents integer,
  p_reason text,
  p_request_id uuid
) returns public.charges
language plpgsql security definer set search_path = '' as $$
declare
  target public.enrollments;
  selected_plan public.plans;
  result public.charges;
  month_end date;
  expected_start date;
begin
  perform public.require_enrollment_financial_editor();
  if p_month is null or extract(day from p_month) <> 1
    or p_month > date_trunc('month', current_date)::date
    or p_amount_cents is null or p_amount_cents <= 0
    or length(trim(coalesce(p_reason,''))) < 10 then
    raise exception 'INVALID_HISTORICAL_CHARGE';
  end if;
  month_end := (p_month + interval '1 month - 1 day')::date;
  select * into target from public.enrollments
    where id = p_enrollment_id and clinic_id = public.current_clinic_id()
      and deleted_at is null for update;
  if target.id is null then raise exception 'ENROLLMENT_NOT_FOUND'; end if;
  if not public.has_unit_access(target.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
  if target.status <> 'active' then raise exception 'ENROLLMENT_NOT_ACTIVE'; end if;
  select * into selected_plan from public.plans
    where id = target.plan_id and clinic_id = target.clinic_id and deleted_at is null;
  if selected_plan.duration_days <> 30 then raise exception 'MONTHLY_ENROLLMENT_REQUIRED'; end if;
  if p_coverage_from is null or p_coverage_from < p_month or p_coverage_from > month_end
    or p_coverage_from < target.starts_at
    or (target.ends_at is not null and month_end > target.ends_at) then
    raise exception 'ENROLLMENT_OUTSIDE_COVERAGE';
  end if;
  perform 1 from public.charges where enrollment_id = target.id and deleted_at is null
    order by id for update;
  select greatest(p_month, coalesce(max(c.coverage_to + 1), p_month))
    into expected_start from public.charges c
    where c.enrollment_id = target.id and c.deleted_at is null
      and c.status <> 'cancelled' and c.coverage_from < p_month;
  if p_coverage_from <> expected_start then
    raise exception 'HISTORICAL_COVERAGE_START_CONFLICT';
  end if;
  if exists(select 1 from public.charges c where c.enrollment_id = target.id
    and c.deleted_at is null and c.status <> 'cancelled'
    and (c.coverage_from between p_month and month_end
      or c.coverage_from <= month_end and c.coverage_to >= p_coverage_from)) then
    raise exception 'CHARGE_ALREADY_EXISTS';
  end if;
  insert into public.charges(clinic_id,patient_id,enrollment_id,unit_id,description,
    amount_cents,due_at,coverage_from,coverage_to,status)
  values(target.clinic_id,target.patient_id,target.id,target.unit_id,
    'Cobrança histórica — ' || selected_plan.name || ' · ' || to_char(p_month,'YYYY-MM'),
    p_amount_cents,p_coverage_from,p_coverage_from,month_end,'pending')
  returning * into result;
  insert into public.audit_events(clinic_id,unit_id,user_id,action,entity_type,
    entity_id,request_id,metadata)
  values(target.clinic_id,target.unit_id,auth.uid(),'charge.historical_created',
    'charge',result.id,p_request_id,jsonb_build_object(
      'enrollment_id',target.id,'month',p_month,'coverage_from',p_coverage_from,
      'coverage_to',month_end,'amount_cents',p_amount_cents,'reason',trim(p_reason)));
  return result;
end $$;

revoke all on function public.create_historical_monthly_charge(uuid,date,date,integer,text,uuid) from public,anon;
grant execute on function public.create_historical_monthly_charge(uuid,date,date,integer,text,uuid) to authenticated;
