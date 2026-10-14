-- Allow reception to perform only the audited amount adjustments explicitly
-- approved by the business. The RPCs retain their clinic/unit/state checks.
create or replace function public.correct_unpaid_charge_amount(
  p_charge_id uuid,
  p_expected_amount_cents integer,
  p_amount_cents integer,
  p_reason text,
  p_request_id uuid
) returns public.charges
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.charges;
  result public.charges;
begin
  if not public.has_role(array['admin','manager','finance','reception']::public.user_role[])
     or (public.current_role() = 'reception' and not public.has_module_permission('enrollments', false))
     or (public.current_role() <> 'reception' and not public.has_module_permission('finance', true)) then
    raise exception 'FORBIDDEN';
  end if;
  if p_expected_amount_cents is null or p_expected_amount_cents <= 0
     or p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'INVALID_CHARGE_AMOUNT';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 10 then raise exception 'CHARGE_REASON_REQUIRED'; end if;

  select * into target from public.charges
   where id = p_charge_id and clinic_id = public.current_clinic_id() and deleted_at is null
   for update;
  if target.id is null then raise exception 'CHARGE_NOT_EDITABLE'; end if;
  if not public.has_unit_access(target.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
  if target.status not in ('pending', 'overdue') or target.amount_cents <> p_expected_amount_cents then
    raise exception 'CHARGE_AMOUNT_CONFLICT';
  end if;
  if target.paid_cents <> 0 or exists (
    select 1 from public.payments p where p.clinic_id = target.clinic_id and p.charge_id = target.id
  ) then raise exception 'CHARGE_HAS_PAYMENTS'; end if;

  update public.charges set amount_cents = p_amount_cents, updated_at = now()
   where id = target.id and clinic_id = target.clinic_id and amount_cents = p_expected_amount_cents
     and paid_cents = 0 and status in ('pending', 'overdue')
   returning * into result;
  if result.id is null then raise exception 'CHARGE_AMOUNT_CONFLICT'; end if;

  insert into public.audit_events(clinic_id, unit_id, user_id, action, entity_type, entity_id, request_id, metadata)
  values (target.clinic_id, target.unit_id, auth.uid(), 'charge.amount_corrected', 'charge', target.id, p_request_id,
    jsonb_build_object('previous_amount_cents', target.amount_cents, 'amount_cents', p_amount_cents, 'reason', trim(p_reason)));
  return result;
end
$$;
revoke all on function public.correct_unpaid_charge_amount(uuid, integer, integer, text, uuid) from public, anon;
grant execute on function public.correct_unpaid_charge_amount(uuid, integer, integer, text, uuid) to authenticated;

create or replace function public.set_enrollment_contract_amount(
  p_enrollment_id uuid,
  p_expected_amount_cents integer,
  p_amount_cents integer,
  p_effective_from date,
  p_reason text,
  p_request_id uuid
) returns public.enrollments
language plpgsql security definer set search_path = '' as $$
declare
  target public.enrollments;
  result public.enrollments;
  base_amount integer;
begin
  if not public.has_role(array['admin','manager','finance','reception']::public.user_role[])
     or (public.current_role() = 'reception' and not public.has_module_permission('enrollments', false))
     or (public.current_role() <> 'reception' and not public.has_module_permission('finance', true)) then
    raise exception 'FORBIDDEN';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0
     or p_effective_from is null or extract(day from p_effective_from) <> 1
     or length(trim(coalesce(p_reason, ''))) < 10 then raise exception 'INVALID_CONTRACT_TERMS'; end if;

  select * into target from public.enrollments
   where id = p_enrollment_id and clinic_id = public.current_clinic_id() and deleted_at is null for update;
  if target.id is null then raise exception 'ENROLLMENT_NOT_FOUND'; end if;
  if not public.has_unit_access(target.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
  if not exists(select 1 from public.plans where id=target.plan_id and clinic_id=target.clinic_id and kind='monthly' and deleted_at is null) then
    raise exception 'CONTRACT_ONLY_MONTHLY_PLAN';
  end if;
  if target.status <> 'active' or target.ends_at is not null and p_effective_from > target.ends_at then raise exception 'ENROLLMENT_NOT_ACTIVE'; end if;
  base_amount := p_amount_cents + target.discount_cents - target.surcharge_cents;
  if base_amount <= 0 then raise exception 'INVALID_CONTRACT_TERMS'; end if;
  if target.contract_amount_cents is distinct from p_expected_amount_cents then raise exception 'CONTRACT_AMOUNT_CONFLICT'; end if;
  if exists (
    select 1 from public.charges c where c.enrollment_id = target.id and c.clinic_id = target.clinic_id
      and c.deleted_at is null and c.status <> 'cancelled'
      and (c.coverage_to >= p_effective_from or (c.coverage_from is null and c.coverage_to is null and c.due_at >= p_effective_from))
      and c.amount_cents <> p_amount_cents
  ) then raise exception 'CONTRACT_HAS_FUTURE_CHARGES'; end if;

  update public.enrollments set contract_amount_cents = base_amount, contract_effective_from = p_effective_from, updated_at = now()
   where id = target.id and contract_amount_cents is not distinct from p_expected_amount_cents returning * into result;
  if result.id is null then raise exception 'CONTRACT_AMOUNT_CONFLICT'; end if;
  insert into public.audit_events(clinic_id,unit_id,user_id,action,entity_type,entity_id,request_id,metadata)
  values(target.clinic_id,target.unit_id,auth.uid(),'enrollment.contract_amount_changed','enrollment',target.id,p_request_id,
    jsonb_build_object('previous_amount_cents',target.contract_amount_cents,'amount_cents',base_amount,
      'monthly_final_amount_cents',p_amount_cents,'effective_from',p_effective_from,'reason',trim(p_reason)));
  return result;
end $$;
revoke all on function public.set_enrollment_contract_amount(uuid,integer,integer,date,text,uuid) from public, anon;
grant execute on function public.set_enrollment_contract_amount(uuid,integer,integer,date,text,uuid) to authenticated;

-- Reception reads charges only as part of the enrollment Control Plans view.
-- No DML grants are introduced by this migration.
drop policy if exists charges_select on public.charges;
create policy charges_select on public.charges for select to authenticated
using (
  clinic_id = public.current_clinic_id()
  and public.has_unit_access(unit_id)
  and public.has_role(array['admin','manager','finance','reception']::public.user_role[])
  and public.has_module_permission('enrollments', false)
);
