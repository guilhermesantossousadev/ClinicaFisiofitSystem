-- Snapshot new enrollment prices and allow audited, per-enrollment future terms.
alter table public.enrollments
  add column contract_amount_cents integer,
  add column contract_effective_from date;

alter table public.enrollments
  add constraint enrollments_contract_amount_positive
    check (contract_amount_cents is null or contract_amount_cents > 0),
  add constraint enrollments_contract_effective_month_start
    check (contract_effective_from is null or extract(day from contract_effective_from) = 1),
  add constraint enrollments_contract_amount_pair
    check ((contract_amount_cents is null) = (contract_effective_from is null));

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
  if not public.has_role(array['admin','manager','finance']::public.user_role[])
     or not public.has_module_permission('finance', true) then raise exception 'FORBIDDEN'; end if;
  if p_amount_cents is null or p_amount_cents <= 0
     or p_effective_from is null or extract(day from p_effective_from) <> 1
     or length(trim(coalesce(p_reason, ''))) < 10 then raise exception 'INVALID_CONTRACT_TERMS'; end if;

  select * into target from public.enrollments
   where id = p_enrollment_id and clinic_id = public.current_clinic_id()
     and deleted_at is null for update;
  if target.id is null then raise exception 'ENROLLMENT_NOT_FOUND'; end if;
  if not public.has_unit_access(target.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
  if not exists(select 1 from public.plans where id=target.plan_id and clinic_id=target.clinic_id and kind='monthly' and deleted_at is null) then
    raise exception 'CONTRACT_ONLY_MONTHLY_PLAN';
  end if;
  if target.status <> 'active' or target.ends_at is not null and p_effective_from > target.ends_at then
    raise exception 'ENROLLMENT_NOT_ACTIVE';
  end if;
  base_amount := p_amount_cents + target.discount_cents - target.surcharge_cents;
  if base_amount <= 0 then raise exception 'INVALID_CONTRACT_TERMS'; end if;
  if target.contract_amount_cents is distinct from p_expected_amount_cents then raise exception 'CONTRACT_AMOUNT_CONFLICT'; end if;
  if exists (
    select 1 from public.charges c where c.enrollment_id = target.id and c.clinic_id = target.clinic_id
      and c.deleted_at is null and c.status <> 'cancelled'
      and (c.coverage_to >= p_effective_from or (c.coverage_from is null and c.coverage_to is null and c.due_at >= p_effective_from))
      and c.amount_cents <> p_amount_cents
  ) then raise exception 'CONTRACT_HAS_FUTURE_CHARGES'; end if;

  update public.enrollments set contract_amount_cents = base_amount,
    contract_effective_from = p_effective_from, updated_at = now()
   where id = target.id and contract_amount_cents is not distinct from p_expected_amount_cents
   returning * into result;
  if result.id is null then raise exception 'CONTRACT_AMOUNT_CONFLICT'; end if;
  insert into public.audit_events(clinic_id,unit_id,user_id,action,entity_type,entity_id,request_id,metadata)
  values(target.clinic_id,target.unit_id,auth.uid(),'enrollment.contract_amount_changed','enrollment',target.id,p_request_id,
    jsonb_build_object('previous_amount_cents',target.contract_amount_cents,'amount_cents',base_amount,
      'monthly_final_amount_cents',p_amount_cents,'effective_from',p_effective_from,'reason',trim(p_reason)));
  return result;
end $$;

revoke all on function public.set_enrollment_contract_amount(uuid,integer,integer,date,text,uuid) from public, anon;
grant execute on function public.set_enrollment_contract_amount(uuid,integer,integer,date,text,uuid) to authenticated;

create or replace function public.save_enrollment(p_input jsonb, p_request_id uuid, p_id uuid default null)
returns public.enrollments
language plpgsql security definer set search_path = '' as $$
declare
  target public.enrollments;
  selected_plan public.plans;
  selected_slot public.group_slots;
  clinic uuid := public.current_clinic_id();
  patient uuid;
  unit uuid;
  plan uuid;
  starts date;
  ends date;
  due integer;
  discount integer;
  surcharge integer;
  amount integer;
  coverage_end date;
  due_date date;
  group_id uuid := nullif(p_input->>'group_slot_id', '')::uuid;
  membership public.group_slot_memberships;
begin
  if clinic is null or not public.has_role(array['admin','manager','reception','finance']::public.user_role[])
    or not public.has_module_permission('enrollments', false) or not public.has_module_permission('enrollments', true) then raise exception 'FORBIDDEN'; end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' then raise exception 'INVALID_ENROLLMENT_INPUT'; end if;
  if exists (select 1 from jsonb_object_keys(p_input) key where key <> all (case when p_id is null
    then array['patient_id','plan_id','unit_id','starts_at','ends_at','due_day','discount_cents','surcharge_cents','group_slot_id']
    else array['plan_id','starts_at','ends_at','sessions_used','status'] end)) then raise exception 'INVALID_ENROLLMENT_INPUT'; end if;
  if p_id is not null then
    select * into target from public.enrollments where id=p_id and clinic_id=clinic and deleted_at is null for update;
    if target.id is null then raise exception 'ENROLLMENT_NOT_FOUND'; end if;
    if target.status='cancelled' then raise exception 'ENROLLMENT_CANCELLED'; end if;
    patient:=target.patient_id; unit:=target.unit_id;
  else patient:=(p_input->>'patient_id')::uuid; unit:=(p_input->>'unit_id')::uuid; end if;
  if unit is null or not public.has_unit_access(unit) or not exists(select 1 from public.units where id=unit and clinic_id=clinic and deleted_at is null) then raise exception 'UNIT_FORBIDDEN'; end if;
  if not exists(select 1 from public.patients where id=patient and clinic_id=clinic and deleted_at is null and (p_id is not null or active) and public.has_unit_access(primary_unit_id)) then raise exception 'PATIENT_NOT_FOUND'; end if;
  plan:=coalesce((p_input->>'plan_id')::uuid,target.plan_id);
  select * into selected_plan from public.plans where id=plan and clinic_id=clinic and deleted_at is null;
  if selected_plan.id is null then raise exception 'PLAN_NOT_FOUND'; end if;
  if not selected_plan.active and (p_id is null or plan<>target.plan_id) then raise exception 'PLAN_INACTIVE'; end if;
  starts:=coalesce((p_input->>'starts_at')::date,target.starts_at);
  ends:=case when p_input ? 'ends_at' then nullif(p_input->>'ends_at','')::date else target.ends_at end;
  due:=coalesce((p_input->>'due_day')::integer,target.due_day);
  discount:=coalesce((p_input->>'discount_cents')::integer,target.discount_cents,0);
  surcharge:=coalesce((p_input->>'surcharge_cents')::integer,target.surcharge_cents,0);
  if starts is null or ends is not null and ends<starts then raise exception 'INVALID_PERIOD'; end if;
  if due is not null and due not between 1 and 31 or discount<0 or surcharge<0 then raise exception 'INVALID_ENROLLMENT_ADJUSTMENTS'; end if;
  if p_input ? 'status' and p_input->>'status' not in ('active','paused','expired') then raise exception 'INVALID_ENROLLMENT_STATUS'; end if;
  if coalesce((p_input->>'sessions_used')::integer,target.sessions_used,0)<0 or selected_plan.sessions_included is not null and coalesce((p_input->>'sessions_used')::integer,target.sessions_used,0)>selected_plan.sessions_included then raise exception 'INVALID_SESSION_COUNT'; end if;
  amount:=selected_plan.price_cents-discount+surcharge;
  if amount<=0 then raise exception 'ENROLLMENT_PRICE_UNAVAILABLE'; end if;
  coverage_end:=coalesce(ends,(date_trunc('month',starts)+make_interval(months=>greatest(1,round(coalesce(selected_plan.duration_days,30)::numeric/30)::integer))-interval '1 day')::date);
  due_date:=case when due is null then starts else (date_trunc('month',starts)::date+(least(due,extract(day from (date_trunc('month',starts)+interval '1 month - 1 day'))::integer)-1)) end;
  if group_id is not null then
    if not public.has_role(array['admin','manager','reception']::public.user_role[]) or not public.has_module_permission('agenda',false) or not public.has_module_permission('agenda',true) then raise exception 'AGENDA_FORBIDDEN'; end if;
    select * into selected_slot from public.group_slots where id=group_id and clinic_id=clinic and unit_id=unit and active and deleted_at is null for update;
    if selected_slot.id is null then raise exception 'GROUP_NOT_FOUND'; end if;
    select * into membership from public.group_slot_memberships where clinic_id=clinic and group_slot_id=group_id and patient_id=patient and status='active' and deleted_at is null limit 1;
    if membership.id is null and (select count(*) from public.group_slot_memberships where group_slot_id=group_id and status='active' and deleted_at is null and starts_at<=coalesce(ends,'infinity'::date) and coalesce(ends_at,'infinity'::date)>=starts)>=selected_slot.capacity then raise exception 'GROUP_CAPACITY_REACHED'; end if;
  end if;
  if p_id is null then
    perform pg_advisory_xact_lock(hashtextextended(clinic::text||patient::text||unit::text||plan::text,0));
    select * into target from public.enrollments where clinic_id=clinic and patient_id=patient and unit_id=unit and plan_id=plan and status='active' and deleted_at is null order by created_at desc limit 1;
    if target.id is not null and (target.starts_at<>starts or target.ends_at is distinct from ends or target.due_day is distinct from due or target.discount_cents<>discount or target.surcharge_cents<>surcharge) then raise exception 'ENROLLMENT_ALREADY_ACTIVE'; end if;
    if target.id is null then
      insert into public.enrollments(clinic_id,patient_id,unit_id,plan_id,starts_at,ends_at,due_day,discount_cents,surcharge_cents,contract_amount_cents,contract_effective_from)
      values(clinic,patient,unit,plan,starts,ends,due,discount,surcharge,selected_plan.price_cents,date_trunc('month',starts)::date) returning * into target;
      insert into public.charges(clinic_id,patient_id,enrollment_id,unit_id,description,amount_cents,due_at,coverage_from,coverage_to,status)
      values(clinic,patient,target.id,unit,'Matrícula — '||selected_plan.name,amount,due_date,starts,coverage_end,'pending');
    end if;
  else
    if plan<>target.plan_id or starts<>target.starts_at or ends is distinct from target.ends_at then
      perform 1 from public.charges where enrollment_id=target.id and clinic_id=clinic and deleted_at is null for update;
      if exists(select 1 from public.charges where enrollment_id=target.id and clinic_id=clinic and deleted_at is null and status<>'cancelled' and paid_cents>0) then raise exception 'ENROLLMENT_HAS_PAYMENTS'; end if;
      if (select count(*) from public.charges where enrollment_id=target.id and clinic_id=clinic and deleted_at is null and status<>'cancelled')>1 then raise exception 'ENROLLMENT_MULTIPLE_CHARGES'; end if;
      update public.charges set amount_cents=amount,description='Matrícula — '||selected_plan.name,due_at=due_date,coverage_from=starts,coverage_to=coverage_end,updated_at=now()
       where enrollment_id=target.id and clinic_id=clinic and deleted_at is null and status<>'cancelled';
    end if;
    update public.enrollments set plan_id=plan,starts_at=starts,ends_at=ends,
      contract_amount_cents=case when plan<>target.plan_id then selected_plan.price_cents else contract_amount_cents end,
      contract_effective_from=case when plan<>target.plan_id then date_trunc('month',starts)::date else contract_effective_from end,
      sessions_used=coalesce((p_input->>'sessions_used')::integer,sessions_used),status=coalesce((p_input->>'status')::public.enrollment_status,status),updated_at=now() where id=target.id returning * into target;
  end if;
  if group_id is not null then
    if membership.id is null then insert into public.group_slot_memberships(clinic_id,group_slot_id,enrollment_id,patient_id,starts_at,ends_at) values(clinic,group_id,target.id,patient,starts,ends);
    elsif membership.enrollment_id is null or membership.enrollment_id=target.id then update public.group_slot_memberships set enrollment_id=target.id,updated_at=now() where id=membership.id;
    else raise exception 'GROUP_HAS_OTHER_ENROLLMENT'; end if;
  end if;
  insert into public.audit_events(clinic_id,unit_id,user_id,action,entity_type,entity_id,request_id,metadata)
  values(clinic,unit,auth.uid(),case when p_id is null then 'enrollment.created' else 'enrollment.updated' end,'enrollment',target.id,p_request_id,jsonb_build_object('transactional',true));
  return target;
end $$;
revoke all on function public.save_enrollment(jsonb,uuid,uuid) from public,anon;
grant execute on function public.save_enrollment(jsonb,uuid,uuid) to authenticated;

-- Serialize charge creation against contract edits by locking the enrollment.
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
     and status='active' and deleted_at is null for update;
  if target.id is null then raise exception 'INVALID_ENROLLMENT'; end if;
  if not public.has_unit_access(unit) then raise exception 'UNIT_FORBIDDEN'; end if;
  if coverage_start is null or coverage_end is null or coverage_end<coverage_start
     or coverage_start<target.starts_at or target.ends_at is not null and coverage_end>target.ends_at then
    raise exception 'ENROLLMENT_OUTSIDE_COVERAGE';
  end if;
  if exists(select 1 from public.charges c where c.enrollment_id=target.id and c.clinic_id=clinic
      and c.coverage_from=coverage_start and c.coverage_to=coverage_end
      and c.status<>'cancelled' and c.deleted_at is null) then raise exception 'CHARGE_ALREADY_EXISTS'; end if;
  select * into selected_plan from public.plans where id=target.plan_id and clinic_id=clinic and deleted_at is null;
  if selected_plan.id is null then raise exception 'ENROLLMENT_PRICE_UNAVAILABLE'; end if;
  base_amount:=selected_plan.price_cents;
  if target.contract_amount_cents is not null and target.contract_effective_from is not null then
    if coverage_start<target.contract_effective_from and coverage_end>=target.contract_effective_from then
      raise exception 'CONTRACT_PERIOD_SPLIT';
    elsif coverage_start>=target.contract_effective_from then base_amount:=target.contract_amount_cents;
    end if;
  end if;
  amount:=base_amount-target.discount_cents+target.surcharge_cents;
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
