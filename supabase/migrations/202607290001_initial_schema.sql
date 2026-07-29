create extension if not exists pgcrypto;

create type public.user_role as enum ('admin','manager','reception','professional','finance');
create type public.member_status as enum ('invited','active','blocked');
create type public.appointment_status as enum ('scheduled','confirmed','attending','completed','missed','cancelled','blocked');
create type public.enrollment_status as enum ('active','paused','expired','cancelled');
create type public.charge_status as enum ('pending','partial','paid','overdue','cancelled');
create type public.record_status as enum ('draft','signed');
create type public.record_kind as enum ('assessment','evolution','rectification');
create type public.financial_kind as enum ('income','expense');
create type public.delivery_status as enum ('pending','processing','sent','delivered','failed','cancelled');
create type public.fiscal_status as enum ('pending','processing','issued','cancelled','error');

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  document text,
  timezone text not null default 'America/Sao_Paulo',
  retention_months integer not null default 240 check (retention_months >= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  name text not null,
  address jsonb not null default '{}'::jsonb,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (clinic_id, name)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  clinic_id uuid not null references public.clinics(id),
  name text not null,
  role public.user_role not null,
  status public.member_status not null default 'invited',
  mfa_required boolean not null default false,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.profile_units (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  primary key (profile_id, unit_id)
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  unit_id uuid not null references public.units(id),
  name text not null,
  capacity integer not null default 1 check (capacity > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (unit_id, name)
);

create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  profile_id uuid references public.profiles(id),
  name text not null,
  council text,
  specialty text,
  commission_type text check (commission_type in ('percent','fixed')),
  commission_value_cents integer check (commission_value_cents is null or commission_value_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.professional_units (
  professional_id uuid not null references public.professionals(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  primary key (professional_id, unit_id)
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  primary_unit_id uuid not null references public.units(id),
  name text not null,
  cpf text,
  birth_date date,
  phone text,
  email text,
  address jsonb not null default '{}'::jsonb,
  tax_data jsonb not null default '{}'::jsonb,
  notes text,
  migration_source text,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index patients_clinic_cpf_unique on public.patients(clinic_id, cpf) where cpf is not null and deleted_at is null;
create index patients_clinic_name_idx on public.patients(clinic_id, lower(name)) where deleted_at is null;

create table public.responsibles (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  patient_id uuid not null references public.patients(id),
  name text not null,
  relationship text,
  cpf text,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  patient_id uuid not null references public.patients(id),
  kind text not null,
  granted boolean not null,
  granted_at timestamptz,
  revoked_at timestamptz,
  evidence_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  name text not null,
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  price_cents integer not null check (price_cents >= 0),
  color text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  name text not null,
  kind text not null check (kind in ('monthly','package','single')),
  sessions_included integer check (sessions_included is null or sessions_included > 0),
  duration_days integer check (duration_days is null or duration_days > 0),
  price_cents integer not null check (price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.group_slots (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  unit_id uuid not null references public.units(id),
  room_id uuid not null references public.rooms(id),
  professional_id uuid not null references public.professionals(id),
  service_id uuid not null references public.services(id),
  name text not null,
  weekdays smallint[] not null,
  starts_at time not null,
  duration_minutes integer not null check (duration_minutes between 15 and 240),
  capacity integer not null default 7 check (capacity between 3 and 7),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (cardinality(weekdays) between 1 and 7 and weekdays <@ array[0,1,2,3,4,5,6]::smallint[])
);
create index group_slots_unit_time_idx on public.group_slots(unit_id, starts_at) where deleted_at is null;

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  patient_id uuid not null references public.patients(id),
  plan_id uuid not null references public.plans(id),
  unit_id uuid not null references public.units(id),
  starts_at date not null,
  ends_at date,
  due_day integer check (due_day between 1 and 31),
  sessions_used integer not null default 0 check (sessions_used >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  surcharge_cents integer not null default 0 check (surcharge_cents >= 0),
  status public.enrollment_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.group_slot_memberships (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  group_slot_id uuid not null references public.group_slots(id),
  enrollment_id uuid not null references public.enrollments(id),
  patient_id uuid not null references public.patients(id),
  starts_at date not null,
  ends_at date,
  status text not null default 'active' check (status in ('active','paused','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (group_slot_id, patient_id, starts_at)
);
create index group_slot_memberships_active_idx on public.group_slot_memberships(group_slot_id, starts_at, ends_at) where deleted_at is null;

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  unit_id uuid not null references public.units(id),
  patient_id uuid references public.patients(id),
  professional_id uuid references public.professionals(id),
  service_id uuid references public.services(id),
  room_id uuid references public.rooms(id),
  enrollment_id uuid references public.enrollments(id),
  group_slot_id uuid references public.group_slots(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  recurrence_id uuid,
  status public.appointment_status not null default 'scheduled',
  notes text,
  session_consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (ends_at > starts_at)
);
create index appointments_professional_time_idx on public.appointments(professional_id, starts_at, ends_at) where deleted_at is null;
create index appointments_room_time_idx on public.appointments(room_id, starts_at, ends_at) where deleted_at is null;
create index appointments_unit_time_idx on public.appointments(unit_id, starts_at) where deleted_at is null;

create table public.record_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  name text not null,
  kind public.record_kind not null,
  specialty text,
  schema jsonb not null,
  version integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clinical_records (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  patient_id uuid not null references public.patients(id),
  appointment_id uuid references public.appointments(id),
  professional_id uuid not null references public.professionals(id),
  unit_id uuid not null references public.units(id),
  kind public.record_kind not null,
  template_id uuid references public.record_templates(id),
  template_version integer,
  payload jsonb not null,
  status public.record_status not null default 'draft',
  signed_at timestamptz,
  signed_by uuid references public.profiles(id),
  signature_hash text,
  rectifies_id uuid references public.clinical_records(id),
  rectification_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index clinical_records_patient_idx on public.clinical_records(patient_id, created_at desc) where deleted_at is null;

create table public.charges (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  patient_id uuid not null references public.patients(id),
  enrollment_id uuid references public.enrollments(id),
  unit_id uuid not null references public.units(id),
  description text not null,
  amount_cents integer not null check (amount_cents > 0),
  paid_cents integer not null default 0 check (paid_cents >= 0),
  due_at date not null,
  status public.charge_status not null default 'pending',
  installment_number integer,
  installment_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (paid_cents <= amount_cents)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  charge_id uuid not null references public.charges(id),
  amount_cents integer not null check (amount_cents > 0),
  method text not null check (method in ('pix','card','cash','transfer')),
  paid_at timestamptz not null,
  reversed_at timestamptz,
  reversed_by uuid references public.profiles(id),
  reversal_reason text,
  receipt_path text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (clinic_id, idempotency_key)
);

create table public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  unit_id uuid not null references public.units(id),
  charge_id uuid references public.charges(id),
  payment_id uuid references public.payments(id),
  kind public.financial_kind not null,
  description text not null,
  category text not null,
  cost_center text,
  amount_cents integer not null check (amount_cents > 0),
  competence_date date not null,
  settled_at timestamptz,
  recurrence_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index financial_unit_competence_idx on public.financial_entries(unit_id, competence_date) where deleted_at is null;

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  unit_id uuid not null references public.units(id),
  professional_id uuid not null references public.professionals(id),
  appointment_id uuid references public.appointments(id),
  payment_id uuid references public.payments(id),
  amount_cents integer not null check (amount_cents >= 0),
  basis text not null check (basis in ('appointment','payment')),
  status text not null default 'pending' check (status in ('pending','approved','paid','cancelled')),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.monthly_closings (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  unit_id uuid references public.units(id),
  reference_month date not null,
  version integer not null default 1,
  snapshot jsonb not null,
  status text not null check (status in ('draft','closed','reopened')),
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  reopening_reason text,
  created_at timestamptz not null default now(),
  unique nulls not distinct (clinic_id, unit_id, reference_month, version)
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  patient_id uuid references public.patients(id),
  entity_type text not null,
  entity_id uuid not null,
  bucket text not null,
  storage_path text not null,
  filename text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (bucket, storage_path)
);

create table public.fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  payment_id uuid not null references public.payments(id),
  provider text,
  status public.fiscal_status not null default 'pending',
  external_id text,
  payload jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  patient_id uuid references public.patients(id),
  channel text not null check (channel in ('whatsapp','email')),
  template_key text not null,
  payload jsonb not null,
  scheduled_at timestamptz not null,
  status public.delivery_status not null default 'pending',
  attempts integer not null default 0,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  source text not null,
  filename text not null,
  mapping jsonb not null default '{}'::jsonb,
  status text not null check (status in ('uploaded','validated','processing','completed','failed')),
  totals jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, idempotency_key)
);

create table public.idempotency_keys (
  clinic_id uuid not null references public.clinics(id),
  key text not null,
  operation text not null,
  response jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  primary key (clinic_id, key)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  clinic_id uuid not null references public.clinics(id),
  unit_id uuid references public.units(id),
  user_id uuid not null references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index audit_entity_idx on public.audit_events(entity_type, entity_id, occurred_at desc);

create or replace function public.current_profile()
returns public.profiles
language sql stable security definer set search_path = public
as $$ select * from public.profiles where id = auth.uid() and deleted_at is null limit 1 $$;

create or replace function public.bootstrap_clinic(p_name text, p_admin_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_clinic_id uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if exists(select 1 from public.clinics) then raise exception 'BOOTSTRAP_ALREADY_COMPLETED'; end if;
  if length(trim(p_name)) < 3 or length(trim(p_admin_name)) < 3 then raise exception 'INVALID_BOOTSTRAP_DATA'; end if;
  insert into public.clinics(name) values(trim(p_name)) returning id into new_clinic_id;
  insert into public.profiles(id, clinic_id, name, role, status, mfa_required)
    values(auth.uid(), new_clinic_id, trim(p_admin_name), 'admin', 'active', true);
  insert into public.audit_events(clinic_id, user_id, action, entity_type, entity_id)
    values(new_clinic_id, auth.uid(), 'clinic.bootstrapped', 'clinic', new_clinic_id);
  return new_clinic_id;
end $$;

create or replace function public.current_clinic_id()
returns uuid language sql stable security definer set search_path = public
as $$ select clinic_id from public.profiles where id = auth.uid() and status = 'active' and deleted_at is null $$;

create or replace function public.has_unit_access(target_unit uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'active' and p.deleted_at is null
      and (p.role = 'admin' or exists (
        select 1 from public.profile_units pu
        where pu.profile_id = p.id and pu.unit_id = target_unit
      ))
  )
$$;

create or replace function public.has_role(allowed public.user_role[])
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and status = 'active' and role = any(allowed)) $$;

create or replace function public.protect_signed_record()
returns trigger language plpgsql as $$
begin
  if old.status = 'signed' then
    raise exception 'SIGNED_RECORD_IMMUTABLE';
  end if;
  return new;
end $$;

create trigger clinical_records_immutable
before update or delete on public.clinical_records
for each row execute function public.protect_signed_record();

create or replace function public.prevent_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'AUDIT_APPEND_ONLY';
end $$;

create trigger audit_append_only
before update or delete on public.audit_events
for each row execute function public.prevent_audit_mutation();

create or replace function public.check_appointment_conflict(
  p_unit_id uuid,
  p_professional_id uuid,
  p_room_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_exclude_id uuid default null,
  p_group_slot_id uuid default null
) returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'conflict', exists(
      select 1 from public.appointments a
      where a.unit_id = p_unit_id
        and a.deleted_at is null
        and a.status not in ('cancelled','missed')
        and a.id is distinct from p_exclude_id
        and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
        and (
          (a.professional_id = p_professional_id and a.group_slot_id is distinct from p_group_slot_id)
          or (p_room_id is not null and a.room_id = p_room_id and a.group_slot_id is distinct from p_group_slot_id)
        )
    ),
    'capacity_reached', case when p_group_slot_id is null then false else coalesce((
      select count(a.id) >= gs.capacity
      from public.group_slots gs
      left join public.appointments a on a.group_slot_id = gs.id
        and a.deleted_at is null and a.status not in ('cancelled','missed')
        and a.id is distinct from p_exclude_id
        and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
      where gs.id = p_group_slot_id
      group by gs.capacity
    ), false) end
  )
$$;

create or replace function public.complete_appointment(p_appointment_id uuid, p_request_id uuid)
returns public.appointments language plpgsql security definer set search_path = public as $$
declare result public.appointments;
begin
  select * into result from public.appointments
    where id = p_appointment_id and clinic_id = public.current_clinic_id()
    for update;
  if result.id is null then raise exception 'APPOINTMENT_NOT_FOUND'; end if;
  if result.status = 'completed' then return result; end if;
  update public.appointments
    set status = 'completed', session_consumed_at = coalesce(session_consumed_at, now()), updated_at = now()
    where id = result.id returning * into result;
  if result.enrollment_id is not null then
    update public.enrollments
      set sessions_used = sessions_used + 1, updated_at = now()
      where id = result.enrollment_id and result.session_consumed_at is not null;
  end if;
  insert into public.audit_events(clinic_id, unit_id, user_id, action, entity_type, entity_id, request_id)
    values(result.clinic_id, result.unit_id, auth.uid(), 'appointment.completed', 'appointment', result.id, p_request_id);
  return result;
end $$;

create or replace function public.register_payment(
  p_charge_id uuid,
  p_amount_cents integer,
  p_method text,
  p_paid_at timestamptz,
  p_idempotency_key text,
  p_request_id uuid
) returns public.payments language plpgsql security definer set search_path = public as $$
declare target public.charges; result public.payments;
begin
  select * into result from public.payments
    where clinic_id = public.current_clinic_id() and idempotency_key = p_idempotency_key;
  if result.id is not null then return result; end if;
  select * into target from public.charges
    where id = p_charge_id and clinic_id = public.current_clinic_id() and deleted_at is null for update;
  if target.id is null then raise exception 'CHARGE_NOT_FOUND'; end if;
  if p_amount_cents <= 0 or target.paid_cents + p_amount_cents > target.amount_cents then
    raise exception 'INVALID_PAYMENT_AMOUNT';
  end if;
  insert into public.payments(clinic_id, charge_id, amount_cents, method, paid_at, idempotency_key)
    values(target.clinic_id, target.id, p_amount_cents, p_method, p_paid_at, p_idempotency_key)
    returning * into result;
  update public.charges set
    paid_cents = paid_cents + p_amount_cents,
    status = case when paid_cents + p_amount_cents = amount_cents then 'paid'::public.charge_status else 'partial'::public.charge_status end,
    updated_at = now()
    where id = target.id;
  insert into public.financial_entries(clinic_id, unit_id, charge_id, payment_id, kind, description, category, amount_cents, competence_date, settled_at)
    values(target.clinic_id, target.unit_id, target.id, result.id, 'income', target.description, 'Recebimentos', p_amount_cents, p_paid_at::date, p_paid_at);
  insert into public.audit_events(clinic_id, unit_id, user_id, action, entity_type, entity_id, request_id, metadata)
    values(target.clinic_id, target.unit_id, auth.uid(), 'payment.created', 'payment', result.id, p_request_id, jsonb_build_object('amount_cents', p_amount_cents));
  return result;
end $$;

create view public.monthly_financial_summary with (security_invoker = true) as
select clinic_id, unit_id, date_trunc('month', competence_date)::date as month,
  sum(case when kind = 'income' and settled_at is not null then amount_cents else 0 end) as realized_income_cents,
  sum(case when kind = 'expense' and settled_at is not null then amount_cents else 0 end) as realized_expense_cents,
  sum(case when kind = 'income' then amount_cents else 0 end) as expected_income_cents,
  sum(case when kind = 'expense' then amount_cents else 0 end) as expected_expense_cents
from public.financial_entries where deleted_at is null
group by clinic_id, unit_id, date_trunc('month', competence_date);

create view public.enrollment_usage with (security_invoker = true) as
select e.*, p.sessions_included,
  greatest(coalesce(p.sessions_included, 0) - e.sessions_used, 0) as sessions_remaining
from public.enrollments e join public.plans p on p.id = e.plan_id
where e.deleted_at is null;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'clinics','units','profiles','profile_units','rooms','professionals','professional_units',
    'patients','responsibles','consents','services','plans','group_slots','enrollments','group_slot_memberships','appointments',
    'record_templates','clinical_records','charges','payments','financial_entries','commissions',
    'monthly_closings','attachments','fiscal_documents','notifications','import_batches',
    'idempotency_keys','audit_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

create policy clinic_isolation on public.clinics for select using (id = public.current_clinic_id());
create policy profiles_self_or_admin on public.profiles for select using (
  clinic_id = public.current_clinic_id() and (id = auth.uid() or public.has_role(array['admin','manager']::public.user_role[]))
);
create policy units_member_select on public.units for select using (clinic_id = public.current_clinic_id());
create policy profile_units_member_select on public.profile_units for select using (
  exists(select 1 from public.profiles p where p.id = profile_id and p.clinic_id = public.current_clinic_id())
);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'rooms','professionals','patients','responsibles','consents','services','plans','group_slots','enrollments','group_slot_memberships',
    'appointments','record_templates','clinical_records','charges','payments','financial_entries',
    'commissions','monthly_closings','attachments','fiscal_documents','notifications','import_batches','audit_events'
  ] loop
    execute format(
      'create policy %I on public.%I for select using (clinic_id = public.current_clinic_id())',
      table_name || '_clinic_select', table_name
    );
  end loop;
end $$;

create policy appointments_unit_write on public.appointments for all
using (clinic_id = public.current_clinic_id() and public.has_unit_access(unit_id))
with check (clinic_id = public.current_clinic_id() and public.has_unit_access(unit_id));
create policy patients_unit_write on public.patients for all
using (clinic_id = public.current_clinic_id() and public.has_unit_access(primary_unit_id))
with check (clinic_id = public.current_clinic_id() and public.has_unit_access(primary_unit_id));
create policy clinical_professional_write on public.clinical_records for insert
with check (
  clinic_id = public.current_clinic_id() and public.has_unit_access(unit_id)
  and public.has_role(array['admin','manager','professional']::public.user_role[])
);
create policy finance_write on public.financial_entries for all
using (
  clinic_id = public.current_clinic_id() and public.has_unit_access(unit_id)
  and public.has_role(array['admin','manager','finance']::public.user_role[])
)
with check (
  clinic_id = public.current_clinic_id() and public.has_unit_access(unit_id)
  and public.has_role(array['admin','manager','finance']::public.user_role[])
);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values
  ('clinical-files','clinical-files',false,26214400,array['application/pdf','image/jpeg','image/png','image/webp']),
  ('financial-files','financial-files',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;
