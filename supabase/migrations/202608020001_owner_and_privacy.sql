alter table public.clinics
  add column owner_profile_id uuid;

alter table public.clinics
  add constraint clinics_owner_profile_fk
  foreign key (owner_profile_id) references public.profiles(id) on delete restrict;

update public.clinics c
   set owner_profile_id = 'd0422411-434d-43c8-af22-f8f163c9a3eb'
 where exists (
   select 1 from public.profiles p
    where p.id = 'd0422411-434d-43c8-af22-f8f163c9a3eb'
      and p.clinic_id = c.id
 );

alter table public.clinics
  alter column owner_profile_id set not null;

alter table public.consents
  add column purpose text,
  add column legal_basis text,
  add column notice_version text,
  add column source text not null default 'portal',
  add column recorded_by uuid references public.profiles(id),
  add column metadata jsonb not null default '{}'::jsonb;

update public.consents
   set purpose = kind,
       legal_basis = case when granted then 'consent' else 'revoked_consent' end,
       notice_version = 'legacy'
 where purpose is null;

alter table public.consents
  alter column purpose set not null,
  alter column legal_basis set not null,
  alter column notice_version set not null;

create table public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  patient_id uuid references public.patients(id),
  requester_name text not null,
  requester_email text,
  requester_phone text,
  kind text not null check (kind in ('confirmation','access','correction','sharing','opposition','portability','revocation','deletion')),
  status text not null default 'received' check (status in ('received','identity_check','in_review','fulfilled','partially_fulfilled','rejected','cancelled')),
  identity_verified_at timestamptz,
  due_at timestamptz not null,
  assigned_to uuid references public.profiles(id),
  decision_reason text,
  response_path text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_email is not null or requester_phone is not null)
);

create index data_subject_requests_clinic_status_idx
  on public.data_subject_requests(clinic_id, status, due_at);

create table public.privacy_incidents (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  title text not null,
  description text not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  status text not null default 'investigating' check (status in ('investigating','contained','notifiable','notified','closed')),
  discovered_at timestamptz not null,
  contained_at timestamptz,
  data_categories text[] not null default '{}',
  affected_count integer check (affected_count is null or affected_count >= 0),
  risk_assessment text,
  mitigation text,
  anpd_notified_at timestamptz,
  subjects_notified_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index privacy_incidents_clinic_created_idx
  on public.privacy_incidents(clinic_id, created_at desc);

create or replace function public.protect_clinic_owner()
returns trigger language plpgsql set search_path = public as $$
declare protected_owner uuid;
begin
  select owner_profile_id into protected_owner
    from public.clinics
   where id = case when tg_op = 'DELETE' then old.clinic_id else new.clinic_id end;

  if old.id = protected_owner then
    if tg_op = 'DELETE'
       or new.clinic_id is distinct from old.clinic_id
       or new.role is distinct from 'admin'::public.user_role
       or new.status is distinct from 'active'::public.member_status
       or new.mfa_required is distinct from true
       or new.deleted_at is not null then
      raise exception 'PROTECTED_OWNER_ACCOUNT' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger profiles_protect_clinic_owner
before update or delete on public.profiles
for each row execute function public.protect_clinic_owner();

create or replace function public.protect_owner_unit_membership()
returns trigger language plpgsql set search_path = public as $$
begin
  if exists (
    select 1 from public.clinics c
     where c.owner_profile_id = old.profile_id
  ) then
    raise exception 'PROTECTED_OWNER_ACCOUNT' using errcode = '42501';
  end if;
  return old;
end $$;

create trigger profile_units_protect_owner
before delete on public.profile_units
for each row execute function public.protect_owner_unit_membership();

alter table public.data_subject_requests enable row level security;
alter table public.privacy_incidents enable row level security;

create policy data_subject_requests_clinic_access on public.data_subject_requests
for all using (
  clinic_id = public.current_clinic_id()
  and public.has_role(array['admin','manager']::public.user_role[])
) with check (
  clinic_id = public.current_clinic_id()
  and public.has_role(array['admin','manager']::public.user_role[])
);

create policy privacy_incidents_clinic_access on public.privacy_incidents
for all using (
  clinic_id = public.current_clinic_id()
  and public.has_role(array['admin']::public.user_role[])
) with check (
  clinic_id = public.current_clinic_id()
  and public.has_role(array['admin']::public.user_role[])
);
