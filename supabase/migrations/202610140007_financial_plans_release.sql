-- Incremental financial release. No patient data backfill and no Agenda DDL.
create table public.enrollment_price_terms (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  unit_id uuid not null references public.units(id),
  enrollment_id uuid not null references public.enrollments(id),
  effective_from date not null,
  base_amount_cents integer not null check(base_amount_cents>0),
  discount_cents integer not null check(discount_cents>=0),
  surcharge_cents integer not null check(surcharge_cents>=0),
  created_at timestamptz not null default now(),
  unique(enrollment_id,effective_from),
  check(base_amount_cents-discount_cents+surcharge_cents>0)
);
alter table public.enrollment_price_terms enable row level security;
create policy enrollment_price_terms_read on public.enrollment_price_terms for select to authenticated
using(clinic_id=public.current_clinic_id() and public.has_role(array['admin','manager','finance','reception']::public.user_role[]) and public.has_unit_access(unit_id) and public.has_module_permission('enrollments',false));
revoke all on public.enrollment_price_terms from anon,authenticated;
grant select on public.enrollment_price_terms to authenticated;

-- A shared guard for the narrowly authorized reception financial operations.
create function public.require_enrollment_financial_editor() returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.has_role(array['admin','manager','finance','reception']::public.user_role[])
    or not public.has_module_permission('enrollments',false)
    or (public.current_role()='reception' and not public.has_module_permission('enrollments',true))
    or (public.current_role()<>'reception' and not public.has_module_permission('finance',true)) then
    raise exception 'FORBIDDEN';
  end if;
end $$;
revoke all on function public.require_enrollment_financial_editor() from public,anon,authenticated;

create function public.adjust_charge_amount(p_charge_id uuid,p_expected_amount_cents integer,p_expected_paid_cents integer,p_amount_cents integer,p_reason text,p_request_id uuid)
returns public.charges language plpgsql security definer set search_path='' as $$
declare target public.charges; result public.charges; received integer;
begin
  perform public.require_enrollment_financial_editor();
  if p_amount_cents is null or p_amount_cents<=0 then raise exception 'INVALID_CHARGE_AMOUNT'; end if;
  if length(trim(coalesce(p_reason,'')))<10 then raise exception 'CHARGE_REASON_REQUIRED'; end if;
  select * into target from public.charges where id=p_charge_id and clinic_id=public.current_clinic_id() and deleted_at is null for update;
  if target.id is null then raise exception 'CHARGE_NOT_FOUND'; end if;
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
revoke all on function public.adjust_charge_amount(uuid,integer,integer,integer,text,uuid) from public,anon;
grant execute on function public.adjust_charge_amount(uuid,integer,integer,integer,text,uuid) to authenticated;
-- Compatibility entry point still refuses any payment not reviewed by its caller.
create or replace function public.correct_unpaid_charge_amount(p_charge_id uuid,p_expected_amount_cents integer,p_amount_cents integer,p_reason text,p_request_id uuid)
returns public.charges language sql security definer set search_path='' as $$
 select public.adjust_charge_amount(p_charge_id,p_expected_amount_cents,0,p_amount_cents,p_reason,p_request_id)
$$;

-- Resolve terms by coverage. Never read mutable catalogue prices for an existing contract.
create function public.enrollment_amount_at(p_enrollment_id uuid,p_from date,p_to date) returns integer
language plpgsql security definer set search_path='' as $$
declare e public.enrollments; t public.enrollment_price_terms; amount integer;
begin
 select * into e from public.enrollments where id=p_enrollment_id and clinic_id=public.current_clinic_id() and deleted_at is null;
 if e.id is null or not public.has_unit_access(e.unit_id) or not public.has_module_permission('enrollments',false) then raise exception 'ENROLLMENT_NOT_FOUND'; end if;
 if exists(select 1 from public.enrollment_price_terms where enrollment_id=e.id and effective_from>p_from and effective_from<=p_to)
   or (e.contract_effective_from>p_from and e.contract_effective_from<=p_to) then raise exception 'CONTRACT_PERIOD_SPLIT'; end if;
 select * into t from public.enrollment_price_terms where enrollment_id=e.id and effective_from<=p_from order by effective_from desc limit 1;
 if t.id is not null then amount:=t.base_amount_cents-t.discount_cents+t.surcharge_cents;
 elsif e.contract_amount_cents is not null and e.contract_effective_from<=p_from then amount:=e.contract_amount_cents-e.discount_cents+e.surcharge_cents;
 else raise exception 'CONTRACT_PRICE_UNCONFIRMED'; end if;
 return amount;
