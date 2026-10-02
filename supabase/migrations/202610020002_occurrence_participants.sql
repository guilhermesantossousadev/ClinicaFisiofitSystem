-- AGENDA-015: occurrence-level roster entries are durable and do not mutate memberships.
create table public.occurrence_participants (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  class_occurrence_id uuid not null references public.class_occurrences(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  source_type text not null check (source_type in ('membership', 'makeup_reservation', 'ad_hoc_admission')),
  source_id uuid,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id),
  cancellation_reason text,
  unique (class_occurrence_id, patient_id),
  check ((status = 'cancelled') = (cancelled_at is not null))
);

create index occurrence_participants_patient_status_idx
  on public.occurrence_participants(clinic_id, patient_id, status);
create index occurrence_participants_occurrence_status_idx
  on public.occurrence_participants(class_occurrence_id, status);

alter table public.occurrence_participants enable row level security;
create policy occurrence_participants_select on public.occurrence_participants for select
using (clinic_id = public.current_clinic_id() and public.has_module_permission('agenda', false) and exists (
  select 1 from public.class_occurrences o where o.id = class_occurrence_id and public.can_access_class(o.class_id)
));
create policy occurrence_participants_write on public.occurrence_participants for all
using (clinic_id = public.current_clinic_id() and public.has_module_permission('agenda', true) and public.has_role(array['admin','manager','reception']::public.user_role[]) and exists (
  select 1 from public.class_occurrences o where o.id = class_occurrence_id and public.can_access_class(o.class_id)
))
with check (clinic_id = public.current_clinic_id() and created_by = auth.uid() and public.has_module_permission('agenda', true) and public.has_role(array['admin','manager','reception']::public.user_role[]) and exists (
  select 1 from public.class_occurrences o where o.id = class_occurrence_id and public.can_access_class(o.class_id)
));

create or replace function public._effective_occurrence_patient_ids(p_occurrence_id uuid)
returns table(patient_id uuid)
language sql stable security definer set search_path = '' as $$
  with target as (
    select o.id, o.clinic_id, o.class_id, o.class_schedule_id, o.local_date,
      case extract(isodow from o.local_date)::integer
        when 1 then 'monday'::public.class_weekday when 2 then 'tuesday'::public.class_weekday
        when 3 then 'wednesday'::public.class_weekday when 4 then 'thursday'::public.class_weekday
        when 5 then 'friday'::public.class_weekday when 6 then 'saturday'::public.class_weekday
        else 'sunday'::public.class_weekday end as weekday
    from public.class_occurrences o
    where o.id = p_occurrence_id and o.clinic_id = public.current_clinic_id()
  ), base as (
    select m.patient_id from target t
    join public.class_memberships m on m.class_id = t.class_id and m.clinic_id = t.clinic_id
      and m.effective_from <= t.local_date and (m.effective_to is null or t.local_date < m.effective_to)
    join public.class_schedules s on s.id = t.class_schedule_id and s.clinic_id = t.clinic_id
    join public.patients p on p.id = m.patient_id and p.clinic_id = t.clinic_id and p.deleted_at is null
    where t.weekday = any(coalesce(m.weekdays, s.weekdays))
      and not exists (select 1 from public.occurrence_participants x where x.class_occurrence_id = t.id and x.patient_id = m.patient_id and x.status = 'cancelled')
  ), explicit as (
    select x.patient_id from public.occurrence_participants x join target t on t.id = x.class_occurrence_id
    join public.patients p on p.id = x.patient_id and p.clinic_id = t.clinic_id and p.deleted_at is null
    where x.status = 'active'
  )
  select distinct roster.patient_id from (select * from base union all select * from explicit) roster
$$;

create or replace function public.effective_occurrence_patient_ids(p_occurrence_id uuid)
returns table(patient_id uuid)
language plpgsql stable security definer set search_path = '' as $$
declare target public.class_occurrences;
begin
  select * into target from public.class_occurrences where id = p_occurrence_id and clinic_id = public.current_clinic_id();
  if not found or not public.can_access_class(target.class_id) or not public.has_module_permission('agenda', false) then raise exception 'CLASS_OCCURRENCE_NOT_FOUND'; end if;
  return query select roster.patient_id from public._effective_occurrence_patient_ids(p_occurrence_id) roster;
end $$;

