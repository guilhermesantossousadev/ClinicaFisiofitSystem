-- Show the precise persisted coverage before an operator creates a historical charge.
create function public.preview_historical_monthly_charge(
  p_enrollment_id uuid,
  p_month date
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  target public.enrollments;
  month_end date;
  previous_coverage_to date;
  expected_start date;
  existing_count integer;
begin
  perform public.require_enrollment_financial_editor();
  if p_month is null or extract(day from p_month) <> 1 then
    raise exception 'INVALID_HISTORICAL_CHARGE';
  end if;
  select * into target from public.enrollments
    where id = p_enrollment_id and clinic_id = public.current_clinic_id()
      and deleted_at is null;
  if target.id is null then raise exception 'ENROLLMENT_NOT_FOUND'; end if;
  if not public.has_unit_access(target.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
  month_end := (p_month + interval '1 month - 1 day')::date;
  select max(c.coverage_to) into previous_coverage_to from public.charges c
    where c.enrollment_id = target.id and c.deleted_at is null
      and c.status <> 'cancelled' and c.coverage_from < p_month;
  expected_start := greatest(p_month, coalesce(previous_coverage_to + 1,p_month));
  select count(*) into existing_count from public.charges c
    where c.enrollment_id = target.id and c.deleted_at is null
      and c.status <> 'cancelled' and c.coverage_from between p_month and month_end;
  return jsonb_build_object('month',p_month,'previous_coverage_to',previous_coverage_to,
    'coverage_from',expected_start,'coverage_to',month_end,
    'already_charged',existing_count > 0,
    'can_create',target.status = 'active' and expected_start <= month_end
      and existing_count = 0 and p_month <= date_trunc('month',current_date)::date);
end $$;

revoke all on function public.preview_historical_monthly_charge(uuid,date) from public,anon;
grant execute on function public.preview_historical_monthly_charge(uuid,date) to authenticated;
