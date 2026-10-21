-- Permit operational receipts for reception only on an authorized enrollment.
-- The existing RPC remains the single audited, idempotent payment path.
create or replace function public.register_payment(
  p_charge_id uuid,
  p_amount_cents integer,
  p_method text,
  p_paid_at timestamptz,
  p_idempotency_key text,
  p_request_id uuid
) returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.charges;
  result public.payments;
begin
  if public.current_role() = 'reception' then
    if not public.has_module_permission('enrollments', false)
       or not public.has_module_permission('enrollments', true) then
      raise exception 'FORBIDDEN';
    end if;
  elsif not public.has_role(array['admin','manager','finance']::public.user_role[])
     or not public.has_module_permission('finance', false)
     or not public.has_module_permission('finance', true) then
    raise exception 'FORBIDDEN';
  end if;
  if p_method not in ('pix','card','cash','transfer') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;

  select * into target
    from public.charges
   where id = p_charge_id
     and clinic_id = public.current_clinic_id()
     and deleted_at is null
   for update;
  if target.id is null then raise exception 'CHARGE_NOT_FOUND'; end if;
  if not public.has_unit_access(target.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
  if public.current_role() = 'reception' and not exists (
    select 1 from public.enrollments e
     where e.id = target.enrollment_id
       and e.clinic_id = target.clinic_id
       and e.unit_id = target.unit_id
       and e.patient_id = target.patient_id
       and e.deleted_at is null
  ) then raise exception 'FORBIDDEN'; end if;

  select * into result
    from public.payments
   where clinic_id = target.clinic_id
     and idempotency_key = p_idempotency_key;
  if result.id is not null then
    if result.charge_id is distinct from p_charge_id or result.amount_cents is distinct from p_amount_cents or result.method is distinct from p_method or result.paid_at is distinct from p_paid_at then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return result;
  end if;

  if target.status = 'cancelled' then raise exception 'CHARGE_CANCELLED'; end if;
  if result.id is null and coalesce(trim(p_idempotency_key), '') = '' then raise exception 'IDEMPOTENCY_REQUIRED'; end if;

  if p_amount_cents <= 0 or target.paid_cents + p_amount_cents > target.amount_cents then
    raise exception 'INVALID_PAYMENT_AMOUNT';
  end if;

  insert into public.payments(clinic_id, charge_id, amount_cents, method, paid_at, idempotency_key)
  values(target.clinic_id, target.id, p_amount_cents, p_method, p_paid_at, p_idempotency_key)
  returning * into result;

  update public.charges
     set paid_cents = paid_cents + p_amount_cents,
         status = case
           when paid_cents + p_amount_cents = amount_cents then 'paid'::public.charge_status
           else 'partial'::public.charge_status
         end,
         updated_at = now()
   where id = target.id;

  insert into public.financial_entries(
    clinic_id, unit_id, charge_id, payment_id, kind, description,
    category, amount_cents, competence_date, settled_at
  ) values (
    target.clinic_id, target.unit_id, target.id, result.id, 'income',
    target.description, 'Recebimentos', p_amount_cents, p_paid_at::date, p_paid_at
  );

  insert into public.audit_events(
    clinic_id, unit_id, user_id, action, entity_type, entity_id, request_id, metadata
  ) values (
    target.clinic_id, target.unit_id, auth.uid(), 'payment.created', 'payment',
    result.id, p_request_id, jsonb_build_object('amount_cents', p_amount_cents)
  );

  return result;
end
$$;

-- Allow authorized finance staff to settle a missing historical period when
-- the enrollment and its contracted price were valid for that coverage.
create or replace function public.can_create_financial_charge(
  target_patient uuid,
  target_unit uuid,
  target_enrollment uuid default null
) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    public.has_role(array['admin','manager','finance']::public.user_role[])
    and (public.current_role() = 'admin' or public.has_module_permission('finance', true))
    and public.has_unit_access(target_unit)
    and exists (
      select 1 from public.units u
       where u.id = target_unit
         and u.clinic_id = public.current_clinic_id()
         and u.deleted_at is null
         and u.active
    )
    and exists (
      select 1 from public.patients p
       where p.id = target_patient
         and p.clinic_id = public.current_clinic_id()
         and p.primary_unit_id = target_unit
         and p.deleted_at is null
         and p.active
    )
    and (
      target_enrollment is null or exists (
        select 1 from public.enrollments e
         where e.id = target_enrollment
           and e.clinic_id = public.current_clinic_id()
           and e.patient_id = target_patient
           and e.unit_id = target_unit
           and e.deleted_at is null
      )
    ), false)
$$;

revoke all on function public.can_create_financial_charge(uuid, uuid, uuid)
  from public, anon;
grant execute on function public.can_create_financial_charge(uuid, uuid, uuid)
  to authenticated;

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
  if clinic is null or not public.has_role(array['admin','manager','finance']::public.user_role[])
     or not public.has_module_permission('finance',true) then raise exception 'FORBIDDEN'; end if;
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
revoke all on function public.create_enrollment_charge(jsonb,uuid) from public,anon;
grant execute on function public.create_enrollment_charge(jsonb,uuid) to authenticated;