end $$;
revoke all on function public.enrollment_amount_at(uuid,date,date) from public,anon;
grant execute on function public.enrollment_amount_at(uuid,date,date) to authenticated;

create or replace function public.set_enrollment_contract_amount(p_enrollment_id uuid,p_expected_amount_cents integer,p_amount_cents integer,p_effective_from date,p_reason text,p_request_id uuid)
returns public.enrollments language plpgsql security definer set search_path='' as $$
declare target public.enrollments; result public.enrollments; base_amount integer; until_date date;
begin
 perform public.require_enrollment_financial_editor();
 if p_amount_cents is null or p_amount_cents<=0 or p_effective_from is null or extract(day from p_effective_from)<>1 or length(trim(coalesce(p_reason,'')))<10 then raise exception 'INVALID_CONTRACT_TERMS'; end if;
 select * into target from public.enrollments where id=p_enrollment_id and clinic_id=public.current_clinic_id() and deleted_at is null for update;
 if target.id is null then raise exception 'ENROLLMENT_NOT_FOUND'; end if;
 if not public.has_unit_access(target.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
 if target.status<>'active' or p_effective_from<date_trunc('month',target.starts_at)::date or (target.ends_at is not null and p_effective_from>target.ends_at) then raise exception 'ENROLLMENT_NOT_ACTIVE'; end if;
 if target.contract_amount_cents is distinct from p_expected_amount_cents then raise exception 'CONTRACT_AMOUNT_CONFLICT'; end if;
 select min(d) into until_date from (
   select effective_from d from public.enrollment_price_terms where enrollment_id=target.id and effective_from>p_effective_from
   union all select target.contract_effective_from where target.contract_effective_from>p_effective_from
 ) boundaries;
 base_amount:=p_amount_cents+target.discount_cents-target.surcharge_cents;
 if base_amount<=0 then raise exception 'INVALID_CONTRACT_TERMS'; end if;
 perform 1 from public.charges where enrollment_id=target.id and deleted_at is null order by id for update;
 if exists(select 1 from public.charges c where c.enrollment_id=target.id and c.deleted_at is null and c.status<>'cancelled'
   and (until_date is null or coalesce(c.coverage_from,c.due_at)<until_date)
   and ((c.coverage_from<p_effective_from and c.coverage_to>=p_effective_from)
     or (until_date is not null and c.coverage_from<until_date and c.coverage_to>=until_date)
     or ((c.coverage_to>=p_effective_from or (c.coverage_from is null and c.due_at>=p_effective_from)) and c.amount_cents<>p_amount_cents))) then raise exception 'CONTRACT_HAS_FUTURE_CHARGES'; end if;
 -- Save the previous explicit snapshot before changing its effective date.
 if target.contract_amount_cents is not null then
   insert into public.enrollment_price_terms(clinic_id,unit_id,enrollment_id,effective_from,base_amount_cents,discount_cents,surcharge_cents)
   values(target.clinic_id,target.unit_id,target.id,target.contract_effective_from,target.contract_amount_cents,target.discount_cents,target.surcharge_cents) on conflict do nothing;
 end if;
 insert into public.enrollment_price_terms(clinic_id,unit_id,enrollment_id,effective_from,base_amount_cents,discount_cents,surcharge_cents)
 values(target.clinic_id,target.unit_id,target.id,p_effective_from,base_amount,target.discount_cents,target.surcharge_cents)
 on conflict(enrollment_id,effective_from) do update set base_amount_cents=excluded.base_amount_cents,discount_cents=excluded.discount_cents,surcharge_cents=excluded.surcharge_cents;
 update public.enrollments set contract_amount_cents=case when contract_effective_from>p_effective_from then contract_amount_cents else base_amount end,contract_effective_from=case when contract_effective_from>p_effective_from then contract_effective_from else p_effective_from end,updated_at=now() where id=target.id returning * into result;
 insert into public.audit_events(clinic_id,unit_id,user_id,action,entity_type,entity_id,request_id,metadata)
 values(target.clinic_id,target.unit_id,auth.uid(),'enrollment.contract_amount_changed','enrollment',target.id,p_request_id,
 jsonb_build_object('previous_amount_cents',target.contract_amount_cents,'previous_effective_from',target.contract_effective_from,'amount_cents',base_amount,'final_amount_cents',p_amount_cents,'effective_from',p_effective_from,'discount_cents',target.discount_cents,'surcharge_cents',target.surcharge_cents,'reason',trim(p_reason)));
 return result;
end $$;

-- Preserve the existing enrollment creation and noncommercial editing implementation.
alter function public.save_enrollment(jsonb,uuid,uuid) rename to save_enrollment_before_financial_release;
revoke all on function public.save_enrollment_before_financial_release(jsonb,uuid,uuid) from public,anon,authenticated;
create function public.save_enrollment(p_input jsonb,p_request_id uuid,p_id uuid default null) returns public.enrollments
language plpgsql security definer set search_path='' as $$
declare e public.enrollments;
begin
 if p_id is not null then
   select * into e from public.enrollments where id=p_id and clinic_id=public.current_clinic_id() and deleted_at is null for update;
   if e.id is null then raise exception 'ENROLLMENT_NOT_FOUND'; end if;
   if (p_input ? 'plan_id' and (p_input->>'plan_id')::uuid is distinct from e.plan_id)
      or (p_input ? 'starts_at' and (p_input->>'starts_at')::date is distinct from e.starts_at)
      or (p_input ? 'ends_at' and nullif(p_input->>'ends_at','')::date is distinct from e.ends_at) then raise exception 'USE_PLAN_CHANGE'; end if;
 else
   -- Serialize price snapshot with catalogue editing.
   perform 1 from public.plans where id=(p_input->>'plan_id')::uuid and clinic_id=public.current_clinic_id() for share;
 end if;
 return public.save_enrollment_before_financial_release(p_input,p_request_id,p_id);
end $$;
revoke all on function public.save_enrollment(jsonb,uuid,uuid) from public,anon;
grant execute on function public.save_enrollment(jsonb,uuid,uuid) to authenticated;

-- Keep the existing charge validations and audit; change only the price source and overlap guard.
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

create function public.preview_enrollment_plan_change(p_enrollment_id uuid,p_plan_id uuid,p_effective_from date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.enrollments; p public.plans; charges jsonb; token text; stop_at date; months integer; proposed jsonb;
begin
 if not public.has_role(array['admin','manager','reception','finance']::public.user_role[]) or not public.has_module_permission('enrollments',false) or not public.has_module_permission('enrollments',true) then raise exception 'FORBIDDEN'; end if;
 select * into e from public.enrollments where id=p_enrollment_id and clinic_id=public.current_clinic_id() and deleted_at is null;
 if e.id is null then raise exception 'ENROLLMENT_NOT_FOUND'; end if;
 if not public.has_unit_access(e.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
 if e.status<>'active' or p_effective_from<=e.starts_at or (e.ends_at is not null and p_effective_from>e.ends_at+1) then raise exception 'ENROLLMENT_NOT_ACTIVE'; end if;
 if p_effective_from is null or extract(day from p_effective_from)<>1 or p_effective_from<current_date then raise exception 'INVALID_PLAN_CHANGE_DATE'; end if;
 select * into p from public.plans where id=p_plan_id and clinic_id=e.clinic_id and deleted_at is null;
 if p.id is null then raise exception 'PLAN_NOT_FOUND'; end if;
 if not p.active then raise exception 'PLAN_INACTIVE'; end if;
 if p.id=e.plan_id then raise exception 'PLAN_UNCHANGED'; end if;
 if p.price_cents<=0 or p.duration_days not in(30,90,180) or p.sessions_included not in(p.duration_days/30*4,p.duration_days/30*8,p.duration_days/30*12) then raise exception 'INVALID_PLAN_COMBINATION'; end if;
 if exists(select 1 from public.enrollments where clinic_id=e.clinic_id and patient_id=e.patient_id and unit_id=e.unit_id and plan_id=p.id and status='active' and deleted_at is null and id<>e.id and coalesce(ends_at,'infinity'::date)>=p_effective_from) then raise exception 'ENROLLMENT_ALREADY_ACTIVE'; end if;
 if exists(select 1 from public.charges c where c.enrollment_id=e.id and c.deleted_at is null and c.status<>'cancelled' and (
   (c.coverage_from is null or c.coverage_to is null) and c.due_at>=p_effective_from)) then raise exception 'PLAN_CHANGE_UNKNOWN_COVERAGE'; end if;
 if exists(select 1 from public.charges c where c.enrollment_id=e.id and c.deleted_at is null and c.status<>'cancelled' and c.coverage_from<p_effective_from and c.coverage_to>=p_effective_from) then raise exception 'PLAN_CHANGE_COVERAGE_CONFLICT'; end if;
 if exists(select 1 from public.charges c where c.enrollment_id=e.id and c.deleted_at is null and c.status<>'cancelled' and c.coverage_to>=p_effective_from and (c.paid_cents>0 or exists(select 1 from public.payments pay where pay.charge_id=c.id and pay.reversed_at is null))) then raise exception 'PLAN_CHANGE_FUTURE_RECEIPTS'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'amount_cents',amount_cents,'paid_cents',paid_cents,'status',status,'coverage_from',coverage_from,'coverage_to',coverage_to,'updated_at',updated_at) order by id),'[]'::jsonb),greatest(coalesce(max(coverage_to),p_effective_from),p_effective_from)
 into charges,stop_at from public.charges where enrollment_id=e.id and deleted_at is null and status<>'cancelled';
 months:=p.duration_days/30;
 select jsonb_agg(jsonb_build_object('coverage_from',d::date,'coverage_to',(d+make_interval(months=>months)-interval '1 day')::date,'amount_cents',p.price_cents) order by d)
 into proposed from generate_series(p_effective_from::timestamp,stop_at::timestamp,make_interval(months=>months)) d;
 token:=md5(e::text||p::text||charges::text||p_effective_from::text);
 return jsonb_build_object('token',token,'enrollment_id',e.id,'current_plan_id',e.plan_id,'current_contract_amount_cents',e.contract_amount_cents,'discount_cents',e.discount_cents,'surcharge_cents',e.surcharge_cents,'new_plan_name',p.name,'new_amount_cents',p.price_cents,'effective_from',p_effective_from,'charges',charges,'proposed_charges',proposed,
 'cancel_charge_ids',coalesce((select jsonb_agg(c.id order by c.id) from public.charges c where c.enrollment_id=e.id and c.deleted_at is null and c.status<>'cancelled' and c.coverage_from>=p_effective_from),'[]'::jsonb));
