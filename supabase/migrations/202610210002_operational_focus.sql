-- Temporary operational workspace. The original profile roles and grants stay
-- stored, so the clinic can restore the full product in a later migration.
-- Every active login acts as reception for the four operational areas only.
create or replace function public.current_role()
returns public.user_role language sql stable security definer set search_path = '' as $$
  select 'reception'::public.user_role
  from public.profiles p
  where p.id = auth.uid() and p.status = 'active' and p.deleted_at is null
  limit 1
$$;

create or replace function public.has_module_permission(target_module text, edit_access boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select target_module in ('patients', 'enrollments', 'agenda')
    and public.current_clinic_id() is not null
$$;

-- Payment reads are limited to enrollment charges in the caller's clinic and
-- assigned unit. Standalone finance records remain outside the workspace.
create or replace function public.can_access_charge(target_charge uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.charges c
    join public.enrollments e on e.id = c.enrollment_id
    where c.id = target_charge and c.clinic_id = public.current_clinic_id()
      and c.deleted_at is null and e.clinic_id = c.clinic_id
      and e.unit_id = c.unit_id and e.patient_id = c.patient_id
      and e.deleted_at is null and public.has_unit_access(c.unit_id)
      and public.has_module_permission('enrollments', false)
  )
$$;

drop policy if exists payments_module_read on public.payments;
create policy payments_module_read on public.payments as restrictive for select to authenticated
using (public.has_module_permission('enrollments', false));

create policy charges_operational_scope on public.charges as restrictive for select to authenticated
using (
  enrollment_id is not null
  and exists (
    select 1 from public.enrollments e
    where e.id = charges.enrollment_id and e.clinic_id = charges.clinic_id
      and e.unit_id = charges.unit_id and e.patient_id = charges.patient_id
      and e.deleted_at is null
  )
);

-- RPCs below retain their transaction, pricing, idempotency and audit checks.

-- Amount corrections are confined to enrollment charges.
create or replace function public.adjust_charge_amount(p_charge_id uuid,p_expected_amount_cents integer,p_expected_paid_cents integer,p_amount_cents integer,p_reason text,p_request_id uuid)
returns public.charges language plpgsql security definer set search_path='' as $$
declare target public.charges; result public.charges; received integer;
begin
  perform public.require_enrollment_financial_editor();
  if p_amount_cents is null or p_amount_cents<=0 then raise exception 'INVALID_CHARGE_AMOUNT'; end if;
  if length(trim(coalesce(p_reason,'')))<10 then raise exception 'CHARGE_REASON_REQUIRED'; end if;
  select * into target from public.charges where id=p_charge_id and clinic_id=public.current_clinic_id() and deleted_at is null for update;
  if target.id is null or target.enrollment_id is null then raise exception 'CHARGE_NOT_FOUND'; end if;
  if not public.has_unit_access(target.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
  if target.status='cancelled' or target.amount_cents is distinct from p_expected_amount_cents or target.paid_cents is distinct from p_expected_paid_cents then raise exception 'CHARGE_AMOUNT_CONFLICT'; end if;
  select coalesce(sum(amount_cents),0)::integer into received from public.payments where charge_id=target.id and clinic_id=target.clinic_id and reversed_at is null;
  if received<>target.paid_cents then raise exception 'PAYMENT_BALANCE_CONFLICT'; end if;
  if p_amount_cents<received then raise exception 'AMOUNT_BELOW_RECEIVED'; end if;
  update public.charges set amount_cents=p_amount_cents,
    status=case when received>=p_amount_cents then 'paid'::public.charge_status when received>0 then 'partial'::public.charge_status when due_at<current_date then 'overdue'::public.charge_status else 'pending'::public.charge_status end,
    updated_at=now() where id=target.id returning * into result;
  insert into public.audit_events(clinic_id,unit_id,user_id,action,entity_type,entity_id,request_id,metadata)
  values(target.clinic_id,target.unit_id,auth.uid(),'charge.amount_corrected','charge',target.id,p_request_id,
    jsonb_build_object('previous_amount_cents',target.amount_cents,'amount_cents',result.amount_cents,'paid_cents',received,'previous_status',target.status,'status',result.status,'reason',trim(p_reason)));
  return result;
end $$;

-- All active logins share the validated catalogue transaction.
create or replace function public.save_plan(p_input jsonb,p_request_id uuid,p_id uuid default null) returns public.plans
language plpgsql security definer set search_path='' as $$
declare target public.plans; result public.plans; duration integer; sessions integer; price integer; plan_kind text; label text;
begin
 if public.current_clinic_id() is null or not public.has_module_permission('enrollments',false) or not public.has_module_permission('enrollments',true) then raise exception 'FORBIDDEN'; end if;
 perform pg_advisory_xact_lock(hashtextextended(public.current_clinic_id()::text||'catalogue',0));
 if p_id is not null then
  select * into target from public.plans where id=p_id and clinic_id=public.current_clinic_id() and deleted_at is null for update;
  if target.id is null then raise exception 'PLAN_NOT_FOUND'; end if;
 end if;
 duration:=coalesce((p_input->>'duration_days')::integer,target.duration_days);
 sessions:=coalesce((p_input->>'sessions_included')::integer,target.sessions_included);
 price:=coalesce((p_input->>'price_cents')::integer,target.price_cents);
 if duration is null or sessions is null or duration not in(30,90,180) or sessions not in(duration/30*4,duration/30*8,duration/30*12) or price is null or price<=0 then raise exception 'INVALID_PLAN_COMBINATION'; end if;
 plan_kind:=case when duration=30 then 'monthly' else 'package' end;
 label:=case duration when 30 then 'Mensal' when 90 then 'Trimestral' else 'Semestral' end||' · '||(sessions/(duration/30*4))::text||'x por semana';
 if (p_id is null or target.duration_days is distinct from duration or target.sessions_included is distinct from sessions) and exists(select 1 from public.plans where clinic_id=public.current_clinic_id() and deleted_at is null and duration_days=duration and sessions_included=sessions and (p_id is null or id<>p_id)) then raise exception 'PLAN_COMBINATION_EXISTS'; end if;
 if p_id is not null and (duration is distinct from target.duration_days or sessions is distinct from target.sessions_included) and exists(select 1 from public.enrollments where plan_id=p_id and deleted_at is null) then raise exception 'PLAN_STRUCTURE_IN_USE'; end if;
 if p_id is null then
 insert into public.plans(clinic_id,name,kind,sessions_included,duration_days,price_cents,active) values(public.current_clinic_id(),label,plan_kind,sessions,duration,price,coalesce((p_input->>'active')::boolean,true)) returning * into result;
 else
 update public.plans set name=coalesce(nullif(trim(p_input->>'name'),''),target.name),kind=plan_kind,sessions_included=sessions,duration_days=duration,price_cents=price,active=coalesce((p_input->>'active')::boolean,target.active),updated_at=now() where id=p_id returning * into result;
 end if;
 insert into public.audit_events(clinic_id,user_id,action,entity_type,entity_id,request_id,metadata)
 values(result.clinic_id,auth.uid(),case when p_id is null then 'plan.created' else 'plan.updated' end,'plan',result.id,p_request_id,jsonb_build_object('before',case when target.id is null then null else to_jsonb(target) end,'after',to_jsonb(result)));
 return result;
end $$;

-- Historical charges remain linked to a valid contract and coverage.
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