create or replace function public.add_occurrence_participant(p_occurrence_id uuid, p_patient_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.class_occurrences; target_clinic uuid; membership_id uuid; present boolean; current_count integer; participant public.occurrence_participants;
begin
  select * into target from public.class_occurrences where id = p_occurrence_id and clinic_id = public.current_clinic_id() for update;
  if not found or not public.can_access_class(target.class_id) then raise exception 'CLASS_OCCURRENCE_NOT_FOUND'; end if;
  if not public.has_role(array['admin','manager','reception']::public.user_role[]) or not public.has_unit_access(target.unit_id) or not public.has_module_permission('agenda', true) then raise exception 'FORBIDDEN'; end if;
  if target.status = 'cancelled' then raise exception 'OCCURRENCE_CANCELLED'; end if;
  if target.status <> 'planned' then raise exception 'INVALID_OCCURRENCE_STATE_TRANSITION'; end if;
  if not exists (select 1 from public.patients p where p.id = p_patient_id and p.clinic_id = target.clinic_id and p.deleted_at is null) then raise exception 'PATIENT_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_patient_id::text, 0));

  select m.id into membership_id from public.class_memberships m join public.class_schedules s on s.id = target.class_schedule_id
  where m.class_id = target.class_id and m.clinic_id = target.clinic_id and m.patient_id = p_patient_id
    and m.effective_from <= target.local_date and (m.effective_to is null or target.local_date < m.effective_to)
    and (case extract(isodow from target.local_date)::integer when 1 then 'monday'::public.class_weekday when 2 then 'tuesday'::public.class_weekday when 3 then 'wednesday'::public.class_weekday when 4 then 'thursday'::public.class_weekday when 5 then 'friday'::public.class_weekday when 6 then 'saturday'::public.class_weekday else 'sunday'::public.class_weekday end) = any(coalesce(m.weekdays, s.weekdays))
  limit 1;
  select exists(select 1 from public._effective_occurrence_patient_ids(target.id) r where r.patient_id = p_patient_id) into present;
  if present then return jsonb_build_object('status', 'already_present'); end if;

  if exists (
    select 1 from public.appointments a where a.clinic_id = target.clinic_id and a.patient_id = p_patient_id
      and a.deleted_at is null and a.status not in ('cancelled','completed','missed')
      and a.starts_at < target.end_at and target.start_at < a.ends_at
  ) or exists (
    select 1 from public.class_occurrences o where o.clinic_id = target.clinic_id and o.id <> target.id
      and o.status in ('planned','in_progress') and o.start_at < target.end_at and target.start_at < o.end_at
      and exists (select 1 from public._effective_occurrence_patient_ids(o.id) r where r.patient_id = p_patient_id)
  ) then raise exception 'PATIENT_SCHEDULE_CONFLICT'; end if;

  select count(*) into current_count from public._effective_occurrence_patient_ids(target.id);
  if current_count >= target.effective_capacity then raise exception 'CLASS_CAPACITY_REACHED'; end if;

  insert into public.occurrence_participants (clinic_id, class_occurrence_id, patient_id, source_type, source_id, status, created_by, updated_by, cancelled_at, cancelled_by, cancellation_reason)
  values (target.clinic_id, target.id, p_patient_id, case when membership_id is not null then 'membership' else 'ad_hoc_admission' end, membership_id, 'active', auth.uid(), auth.uid(), null, null, null)
  on conflict (class_occurrence_id, patient_id) do update set
    source_type = excluded.source_type, source_id = excluded.source_id, status = 'active', updated_at = now(), updated_by = auth.uid(), cancelled_at = null, cancelled_by = null, cancellation_reason = null
  returning * into participant;
  return jsonb_build_object('status', 'added', 'participantId', participant.id, 'sourceType', participant.source_type);
end $$;

create or replace function public.remove_occurrence_participant(p_occurrence_id uuid, p_patient_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.class_occurrences; membership_id uuid; existing public.occurrence_participants; present boolean; next_source text;
begin
  select * into target from public.class_occurrences where id = p_occurrence_id and clinic_id = public.current_clinic_id() for update;
  if not found or not public.can_access_class(target.class_id) then raise exception 'CLASS_OCCURRENCE_NOT_FOUND'; end if;
  if not public.has_role(array['admin','manager','reception']::public.user_role[]) or not public.has_unit_access(target.unit_id) or not public.has_module_permission('agenda', true) then raise exception 'FORBIDDEN'; end if;
  if target.status = 'cancelled' then raise exception 'OCCURRENCE_CANCELLED'; end if;
  if target.status <> 'planned' then raise exception 'INVALID_OCCURRENCE_STATE_TRANSITION'; end if;
  select exists(select 1 from public._effective_occurrence_patient_ids(target.id) r where r.patient_id = p_patient_id) into present;
  if not present then return jsonb_build_object('status', 'already_absent'); end if;

  select m.id into membership_id from public.class_memberships m join public.class_schedules s on s.id = target.class_schedule_id
  where m.class_id = target.class_id and m.clinic_id = target.clinic_id and m.patient_id = p_patient_id
    and m.effective_from <= target.local_date and (m.effective_to is null or target.local_date < m.effective_to)
    and (case extract(isodow from target.local_date)::integer when 1 then 'monday'::public.class_weekday when 2 then 'tuesday'::public.class_weekday when 3 then 'wednesday'::public.class_weekday when 4 then 'thursday'::public.class_weekday when 5 then 'friday'::public.class_weekday when 6 then 'saturday'::public.class_weekday else 'sunday'::public.class_weekday end) = any(coalesce(m.weekdays, s.weekdays))
  limit 1;
  select * into existing from public.occurrence_participants where class_occurrence_id = target.id and patient_id = p_patient_id;
  next_source := case when membership_id is not null then 'membership' else coalesce(existing.source_type, 'ad_hoc_admission') end;
  insert into public.occurrence_participants (clinic_id, class_occurrence_id, patient_id, source_type, source_id, status, created_by, updated_by, cancelled_at, cancelled_by, cancellation_reason)
  values (target.clinic_id, target.id, p_patient_id, next_source, case when membership_id is not null then membership_id else existing.source_id end, 'cancelled', auth.uid(), auth.uid(), now(), auth.uid(), 'Removed only from this occurrence')
  on conflict (class_occurrence_id, patient_id) do update set
    source_type = excluded.source_type, source_id = excluded.source_id, status = 'cancelled', updated_at = now(), updated_by = auth.uid(), cancelled_at = now(), cancelled_by = auth.uid(), cancellation_reason = excluded.cancellation_reason;
  return jsonb_build_object('status', 'removed', 'sourceType', next_source);
end $$;

revoke all on function public._effective_occurrence_patient_ids(uuid), public.effective_occurrence_patient_ids(uuid), public.add_occurrence_participant(uuid,uuid), public.remove_occurrence_participant(uuid,uuid) from public, anon;
grant execute on function public.effective_occurrence_patient_ids(uuid), public.add_occurrence_participant(uuid,uuid), public.remove_occurrence_participant(uuid,uuid) to authenticated;
