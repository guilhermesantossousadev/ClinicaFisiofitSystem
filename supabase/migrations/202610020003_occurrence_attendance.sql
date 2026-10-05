-- AGENDA-017: attendance belongs to the concrete occurrence participant.
-- Membership participants are materialized only when an attendance is recorded.
create table public.attendances (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  occurrence_participant_id uuid not null unique references public.occurrence_participants(id) on delete restrict,
  status text not null check (status in (
    'PENDING', 'PRESENT', 'LATE', 'ABSENT_JUSTIFIED', 'ABSENT_UNJUSTIFIED',
    'CANCELLED_IN_ADVANCE', 'CANCELLED_LATE'
  )),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0)
);
create index attendances_clinic_status_idx on public.attendances(clinic_id, status);

create table public.attendance_revisions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  attendance_id uuid not null references public.attendances(id) on delete restrict,
  before_status text not null check (before_status in (
    'PENDING', 'PRESENT', 'LATE', 'ABSENT_JUSTIFIED', 'ABSENT_UNJUSTIFIED',
    'CANCELLED_IN_ADVANCE', 'CANCELLED_LATE'
  )),
  after_status text not null check (after_status in (
    'PENDING', 'PRESENT', 'LATE', 'ABSENT_JUSTIFIED', 'ABSENT_UNJUSTIFIED',
    'CANCELLED_IN_ADVANCE', 'CANCELLED_LATE'
  )),
  reason text not null check (length(trim(reason)) between 3 and 500),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (before_status <> after_status)
);
create index attendance_revisions_attendance_created_idx
  on public.attendance_revisions(attendance_id, created_at desc);

alter table public.attendances enable row level security;
alter table public.attendance_revisions enable row level security;

create policy attendances_select on public.attendances for select
using (clinic_id = public.current_clinic_id()
  and public.has_module_permission('agenda', false)
  and exists (
    select 1 from public.occurrence_participants p
    join public.class_occurrences o on o.id = p.class_occurrence_id
    where p.id = occurrence_participant_id and public.can_access_class(o.class_id)
  ));
create policy attendance_revisions_select on public.attendance_revisions for select
using (clinic_id = public.current_clinic_id()
  and public.has_module_permission('agenda', false)
  and exists (
    select 1 from public.attendances a
    join public.occurrence_participants p on p.id = a.occurrence_participant_id
    join public.class_occurrences o on o.id = p.class_occurrence_id
    where a.id = attendance_id and public.can_access_class(o.class_id)
  ));
-- Mutations are exclusively performed by the transactional RPC below.
revoke insert, update, delete on public.attendances, public.attendance_revisions from anon, authenticated;
grant select on public.attendances, public.attendance_revisions to authenticated;

create or replace function public.get_class_occurrence_attendance(p_occurrence_id uuid)
returns table(patient_id uuid, patient_name text, patient_active boolean, source_type text,
  attendance_id uuid, attendance_status text, recorded_at timestamptz, correction_count bigint)
language plpgsql stable security definer set search_path = '' as $$
declare target public.class_occurrences;
begin
  select * into target from public.class_occurrences
  where id = p_occurrence_id and clinic_id = public.current_clinic_id();
  if not found or not public.has_unit_access(target.unit_id)
    or not (public.can_access_class(target.class_id)
      or (public.current_role() = 'professional' and coalesce(target.actual_professional_id, target.planned_professional_id) = public.current_professional_id()))
    or not public.has_module_permission('agenda', false) then
    raise exception 'CLASS_OCCURRENCE_NOT_FOUND';
  end if;
  if public.current_role() = 'professional' and coalesce(target.actual_professional_id, target.planned_professional_id)
    is distinct from public.current_professional_id() then raise exception 'FORBIDDEN'; end if;
  return query
    with roster as (
      select r.patient_id from public._effective_occurrence_patient_ids(target.id) r
    ), weekday_roster as (
      select m.patient_id, m.id as membership_id from public.class_memberships m
      join public.class_schedules s on s.id = target.class_schedule_id
      where m.class_id = target.class_id and m.clinic_id = target.clinic_id
        and m.effective_from <= target.local_date and (m.effective_to is null or target.local_date < m.effective_to)
        and (case extract(isodow from target.local_date)::integer
          when 1 then 'monday'::public.class_weekday when 2 then 'tuesday'::public.class_weekday
          when 3 then 'wednesday'::public.class_weekday when 4 then 'thursday'::public.class_weekday
          when 5 then 'friday'::public.class_weekday when 6 then 'saturday'::public.class_weekday
          else 'sunday'::public.class_weekday end) = any(coalesce(m.weekdays, s.weekdays))
    )
    select r.patient_id, p.name, p.active,
      coalesce(op.source_type, case when wr.membership_id is not null then 'membership' else 'ad_hoc_admission' end),
      a.id, a.status, a.recorded_at,
      (select count(*) from public.attendance_revisions c where c.attendance_id = a.id)
    from roster r join public.patients p on p.id = r.patient_id
    left join public.occurrence_participants op on op.class_occurrence_id = target.id and op.patient_id = r.patient_id and op.status = 'active'
    left join weekday_roster wr on wr.patient_id = r.patient_id
    left join public.attendances a on a.occurrence_participant_id = op.id
    order by p.name;
end $$;