end $$;
revoke all on function public.preview_enrollment_plan_change(uuid,uuid,date) from public,anon;
grant execute on function public.preview_enrollment_plan_change(uuid,uuid,date) to authenticated;

create function public.change_enrollment_plan(p_enrollment_id uuid,p_plan_id uuid,p_effective_from date,p_expected_token text,p_reason text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.enrollments; p public.plans; preview jsonb; successor public.enrollments; c public.charges; proposed jsonb; new_charge public.charges;
begin
 if length(trim(coalesce(p_reason,'')))<10 then raise exception 'CHARGE_REASON_REQUIRED'; end if;
 select * into e from public.enrollments where id=p_enrollment_id and clinic_id=public.current_clinic_id() and deleted_at is null for update;
 if e.id is null then raise exception 'ENROLLMENT_NOT_FOUND'; end if;
 perform pg_advisory_xact_lock(hashtextextended(e.clinic_id::text||e.patient_id::text||e.unit_id::text||p_plan_id::text,0));
 select * into p from public.plans where id=p_plan_id and clinic_id=e.clinic_id for share;
 perform 1 from public.charges where enrollment_id=e.id and deleted_at is null order by id for update;
 preview:=public.preview_enrollment_plan_change(e.id,p_plan_id,p_effective_from);
 if p_expected_token is distinct from preview->>'token' then raise exception 'CONTRACT_AMOUNT_CONFLICT'; end if;
 insert into public.enrollments(clinic_id,unit_id,patient_id,plan_id,starts_at,due_day,discount_cents,surcharge_cents,contract_amount_cents,contract_effective_from)
 values(e.clinic_id,e.unit_id,e.patient_id,p.id,p_effective_from,e.due_day,0,0,p.price_cents,p_effective_from) returning * into successor;
 update public.enrollments set ends_at=p_effective_from-1,updated_at=now() where id=e.id;
 for c in select * from public.charges where enrollment_id=e.id and deleted_at is null and status<>'cancelled' and coverage_from>=p_effective_from loop
   update public.charges set status='cancelled',updated_at=now() where id=c.id;
   insert into public.audit_events(clinic_id,unit_id,user_id,action,entity_type,entity_id,request_id,metadata)
   values(e.clinic_id,e.unit_id,auth.uid(),'charge.cancelled_for_plan_change','charge',c.id,p_request_id,jsonb_build_object('previous_status',c.status,'amount_cents',c.amount_cents,'successor_enrollment_id',successor.id,'reason',trim(p_reason)));
 end loop;
 for proposed in select * from jsonb_array_elements(preview->'proposed_charges') loop
   insert into public.charges(clinic_id,unit_id,patient_id,enrollment_id,description,amount_cents,due_at,coverage_from,coverage_to,status)
   values(e.clinic_id,e.unit_id,e.patient_id,successor.id,'Troca de plano — '||p.name,p.price_cents,
    ((proposed->>'coverage_from')::date+least(coalesce(e.due_day,1),28)-1),(proposed->>'coverage_from')::date,(proposed->>'coverage_to')::date,'pending') returning * into new_charge;
   insert into public.audit_events(clinic_id,unit_id,user_id,action,entity_type,entity_id,request_id,metadata)
   values(e.clinic_id,e.unit_id,auth.uid(),'charge.created','charge',new_charge.id,p_request_id,jsonb_build_object('plan_change',true,'enrollment_id',successor.id,'amount_cents',p.price_cents,'reason',trim(p_reason)));
 end loop;
 insert into public.audit_events(clinic_id,unit_id,user_id,action,entity_type,entity_id,request_id,metadata)
 values(e.clinic_id,e.unit_id,auth.uid(),'enrollment.plan_changed','enrollment',e.id,p_request_id,
  jsonb_build_object('previous_plan_id',e.plan_id,'successor_enrollment_id',successor.id,'new_plan_id',p.id,'effective_from',p_effective_from,'previous_ends_at',e.ends_at,'preview',preview,'reason',trim(p_reason)));
 return jsonb_build_object('previous_enrollment_id',e.id,'enrollment',to_jsonb(successor));
end $$;
revoke all on function public.change_enrollment_plan(uuid,uuid,date,text,text,uuid) from public,anon;
grant execute on function public.change_enrollment_plan(uuid,uuid,date,text,text,uuid) to authenticated;

-- Catalogue writes are transactional and audited; no rows are seeded and no prices invented.
create function public.save_plan(p_input jsonb,p_request_id uuid,p_id uuid default null) returns public.plans
language plpgsql security definer set search_path='' as $$
declare target public.plans; result public.plans; duration integer; sessions integer; price integer; plan_kind text; label text;
begin
 if not public.has_role(array['admin','manager','finance']::public.user_role[]) or not public.has_module_permission('enrollments',false) or not public.has_module_permission('enrollments',true) then raise exception 'FORBIDDEN'; end if;
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
revoke all on function public.save_plan(jsonb,uuid,uuid) from public,anon;
grant execute on function public.save_plan(jsonb,uuid,uuid) to authenticated;

-- The current UI also compares the enrollment revision, so equal-price concurrent
-- changes of date/status cannot overwrite a newly reviewed condition.
create function public.set_enrollment_contract_terms(p_enrollment_id uuid,p_expected_updated_at timestamptz,p_expected_amount_cents integer,p_amount_cents integer,p_effective_from date,p_reason text,p_request_id uuid)
returns public.enrollments language plpgsql security definer set search_path='' as $$
declare target public.enrollments;
begin
 perform public.require_enrollment_financial_editor();
 select * into target from public.enrollments where id=p_enrollment_id and clinic_id=public.current_clinic_id() and deleted_at is null for update;
 if target.id is null then raise exception 'ENROLLMENT_NOT_FOUND'; end if;
 if not public.has_unit_access(target.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
 if target.updated_at is distinct from p_expected_updated_at then raise exception 'CONTRACT_AMOUNT_CONFLICT'; end if;
 return public.set_enrollment_contract_amount(p_enrollment_id,p_expected_amount_cents,p_amount_cents,p_effective_from,p_reason,p_request_id);
end $$;
revoke all on function public.set_enrollment_contract_terms(uuid,timestamptz,integer,integer,date,text,uuid) from public,anon;
grant execute on function public.set_enrollment_contract_terms(uuid,timestamptz,integer,integer,date,text,uuid) to authenticated;