create or replace function public.record_class_occurrence_attendance(
  p_occurrence_id uuid, p_patient_id uuid, p_status text, p_reason text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.class_occurrences; participant public.occurrence_participants;
  current_attendance public.attendances; member_id uuid; before_value text;
  is_manager boolean; allowed boolean;
begin
  if p_status is null or p_status not in ('PRESENT','LATE','ABSENT_JUSTIFIED','ABSENT_UNJUSTIFIED','CANCELLED_IN_ADVANCE','CANCELLED_LATE') then
    raise exception 'INVALID_ATTENDANCE_STATUS';
  end if;
  select * into target from public.class_occurrences
  where id = p_occurrence_id and clinic_id = public.current_clinic_id() for update;
  if not found or not (public.can_access_class(target.class_id)
    or (public.current_role() = 'professional' and public.has_unit_access(target.unit_id)
      and coalesce(target.actual_professional_id, target.planned_professional_id) = public.current_professional_id())) then
    raise exception 'CLASS_OCCURRENCE_NOT_FOUND';
  end if;
  if not public.has_unit_access(target.unit_id) or not public.has_module_permission('agenda', true) then raise exception 'FORBIDDEN'; end if;
  if target.status = 'cancelled' then raise exception 'OCCURRENCE_CANCELLED'; end if;
  if target.status not in ('planned','in_progress') then raise exception 'INVALID_OCCURRENCE_STATE_TRANSITION'; end if;
  is_manager := public.current_role() in ('admin','manager');
  allowed := is_manager or public.current_role() = 'reception'
    or (public.current_role() = 'professional'
      and coalesce(target.actual_professional_id, target.planned_professional_id) = public.current_professional_id());
  if not allowed then raise exception 'FORBIDDEN'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_occurrence_id::text || ':' || p_patient_id::text, 0));
  if not exists (select 1 from public._effective_occurrence_patient_ids(target.id) r where r.patient_id = p_patient_id) then
    raise exception 'PATIENT_NOT_IN_OCCURRENCE_ROSTER';
  end if;
  select * into participant from public.occurrence_participants
    where class_occurrence_id = target.id and patient_id = p_patient_id and status = 'active' for update;
  if not found then
    select m.id into member_id from public.class_memberships m
    join public.class_schedules s on s.id = target.class_schedule_id
    where m.class_id = target.class_id and m.clinic_id = target.clinic_id and m.patient_id = p_patient_id
      and m.effective_from <= target.local_date and (m.effective_to is null or target.local_date < m.effective_to)
      and (case extract(isodow from target.local_date)::integer
        when 1 then 'monday'::public.class_weekday when 2 then 'tuesday'::public.class_weekday
        when 3 then 'wednesday'::public.class_weekday when 4 then 'thursday'::public.class_weekday
        when 5 then 'friday'::public.class_weekday when 6 then 'saturday'::public.class_weekday
        else 'sunday'::public.class_weekday end) = any(coalesce(m.weekdays, s.weekdays)) limit 1;
    if member_id is null then raise exception 'OCCURRENCE_PARTICIPANT_NOT_FOUND'; end if;
    insert into public.occurrence_participants(clinic_id,class_occurrence_id,patient_id,source_type,source_id,status,created_by,updated_by)
      values(target.clinic_id,target.id,p_patient_id,'membership',member_id,'active',auth.uid(),auth.uid())
      on conflict(class_occurrence_id,patient_id) do update set status='active',source_type='membership',source_id=excluded.source_id,
        cancelled_at=null,cancelled_by=null,cancellation_reason=null,updated_at=now(),updated_by=auth.uid()
      returning * into participant;
  end if;
  select * into current_attendance from public.attendances where occurrence_participant_id = participant.id for update;
  if found then
    if current_attendance.status = p_status then return jsonb_build_object('status','unchanged','attendanceId',current_attendance.id,'attendanceStatus',current_attendance.status); end if;
    if not is_manager then raise exception 'ATTENDANCE_CORRECTION_FORBIDDEN'; end if;
    if p_reason is null or length(trim(p_reason)) < 3 or length(trim(p_reason)) > 500 then raise exception 'ATTENDANCE_CORRECTION_REASON_REQUIRED'; end if;
    before_value := current_attendance.status;
    insert into public.attendance_revisions(clinic_id,attendance_id,before_status,after_status,reason,actor_id)
      values(target.clinic_id,current_attendance.id,before_value,p_status,trim(p_reason),auth.uid());
    update public.attendances set status=p_status,updated_at=now(),updated_by=auth.uid(),version=version+1
      where id=current_attendance.id returning * into current_attendance;
    return jsonb_build_object('status','corrected','attendanceId',current_attendance.id,'attendanceStatus',current_attendance.status);
  end if;
  insert into public.attendances(clinic_id,occurrence_participant_id,status,recorded_by,updated_by)
    values(target.clinic_id,participant.id,p_status,auth.uid(),auth.uid()) returning * into current_attendance;
  return jsonb_build_object('status','recorded','attendanceId',current_attendance.id,'attendanceStatus',current_attendance.status);
end $$;

revoke all on function public.get_class_occurrence_attendance(uuid), public.record_class_occurrence_attendance(uuid,uuid,text,text) from public, anon;
grant execute on function public.get_class_occurrence_attendance(uuid), public.record_class_occurrence_attendance(uuid,uuid,text,text) to authenticated;
