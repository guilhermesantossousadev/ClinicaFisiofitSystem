-- Integrated stabilization. Apply only after 202610140007.
-- No backfill or rewrite of existing clinical/financial rows.
-- Data reconciliation is a separate, specifically authorized release operation.

-- SECTION operational_security
-- Integrated stabilization: metadata/RPC/policies only. No historical backfill.
-- ESTAB-009: Agenda grants at every access surface. No business data changes.

-- Agenda mutations also need visibility of their target; edit never implies read.
create or replace function public.has_agenda_permission(edit_access boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_module_permission('agenda', false)
    and (not edit_access or public.has_module_permission('agenda', true))
$$;
revoke all on function public.has_agenda_permission(boolean) from public, anon;
grant execute on function public.has_agenda_permission(boolean) to authenticated;

create or replace function public.can_access_class(target_class uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.classes c
    where c.id = target_class
      and c.clinic_id = public.current_clinic_id()
      and public.has_unit_access(c.unit_id)
      and public.has_agenda_permission(false)
      and (
        public.has_role(array['admin','manager','reception']::public.user_role[])
        or (public.current_role() = 'professional' and exists (
          select 1
          from public.class_schedules s
          where s.class_id = c.id
            and s.planned_professional_id = public.current_professional_id()
        ))
      )
  )
$$;

drop policy if exists classes_agenda_select on public.classes;
create policy classes_agenda_select on public.classes as restrictive for select to authenticated
using (clinic_id = public.current_clinic_id() and public.has_unit_access(unit_id) and public.has_agenda_permission(false));

drop policy if exists classes_agenda_insert on public.classes;
create policy classes_agenda_insert on public.classes as restrictive for insert to authenticated
with check (clinic_id = public.current_clinic_id() and public.has_unit_access(unit_id) and public.has_agenda_permission(true));

drop policy if exists classes_agenda_update on public.classes;
create policy classes_agenda_update on public.classes as restrictive for update to authenticated
using (clinic_id = public.current_clinic_id() and public.has_unit_access(unit_id) and public.has_agenda_permission(true))
with check (clinic_id = public.current_clinic_id() and public.has_unit_access(unit_id) and public.has_agenda_permission(true));

drop policy if exists classes_agenda_delete on public.classes;
create policy classes_agenda_delete on public.classes as restrictive for delete to authenticated
using (clinic_id = public.current_clinic_id() and public.has_unit_access(unit_id) and public.has_agenda_permission(true));

drop policy if exists class_schedules_agenda_select on public.class_schedules;
create policy class_schedules_agenda_select on public.class_schedules as restrictive for select to authenticated
using (clinic_id = public.current_clinic_id() and public.has_agenda_permission(false));

drop policy if exists class_schedules_agenda_insert on public.class_schedules;
create policy class_schedules_agenda_insert on public.class_schedules as restrictive for insert to authenticated
with check (clinic_id = public.current_clinic_id() and public.has_agenda_permission(true));

drop policy if exists class_schedules_agenda_update on public.class_schedules;
create policy class_schedules_agenda_update on public.class_schedules as restrictive for update to authenticated
using (clinic_id = public.current_clinic_id() and public.has_agenda_permission(true))
with check (clinic_id = public.current_clinic_id() and public.has_agenda_permission(true));

drop policy if exists class_schedules_agenda_delete on public.class_schedules;
create policy class_schedules_agenda_delete on public.class_schedules as restrictive for delete to authenticated
using (clinic_id = public.current_clinic_id() and public.has_agenda_permission(true));

drop policy if exists class_memberships_agenda_select on public.class_memberships;
create policy class_memberships_agenda_select on public.class_memberships as restrictive for select to authenticated
using (clinic_id = public.current_clinic_id() and public.has_agenda_permission(false));

drop policy if exists class_memberships_agenda_insert on public.class_memberships;
create policy class_memberships_agenda_insert on public.class_memberships as restrictive for insert to authenticated
with check (clinic_id = public.current_clinic_id() and public.has_agenda_permission(true));

drop policy if exists class_memberships_agenda_update on public.class_memberships;
create policy class_memberships_agenda_update on public.class_memberships as restrictive for update to authenticated
using (clinic_id = public.current_clinic_id() and public.has_agenda_permission(true))
with check (clinic_id = public.current_clinic_id() and public.has_agenda_permission(true));

drop policy if exists class_memberships_agenda_delete on public.class_memberships;
create policy class_memberships_agenda_delete on public.class_memberships as restrictive for delete to authenticated
using (clinic_id = public.current_clinic_id() and public.has_agenda_permission(true));

drop policy if exists class_occurrences_agenda_select on public.class_occurrences;
create policy class_occurrences_agenda_select on public.class_occurrences as restrictive for select to authenticated
using (clinic_id = public.current_clinic_id() and public.has_unit_access(unit_id) and public.has_agenda_permission(false));

drop policy if exists class_occurrences_agenda_insert on public.class_occurrences;
create policy class_occurrences_agenda_insert on public.class_occurrences as restrictive for insert to authenticated
with check (clinic_id = public.current_clinic_id() and public.has_unit_access(unit_id) and public.has_agenda_permission(true));

drop policy if exists class_occurrences_agenda_update on public.class_occurrences;
create policy class_occurrences_agenda_update on public.class_occurrences as restrictive for update to authenticated
using (clinic_id = public.current_clinic_id() and public.has_unit_access(unit_id) and public.has_agenda_permission(true))
with check (clinic_id = public.current_clinic_id() and public.has_unit_access(unit_id) and public.has_agenda_permission(true));

drop policy if exists class_occurrences_agenda_delete on public.class_occurrences;
create policy class_occurrences_agenda_delete on public.class_occurrences as restrictive for delete to authenticated
using (clinic_id = public.current_clinic_id() and public.has_unit_access(unit_id) and public.has_agenda_permission(true));

drop policy if exists occurrence_participants_agenda_select on public.occurrence_participants;
create policy occurrence_participants_agenda_select on public.occurrence_participants as restrictive for select to authenticated
using (clinic_id = public.current_clinic_id() and public.has_agenda_permission(false));

drop policy if exists occurrence_participants_agenda_insert on public.occurrence_participants;
create policy occurrence_participants_agenda_insert on public.occurrence_participants as restrictive for insert to authenticated
with check (clinic_id = public.current_clinic_id() and public.has_agenda_permission(true));

drop policy if exists occurrence_participants_agenda_update on public.occurrence_participants;
create policy occurrence_participants_agenda_update on public.occurrence_participants as restrictive for update to authenticated
using (clinic_id = public.current_clinic_id() and public.has_agenda_permission(true))
with check (clinic_id = public.current_clinic_id() and public.has_agenda_permission(true));

drop policy if exists occurrence_participants_agenda_delete on public.occurrence_participants;
create policy occurrence_participants_agenda_delete on public.occurrence_participants as restrictive for delete to authenticated
using (clinic_id = public.current_clinic_id() and public.has_agenda_permission(true));


-- A class may be visible as a container, but occurrence access is always contextual.
create or replace function public.can_access_class(target_class uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.classes c where c.id=target_class
  and c.clinic_id=public.current_clinic_id() and public.has_agenda_permission(false)
  and ((public.has_unit_access(c.unit_id) and public.has_role(array['admin','manager','reception']::public.user_role[]))
   or (public.current_role()='professional' and (
    exists(select 1 from public.class_schedules s where s.class_id=c.id and s.planned_professional_id=public.current_professional_id()
      and s.effective_from<=(now() at time zone s.timezone)::date and (s.effective_to is null or s.effective_to>(now() at time zone s.timezone)::date) and public.has_unit_access(c.unit_id))
    or exists(select 1 from public.class_occurrences o where o.class_id=c.id and coalesce(o.actual_professional_id,o.planned_professional_id)=public.current_professional_id()
      and (o.start_at at time zone o.timezone)::date=(now() at time zone o.timezone)::date and o.status<>'cancelled')
   )))
 )
$$;
create function public.can_access_occurrence(target_occurrence uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.class_occurrences o where o.id=target_occurrence
  and o.clinic_id=public.current_clinic_id() and public.has_agenda_permission(false)
  and ((public.has_role(array['admin','manager','reception']::public.user_role[]) and public.has_unit_access(o.unit_id))
   or (public.current_role()='professional' and coalesce(o.actual_professional_id,o.planned_professional_id)=public.current_professional_id()
    and (public.has_unit_access(o.unit_id) or (o.start_at at time zone o.timezone)::date=(now() at time zone o.timezone)::date))))
$$;
revoke all on function public.can_access_occurrence(uuid) from public,anon;
grant execute on function public.can_access_occurrence(uuid) to authenticated;
-- Remove policies whose OR semantics previously exposed all the class occurrences.
drop policy class_occurrences_select on public.class_occurrences;
create policy class_occurrences_select on public.class_occurrences for select to authenticated using(public.can_access_occurrence(id));
drop policy class_occurrences_agenda_select on public.class_occurrences;
create policy class_occurrences_agenda_select on public.class_occurrences as restrictive for select to authenticated using(public.can_access_occurrence(id));
-- ALL policies also participate in SELECT; split writes from reads and preserve original authors.
do $block$
declare t text;
begin
 foreach t in array array['classes','class_schedules','class_memberships','class_occurrences'] loop
  execute format('drop policy if exists %I on public.%I',t||'_write',t);
  execute format('create policy %I on public.%I for insert to authenticated with check(clinic_id=public.current_clinic_id() and public.has_role(array[''admin'',''manager'',''reception'']::public.user_role[]) and public.has_agenda_permission(true))',t||'_insert',t);
  execute format('create policy %I on public.%I for update to authenticated using(clinic_id=public.current_clinic_id() and public.has_role(array[''admin'',''manager'',''reception'']::public.user_role[]) and public.has_agenda_permission(true)) with check(clinic_id=public.current_clinic_id() and public.has_agenda_permission(true))',t||'_update',t);
 end loop;
end $block$;
-- Contextual access for a substitute never grants the whole recurring class roster.
drop policy class_memberships_select on public.class_memberships;
create policy class_memberships_select on public.class_memberships for select to authenticated using(
 clinic_id=public.current_clinic_id() and public.has_agenda_permission(false) and exists(
 select 1 from public.classes c where c.id=class_id and
 ((public.has_role(array['admin','manager','reception']::public.user_role[]) and public.has_unit_access(c.unit_id))
 or (public.current_role()='professional' and public.has_unit_access(c.unit_id) and exists(
 select 1 from public.class_schedules s where s.class_id=c.id and s.planned_professional_id=public.current_professional_id()
 and daterange(s.effective_from,s.effective_to,'[)') && daterange(class_memberships.effective_from,class_memberships.effective_to,'[)')))))
);
drop policy occurrence_participants_select on public.occurrence_participants;
create policy occurrence_participants_select on public.occurrence_participants for select to authenticated using(
 clinic_id=public.current_clinic_id() and public.can_access_occurrence(class_occurrence_id));
-- No direct mutation bypasses the roster/credit/attendance transactions.
revoke insert,update,delete on public.occurrence_participants from authenticated;
revoke delete on public.classes,public.class_schedules,public.class_memberships,public.class_occurrences from authenticated;

create or replace function public.can_access_patient(target_patient uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.patients p where p.id=target_patient and p.clinic_id=public.current_clinic_id() and p.deleted_at is null
 and public.has_module_permission('patients',false) and (
 (public.has_role(array['admin','manager','reception']::public.user_role[]) and (
   public.has_unit_access(p.primary_unit_id) or exists(select 1 from public.class_memberships m join public.classes c on c.id=m.class_id
    where m.patient_id=p.id and c.clinic_id=p.clinic_id and public.has_unit_access(c.unit_id))))
 or (public.current_role()='professional' and (
  exists(select 1 from public.appointments a where a.patient_id=p.id and a.clinic_id=p.clinic_id and a.deleted_at is null and a.professional_id=public.current_professional_id() and public.has_unit_access(a.unit_id))
  or exists(select 1 from public.class_memberships m join public.class_schedules s on s.class_id=m.class_id join public.classes c on c.id=m.class_id
    where m.patient_id=p.id and m.clinic_id=p.clinic_id and public.has_unit_access(c.unit_id)
    and s.planned_professional_id=public.current_professional_id()
    and current_date>=m.effective_from and (m.effective_to is null or current_date<m.effective_to)
    and current_date>=s.effective_from and (s.effective_to is null or current_date<s.effective_to))
  or exists(select 1 from public.class_occurrences o where o.clinic_id=p.clinic_id
   and coalesce(o.actual_professional_id,o.planned_professional_id)=public.current_professional_id()
   and (o.start_at at time zone o.timezone)::date=(now() at time zone o.timezone)::date and o.status<>'cancelled'
   and exists(select 1 from public._effective_occurrence_patient_ids(o.id) r where r.patient_id=p.id))
  ))))
$$;
-- An ALL policy must not turn clinical write scope into broader read access.
create policy patients_module_select on public.patients as restrictive for select to authenticated using(public.can_access_patient(id));
create policy patients_module_insert on public.patients as restrictive for insert to authenticated with check(public.has_module_permission('patients',true));
create policy patients_module_update on public.patients as restrictive for update to authenticated using(public.has_module_permission('patients',true)) with check(public.has_module_permission('patients',true));

-- Payment-backed ledger entries can only be removed as part of the real reversal.
create function public.protect_receipt_ledger() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.payment_id is not null then
  if tg_op='DELETE' or new.payment_id is distinct from old.payment_id or new.charge_id is distinct from old.charge_id
   or new.amount_cents is distinct from old.amount_cents or new.unit_id is distinct from old.unit_id
   or new.clinic_id is distinct from old.clinic_id or new.kind is distinct from old.kind
   or new.description is distinct from old.description or new.category is distinct from old.category
   or new.cost_center is distinct from old.cost_center or new.competence_date is distinct from old.competence_date
   or new.settled_at is distinct from old.settled_at or new.recurrence_id is distinct from old.recurrence_id
   or (new.deleted_at is distinct from old.deleted_at and not exists(select 1 from public.payments p where p.id=old.payment_id and p.reversed_at is not null)) then
   raise exception 'PAYMENT_LEDGER_IMMUTABLE';
  end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger receipt_ledger_guard before update or delete on public.financial_entries for each row execute function public.protect_receipt_ledger();
revoke all on function public.protect_receipt_ledger() from public,anon,authenticated;
create or replace function public.rollback_enrollment(p_enrollment_id uuid, p_reason text, p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare target public.enrollments; affected integer := 0;
begin
  if not public.has_role(array['admin','manager','finance']::public.user_role[]) then raise exception 'FORBIDDEN'; end if;
  if length(trim(p_reason)) < 10 then raise exception 'ROLLBACK_REASON_REQUIRED'; end if;
  select * into target from public.enrollments where id = p_enrollment_id and clinic_id = public.current_clinic_id() and deleted_at is null for update;
  if target.id is null then raise exception 'ENROLLMENT_NOT_FOUND'; end if;
  if not public.has_unit_access(target.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
  if not public.has_module_permission('enrollments',false) or not public.has_module_permission('finance',true) then raise exception 'FORBIDDEN'; end if;
  perform 1 from public.charges where enrollment_id=target.id order by id for update;
  if exists(select 1 from public.charges c where c.enrollment_id=target.id and (c.paid_cents>0 or exists(select 1 from public.payments p where p.charge_id=c.id and p.reversed_at is null))) then raise exception 'ENROLLMENT_HAS_PAYMENTS'; end if;
  if target.sessions_used>0 or exists(select 1 from public.class_attendances where enrollment_id=target.id) or exists(select 1 from public.class_memberships m join public.occurrence_participants p on p.source_id=m.id join public.attendances a on a.occurrence_participant_id=p.id where m.enrollment_id=target.id) then raise exception 'ENROLLMENT_HAS_HISTORY'; end if;
  update public.class_memberships set enrollment_id=null where enrollment_id=target.id;
  update public.class_attendances set enrollment_id = null, updated_at = now() where enrollment_id = target.id;
  update public.group_slot_memberships set enrollment_id = null, updated_at = now() where enrollment_id = target.id and deleted_at is null;
  get diagnostics affected = row_count;
  update public.charges set deleted_at = now(), updated_at = now() where enrollment_id = target.id and clinic_id = target.clinic_id and paid_cents = 0 and deleted_at is null;
  update public.enrollments set deleted_at = now(), updated_at = now() where id = target.id;
  insert into public.audit_events(clinic_id, unit_id, user_id, action, entity_type, entity_id, request_id, metadata)
  values(target.clinic_id, target.unit_id, auth.uid(), 'enrollment.rolled_back', 'enrollment', target.id, p_request_id, jsonb_build_object('reason', trim(p_reason), 'memberships_unlinked', affected));
  return jsonb_build_object('enrollment_id', target.id, 'memberships_unlinked', affected);
end
$$;

create function public.can_view_agenda_unit(target_unit uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.has_unit_access(target_unit) or (public.current_role()='professional' and public.has_agenda_permission(false)
 and exists(select 1 from public.class_occurrences o where o.unit_id=target_unit and o.clinic_id=public.current_clinic_id()
 and (o.start_at at time zone o.timezone)::date=(now() at time zone o.timezone)::date and o.status<>'cancelled' and coalesce(o.actual_professional_id,o.planned_professional_id)=public.current_professional_id()))
$$;
revoke all on function public.can_view_agenda_unit(uuid) from public,anon;
grant execute on function public.can_view_agenda_unit(uuid) to authenticated;
create policy units_substitute_select on public.units for select to authenticated using(clinic_id=public.current_clinic_id() and public.can_view_agenda_unit(id));
drop policy classes_agenda_select on public.classes;
create policy classes_agenda_select on public.classes as restrictive for select to authenticated using(public.can_access_class(id));
do $$ declare t text; begin foreach t in array array['appointments','group_slots','group_slot_memberships','class_attendances'] loop
 execute format('create policy %I on public.%I as restrictive for select to authenticated using(public.has_agenda_permission(false))',t||'_module_read',t);
end loop; end $$;


-- SECTION agenda_consistency
alter table public.appointments add column availability_kind text check(availability_kind in('holiday','leave'));
alter table public.group_slots drop constraint group_slots_capacity_check;
alter table public.group_slots add constraint group_slots_capacity_check check(capacity>0);
-- Existing Class model is the operational authority. Legacy commands are bridged
-- atomically only when an operator changes a row; no existing row is backfilled.
create function public.agenda_weekdays(days smallint[]) returns public.class_weekday[] language sql immutable set search_path='' as $$
 select array_agg((case d when 0 then 'sunday' when 1 then 'monday' when 2 then 'tuesday' when 3 then 'wednesday' when 4 then 'thursday' when 5 then 'friday' when 6 then 'saturday' end)::public.class_weekday order by d) from unnest(days) d
$$;
-- Legacy weekday values remain a fallback only for unchanged imported memberships.
create or replace function public._effective_occurrence_patient_ids(p_occurrence_id uuid)
returns table(patient_id uuid) language sql stable security definer set search_path='' as $$
 with target as (
  select o.*, (array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']::public.class_weekday[])[extract(isodow from o.local_date)::int] as weekday
  from public.class_occurrences o where o.id=p_occurrence_id and o.clinic_id=public.current_clinic_id()
 ), base as (
  select m.patient_id from target t join public.class_schedules s on s.id=t.class_schedule_id
  join public.class_memberships m on m.class_id=t.class_id and m.clinic_id=t.clinic_id and m.effective_from<=t.local_date and (m.effective_to is null or t.local_date<m.effective_to)
  left join public.group_slot_memberships lm on m.legacy_source='group_slot_membership' and lm.id=m.legacy_source_id and lm.clinic_id=m.clinic_id
  where t.weekday=any(coalesce(m.weekdays,public.agenda_weekdays(lm.weekdays),s.weekdays))
   and not exists(select 1 from public.occurrence_participants x where x.class_occurrence_id=t.id and x.patient_id=m.patient_id and x.status='cancelled')
 ), explicit as (
  select x.patient_id from target t join public.occurrence_participants x on x.class_occurrence_id=t.id and x.clinic_id=t.clinic_id where x.status='active'
 ) select distinct r.patient_id from (select * from base union all select * from explicit) r join public.patients p on p.id=r.patient_id and p.clinic_id=public.current_clinic_id() and p.deleted_at is null
$$;

-- All schedule-affecting writes take the same clinic transaction lock. This also
-- protects the read/check/write HTTP paths and cross-model concurrent requests.
create function public.lock_agenda_clinic(p_clinic uuid) returns void language sql volatile set search_path='' as $$
 select pg_advisory_xact_lock(hashtextextended('fisiofit-agenda:'||p_clinic::text,0))
$$;
revoke all on function public.lock_agenda_clinic(uuid) from public,anon,authenticated;

create function public.assert_agenda_window(p_clinic uuid,p_professional uuid,p_patient uuid,p_start timestamptz,p_end timestamptz,p_occurrence uuid default null,p_appointment uuid default null,p_class uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare s record; day date; first_day date; last_day date; candidate_start timestamptz; candidate_end timestamptz;
begin
 if p_start>=p_end then raise exception 'INVALID_TIME_RANGE'; end if;
 if p_professional is not null and exists(select 1 from public.appointments a where a.clinic_id=p_clinic and a.id is distinct from p_appointment and a.deleted_at is null and a.status not in('cancelled','missed','completed') and a.professional_id=p_professional and (a.availability_kind is distinct from 'leave' or p_occurrence is null or exists(select 1 from public.class_occurrences existing where existing.id=p_occurrence)) and a.starts_at<p_end and p_start<a.ends_at
  and not exists(select 1 from public.classes c where c.id=p_class and c.legacy_source='group_slot' and c.legacy_source_id=a.group_slot_id)) then raise exception 'PROFESSIONAL_SCHEDULE_CONFLICT'; end if;
 if p_patient is not null and exists(select 1 from public.appointments a where a.clinic_id=p_clinic and a.id is distinct from p_appointment and a.deleted_at is null and a.status not in('cancelled','missed','completed') and a.patient_id=p_patient and a.starts_at<p_end and p_start<a.ends_at) then raise exception 'PATIENT_SCHEDULE_CONFLICT'; end if;
 if p_professional is not null and exists(select 1 from public.class_occurrences o where o.clinic_id=p_clinic and o.id is distinct from p_occurrence and o.status in('planned','in_progress') and coalesce(o.actual_professional_id,o.planned_professional_id)=p_professional and o.start_at<p_end and p_start<o.end_at) then raise exception 'PROFESSIONAL_SCHEDULE_CONFLICT'; end if;
 if p_patient is not null and exists(select 1 from public.class_occurrences o where o.clinic_id=p_clinic and o.id is distinct from p_occurrence and o.status in('planned','in_progress') and o.start_at<p_end and p_start<o.end_at and exists(select 1 from public._effective_occurrence_patient_ids(o.id) r where r.patient_id=p_patient)) then raise exception 'PATIENT_SCHEDULE_CONFLICT'; end if;
 -- Include recurrence that has not yet been materialized; skip dates whose
 -- concrete occurrence already carries a cancellation or point exception.
 for s in select cs.* from public.class_schedules cs join public.classes c on c.id=cs.class_id
  where c.clinic_id=p_clinic and c.status='active' and c.id is distinct from p_class
   and (cs.planned_professional_id=p_professional or (p_patient is not null and exists(select 1 from public.class_memberships m where m.class_id=c.id and m.patient_id=p_patient)))
 loop
  first_day:=greatest(s.effective_from,(p_start at time zone s.timezone)::date);
  last_day:=least(coalesce(s.effective_to-1,(p_end at time zone s.timezone)::date),(p_end at time zone s.timezone)::date);
  for day in select generate_series(first_day,last_day,interval '1 day')::date loop
   if (array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']::public.class_weekday[])[extract(isodow from day)::int]<>all(s.weekdays) then continue; end if;
   if exists(select 1 from public.class_occurrences o where o.class_schedule_id=s.id and o.local_date=day) then continue; end if;
   candidate_start:=(day+s.start_time) at time zone s.timezone; candidate_end:=(day+s.end_time) at time zone s.timezone;
   if candidate_start>=p_end or p_start>=candidate_end then continue; end if;
   if s.planned_professional_id=p_professional then raise exception 'PROFESSIONAL_SCHEDULE_CONFLICT'; end if;
   if p_patient is not null and exists(select 1 from public.class_memberships m left join public.group_slot_memberships lm on m.legacy_source='group_slot_membership' and lm.id=m.legacy_source_id
    where m.class_id=s.class_id and m.patient_id=p_patient and m.effective_from<=day and (m.effective_to is null or day<m.effective_to)
    and (array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']::public.class_weekday[])[extract(isodow from day)::int]=any(coalesce(m.weekdays,public.agenda_weekdays(lm.weekdays),s.weekdays))) then raise exception 'PATIENT_SCHEDULE_CONFLICT'; end if;
  end loop;
 end loop;
end $$;
revoke all on function public.assert_agenda_window(uuid,uuid,uuid,timestamptz,timestamptz,uuid,uuid,uuid) from public,anon,authenticated;

create function public.agenda_integrity_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.classes; s public.class_schedules; o public.class_occurrences; r record; d date; lower_day date; upper_day date; test_day date; member_days public.class_weekday[];
begin
 if auth.uid() is null then return new; end if; -- database owner setup, never an authenticated RPC bypass
 perform public.lock_agenda_clinic(new.clinic_id);
 if new.clinic_id is distinct from public.current_clinic_id() then raise exception 'FORBIDDEN'; end if;
 if tg_table_name='class_memberships' and tg_op='UPDATE' and (to_jsonb(new)->>'enrollment_id') is distinct from (to_jsonb(old)->>'enrollment_id') and (to_jsonb(new)-'enrollment_id')=(to_jsonb(old)-'enrollment_id') then
  perform public.require_enrollment_financial_editor();
  if new.enrollment_id is not null and not exists(select 1 from public.enrollments e where e.id=new.enrollment_id and e.patient_id=new.patient_id and e.clinic_id=new.clinic_id) then raise exception 'INVALID_ENROLLMENT_SCOPE'; end if;
  return new;
 end if;
 if tg_table_name='class_occurrences' and tg_op='INSERT' and public.current_role()='professional' then
  if not public.has_agenda_permission(false) or new.planned_professional_id is distinct from public.current_professional_id() then raise exception 'FORBIDDEN'; end if;
 elsif not public.has_agenda_permission(true) then raise exception 'FORBIDDEN'; end if;
 if tg_table_name in('classes','class_schedules','class_memberships') and not public.has_role(array['admin','manager','reception']::public.user_role[]) then raise exception 'FORBIDDEN'; end if;
 if tg_table_name='classes' then
  if not exists(select 1 from public.units u where u.id=new.unit_id and u.clinic_id=new.clinic_id and u.deleted_at is null) or not public.has_unit_access(new.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
  if new.service_id is not null and not exists(select 1 from public.services v where v.id=new.service_id and v.clinic_id=new.clinic_id and v.deleted_at is null) then raise exception 'INVALID_SERVICE_SCOPE'; end if;
  return new;
 end if;
 if tg_table_name in('class_schedules','class_memberships','class_occurrences') then
  select * into c from public.classes where id=new.class_id and clinic_id=new.clinic_id;
  if c.id is null then raise exception 'CLASS_NOT_FOUND'; end if;
  if not public.has_unit_access(c.unit_id) and not(tg_table_name='class_occurrences' and public.current_role()='professional' and (to_jsonb(new)->>'planned_professional_id')::uuid=public.current_professional_id()) then raise exception 'UNIT_FORBIDDEN'; end if;
 end if;
 if tg_table_name='class_schedules' then
  if new.planned_professional_id is not null and not exists(select 1 from public.professionals p where p.id=new.planned_professional_id and p.clinic_id=new.clinic_id and p.active and p.deleted_at is null) then raise exception 'PROFESSIONAL_NOT_AVAILABLE_FOR_UNIT'; end if;
  if new.planned_professional_id is not null and not exists(select 1 from public.professional_units pu where pu.professional_id=new.planned_professional_id and pu.unit_id=c.unit_id) then raise exception 'PROFESSIONAL_NOT_AVAILABLE_FOR_UNIT'; end if;
  if new.room_id is not null and not exists(select 1 from public.rooms rm where rm.id=new.room_id and rm.clinic_id=new.clinic_id and rm.unit_id=c.unit_id and rm.deleted_at is null) then raise exception 'INVALID_ROOM_SCOPE'; end if;
  if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'INVALID_TIMEZONE'; end if;
  if tg_op='UPDATE' and (to_jsonb(new)-'effective_to')=(to_jsonb(old)-'effective_to') then return new; end if;
  -- A recurring overlap exists only if an actual common weekday is inside both vigencies.
  for r in select cs.* from public.class_schedules cs join public.classes cl on cl.id=cs.class_id
   where cs.clinic_id=new.clinic_id and cs.class_id<>new.class_id and cl.status='active' and cs.planned_professional_id=new.planned_professional_id
   and daterange(cs.effective_from,cs.effective_to,'[)')&&daterange(new.effective_from,new.effective_to,'[)')
  loop
   lower_day:=greatest(r.effective_from,new.effective_from); upper_day:=least(coalesce(r.effective_to,lower_day+7),coalesce(new.effective_to,lower_day+7),lower_day+7);
   for d in select generate_series(lower_day,upper_day-1,interval '1 day')::date loop
    if (array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']::public.class_weekday[])[extract(isodow from d)::int]=any(r.weekdays)
     and (array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']::public.class_weekday[])[extract(isodow from d)::int]=any(new.weekdays)
     and (d+new.start_time) at time zone new.timezone < (d+r.end_time) at time zone r.timezone
     and (d+r.start_time) at time zone r.timezone < (d+new.end_time) at time zone new.timezone then raise exception 'PROFESSIONAL_SCHEDULE_CONFLICT'; end if;
   end loop;
  end loop;
  -- Validate dated commitments already persisted outside this recurrence.
  for r in select a.starts_at,a.ends_at from public.appointments a where a.clinic_id=new.clinic_id and a.professional_id=new.planned_professional_id and a.deleted_at is null and a.status not in('cancelled','missed','completed')
    and (a.starts_at at time zone new.timezone)::date>=new.effective_from and (new.effective_to is null or (a.starts_at at time zone new.timezone)::date<new.effective_to)
    and not exists(select 1 from public.classes cl where cl.id=new.class_id and cl.legacy_source='group_slot' and cl.legacy_source_id=a.group_slot_id)
  loop
   d:=(r.starts_at at time zone new.timezone)::date;
   if (array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']::public.class_weekday[])[extract(isodow from d)::int]=any(new.weekdays)
    and (d+new.start_time) at time zone new.timezone<r.ends_at and r.starts_at<(d+new.end_time) at time zone new.timezone then raise exception 'PROFESSIONAL_SCHEDULE_CONFLICT'; end if;
  end loop;
 elsif tg_table_name='class_memberships' then
  if not exists(select 1 from public.patients p where p.id=new.patient_id and p.clinic_id=new.clinic_id and p.deleted_at is null) then raise exception 'PATIENT_NOT_FOUND'; end if;
  if new.enrollment_id is not null and not exists(select 1 from public.enrollments e where e.id=new.enrollment_id and e.clinic_id=new.clinic_id and e.patient_id=new.patient_id and e.deleted_at is null) then raise exception 'INVALID_ENROLLMENT_SCOPE'; end if;
  -- Enrollment association alone does not rewrite the schedule or past attendance.
  if tg_op='UPDATE' and new.enrollment_id is distinct from old.enrollment_id and (to_jsonb(new)-'enrollment_id')=(to_jsonb(old)-'enrollment_id') then return new; end if;
  for s in select cs.* from public.class_schedules cs where cs.class_id=new.class_id and daterange(cs.effective_from,cs.effective_to,'[)')&&daterange(new.effective_from,new.effective_to,'[)') loop
   if new.weekdays is not null and not(new.weekdays<@s.weekdays) then raise exception 'INVALID_MEMBERSHIP_WEEKDAYS'; end if;
   member_days:=coalesce(new.weekdays,s.weekdays);
   -- Finite dates cover already scheduled exceptions/appointments. Recurring
   -- pairs below cover the unbounded remainder without an arbitrary horizon.
   for o in select co.* from public.class_occurrences co where co.class_id=new.class_id and co.local_date>=new.effective_from and (new.effective_to is null or co.local_date<new.effective_to) and co.status in('planned','in_progress') loop
    if (array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']::public.class_weekday[])[extract(isodow from o.local_date)::int]=any(member_days) then
     perform public.assert_agenda_window(new.clinic_id,null,new.patient_id,o.start_at,o.end_at,o.id,null,new.class_id);
    end if;
   end loop;
   for r in select cs.*,m.effective_from as mf,m.effective_to as mt,coalesce(m.weekdays,public.agenda_weekdays(lm.weekdays),cs.weekdays) as md
    from public.class_memberships m join public.class_schedules cs on cs.class_id=m.class_id join public.classes cl on cl.id=m.class_id
    left join public.group_slot_memberships lm on m.legacy_source='group_slot_membership' and lm.id=m.legacy_source_id
    where m.patient_id=new.patient_id and m.clinic_id=new.clinic_id and m.class_id<>new.class_id and cl.status='active'
      and daterange(m.effective_from,m.effective_to,'[)')&&daterange(new.effective_from,new.effective_to,'[)')
      and daterange(cs.effective_from,cs.effective_to,'[)')&&daterange(new.effective_from,new.effective_to,'[)')
   loop
    lower_day:=greatest(s.effective_from,new.effective_from,r.effective_from,r.mf);
    upper_day:=least(coalesce(s.effective_to,lower_day+7),coalesce(new.effective_to,lower_day+7),coalesce(r.effective_to,lower_day+7),coalesce(r.mt,lower_day+7),lower_day+7);
    for d in select generate_series(lower_day,upper_day-1,interval '1 day')::date loop
     if (array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']::public.class_weekday[])[extract(isodow from d)::int]=any(member_days)
      and (array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']::public.class_weekday[])[extract(isodow from d)::int]=any(r.md)
      and (d+s.start_time) at time zone s.timezone<(d+r.end_time) at time zone r.timezone and (d+r.start_time) at time zone r.timezone<(d+s.end_time) at time zone s.timezone then raise exception 'PATIENT_SCHEDULE_CONFLICT'; end if;
    end loop;
   end loop;
   for r in select a.* from public.appointments a where a.clinic_id=new.clinic_id and a.patient_id=new.patient_id and a.deleted_at is null and a.status not in('cancelled','missed','completed') loop
    d:=(r.starts_at at time zone s.timezone)::date;
    if d>=greatest(s.effective_from,new.effective_from) and (s.effective_to is null or d<s.effective_to) and (new.effective_to is null or d<new.effective_to)
     and (array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']::public.class_weekday[])[extract(isodow from d)::int]=any(member_days)
     and (d+s.start_time) at time zone s.timezone<r.ends_at and r.starts_at<(d+s.end_time) at time zone s.timezone then raise exception 'PATIENT_SCHEDULE_CONFLICT'; end if;
   end loop;
  end loop;
 elsif tg_table_name='class_occurrences' then
  select * into s from public.class_schedules where id=new.class_schedule_id and class_id=new.class_id and clinic_id=new.clinic_id;
  if s.id is null or new.unit_id<>c.unit_id then raise exception 'INVALID_OCCURRENCE_SCOPE'; end if;
  if public.current_role()='professional' and (tg_op<>'INSERT' or new.start_at is distinct from (new.local_date+s.start_time) at time zone s.timezone or new.end_at is distinct from (new.local_date+s.end_time) at time zone s.timezone or new.actual_professional_id is not null) then raise exception 'FORBIDDEN'; end if;
  if new.room_id is not null and not exists(select 1 from public.rooms rm where rm.id=new.room_id and rm.clinic_id=new.clinic_id and rm.unit_id=new.unit_id and rm.deleted_at is null) then raise exception 'INVALID_ROOM_SCOPE'; end if;
  if coalesce(new.actual_professional_id,new.planned_professional_id) is not null and not exists(select 1 from public.professionals p where p.id=coalesce(new.actual_professional_id,new.planned_professional_id) and p.clinic_id=new.clinic_id and p.active and p.deleted_at is null) then raise exception 'PROFESSIONAL_NOT_AVAILABLE_FOR_UNIT'; end if;
  if tg_op='UPDATE' and row(new.start_at,new.end_at,new.actual_professional_id,new.planned_professional_id) is distinct from row(old.start_at,old.end_at,old.actual_professional_id,old.planned_professional_id) and (old.status in('completed','in_progress') or exists(select 1 from public.occurrence_participants op join public.attendances a on a.occurrence_participant_id=op.id where op.class_occurrence_id=old.id)) then raise exception 'OCCURRENCE_HISTORY_IMMUTABLE'; end if;
  if new.status='cancelled' and tg_op='UPDATE' and old.status<>'cancelled' and exists(select 1 from public.occurrence_participants op where op.class_occurrence_id=new.id and op.status='active' and (op.source_type='makeup_reservation' or exists(select 1 from public.attendances a where a.occurrence_participant_id=op.id))) then raise exception 'OCCURRENCE_HAS_ATTENDANCE_OR_MAKEUP'; end if;
  if tg_op='INSERT' and exists(select 1 from public.appointments a where a.clinic_id=new.clinic_id and a.availability_kind='holiday' and a.status='blocked' and a.deleted_at is null and a.starts_at<new.end_at and new.start_at<a.ends_at) then
   new.status:='cancelled';new.cancelled_at:=now();new.cancelled_by:=auth.uid();new.cancellation_reason:='holiday';
  end if;
  if tg_op='INSERT' and exists(select 1 from public.class_occurrences existing where existing.class_schedule_id=new.class_schedule_id and existing.local_date=new.local_date) then return new; end if;
  if new.status in('planned','in_progress') then
   perform public.assert_agenda_window(new.clinic_id,coalesce(new.actual_professional_id,new.planned_professional_id),null,new.start_at,new.end_at,new.id,null,new.class_id);
   for r in select patient_id from public._effective_occurrence_patient_ids(new.id) loop
    perform public.assert_agenda_window(new.clinic_id,null,r.patient_id,new.start_at,new.end_at,new.id,null,new.class_id);
   end loop;
  end if;
 elsif tg_table_name='appointments' then
  if not public.has_unit_access(new.unit_id) or (public.current_role()='professional' and new.professional_id is distinct from public.current_professional_id()) then raise exception 'FORBIDDEN'; end if;
  if not exists(select 1 from public.units u where u.id=new.unit_id and u.clinic_id=new.clinic_id) or (new.professional_id is not null and not exists(select 1 from public.professionals p where p.id=new.professional_id and p.clinic_id=new.clinic_id and p.active and p.deleted_at is null)) then raise exception 'INVALID_APPOINTMENT_SCOPE'; end if;
  if new.patient_id is not null and not exists(select 1 from public.patients p where p.id=new.patient_id and p.clinic_id=new.clinic_id and p.deleted_at is null) then raise exception 'PATIENT_NOT_FOUND'; end if;
  if new.availability_kind is not null then
   if not public.has_role(array['admin','manager','reception']::public.user_role[]) or new.patient_id is not null or new.status<>'blocked' then raise exception 'FORBIDDEN'; end if;
   return new;
  end if;
  if new.deleted_at is null and new.status not in('cancelled','completed','missed') then
   perform public.assert_agenda_window(new.clinic_id,new.professional_id,new.patient_id,new.starts_at,new.ends_at,null,new.id,null);
  end if;
 end if;
 return new;
end $$;
revoke all on function public.agenda_integrity_guard() from public,anon,authenticated;
do $$ declare t text; begin foreach t in array array['classes','class_schedules','class_memberships','class_occurrences','appointments'] loop
 execute format('create trigger agenda_integrity before insert or update on public.%I for each row execute function public.agenda_integrity_guard()',t);
end loop; end $$;

create function public.reconcile_schedule_occurrences() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then return new; end if;
 if tg_op='UPDATE' then
  if new.effective_to is distinct from old.effective_to then
   if new.effective_to < (now() at time zone new.timezone)::date then raise exception 'SCHEDULE_HISTORY_IMMUTABLE'; end if;
   if exists(select 1 from public.class_occurrences o where o.class_schedule_id=new.id and o.local_date>=new.effective_to
    and (o.status in('in_progress','completed') or exists(select 1 from public.occurrence_participants p join public.attendances a on a.occurrence_participant_id=p.id where p.class_occurrence_id=o.id))) then raise exception 'SCHEDULE_HAS_ATTENDANCE'; end if;
   if exists(select 1 from public.class_occurrences o where o.class_schedule_id=new.id and o.local_date>=new.effective_to and o.status='planned' and o.updated_at<>o.created_at) then raise exception 'SCHEDULE_HAS_EXCEPTIONS'; end if;
   update public.class_occurrences set status='cancelled',cancelled_at=now(),cancelled_by=auth.uid(),cancellation_reason='Schedule version superseded',updated_at=now()
    where class_schedule_id=new.id and local_date>=new.effective_to and status='planned';
  end if;
 else
  update public.class_memberships set weekdays=weekdays where class_id=new.class_id and (effective_to is null or effective_to>new.effective_from);
  perform public.generate_class_occurrences(new.id,greatest(new.effective_from,(now() at time zone new.timezone)::date),greatest(new.effective_from,(now() at time zone new.timezone)::date)+56);
 end if;
 return new;
end $$;
create trigger schedule_occurrence_reconciliation after insert or update on public.class_schedules for each row execute function public.reconcile_schedule_occurrences();
revoke all on function public.reconcile_schedule_occurrences() from public,anon,authenticated;

-- A bridge processes only this explicit command's target. Invalid existing
-- references require reconciliation; they are never silently nulled or copied.
create function public.bridge_legacy_group_write() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.classes; s public.class_schedules; cm public.class_memberships; starts date; until_date date; days public.class_weekday[]; parent public.group_slots;
begin
 if auth.uid() is null then return new; end if;
 if tg_table_name='group_slot_memberships' and tg_op='UPDATE' then
  if (to_jsonb(new)-array['enrollment_id','updated_at'])=(to_jsonb(old)-array['enrollment_id','updated_at']) and new.clinic_id=public.current_clinic_id() then
   perform public.require_enrollment_financial_editor();
   update public.class_memberships set enrollment_id=new.enrollment_id where clinic_id=new.clinic_id and legacy_source='group_slot_membership' and legacy_source_id=new.id;
   return new;
  end if;
 end if;
 if not public.has_agenda_permission(true) or not public.has_role(array['admin','manager','reception']::public.user_role[]) or new.clinic_id<>public.current_clinic_id() then raise exception 'FORBIDDEN'; end if;
 perform public.lock_agenda_clinic(new.clinic_id);
 if tg_table_name='group_slots' then
  select * into c from public.classes where clinic_id=new.clinic_id and legacy_source='group_slot' and legacy_source_id=new.id for update;
  if c.id is null then
   if tg_op<>'INSERT' then raise exception 'LEGACY_RECONCILIATION_REQUIRED'; end if;
   insert into public.classes(clinic_id,unit_id,name,service_id,status,created_by,legacy_source,legacy_source_id)
   values(new.clinic_id,new.unit_id,new.name,new.service_id,case when new.active then 'active'::public.class_status else 'inactive'::public.class_status end,auth.uid(),'group_slot',new.id) returning * into c;
   insert into public.class_schedules(clinic_id,class_id,effective_from,effective_to,weekdays,start_time,end_time,timezone,planned_professional_id,effective_capacity,room_id,created_by,legacy_source,legacy_source_id)
   values(new.clinic_id,c.id,coalesce(new.starts_on,current_date),case when new.ends_on is null then null else new.ends_on+1 end,public.agenda_weekdays(new.weekdays),new.starts_at,new.starts_at+make_interval(mins=>new.duration_minutes),'America/Sao_Paulo',new.professional_id,new.capacity,new.room_id,auth.uid(),'group_slot',new.id);
  else
   if new.unit_id<>c.unit_id then raise exception 'INVALID_GROUP_SLOT_SCOPE'; end if;
   update public.classes set name=new.name,service_id=new.service_id,status=case when new.active and new.deleted_at is null then 'active'::public.class_status else 'inactive'::public.class_status end,updated_at=now() where id=c.id;
   if not new.active or new.deleted_at is not null then
    if exists(select 1 from public.class_occurrences o join public.occurrence_participants p on p.class_occurrence_id=o.id join public.attendances a on a.occurrence_participant_id=p.id where o.class_id=c.id and o.local_date>=current_date) then raise exception 'SCHEDULE_HAS_ATTENDANCE'; end if;
    update public.class_occurrences set status='cancelled',cancelled_at=now(),cancelled_by=auth.uid(),cancellation_reason='Class closed',updated_at=now() where class_id=c.id and local_date>=current_date and status='planned';
   elsif row(new.professional_id,new.weekdays,new.starts_at,new.room_id,new.duration_minutes,new.capacity,new.ends_on) is distinct from row(old.professional_id,old.weekdays,old.starts_at,old.room_id,old.duration_minutes,old.capacity,old.ends_on) then
    starts:=greatest(current_date,coalesce(new.starts_on,current_date));
    select * into s from public.class_schedules where class_id=c.id and effective_from<=starts and (effective_to is null or starts<effective_to) order by effective_from desc limit 1;
    if s.id is null then raise exception 'CLASS_SCHEDULE_NOT_FOUND'; end if;
    if starts=s.effective_from then raise exception 'USE_SCHEDULE_EFFECTIVE_DATE'; end if;
    perform public.change_class_schedule_from_date(c.id,starts,public.agenda_weekdays(new.weekdays),new.starts_at,new.starts_at+make_interval(mins=>new.duration_minutes),'America/Sao_Paulo',new.professional_id,new.capacity,new.room_id);
   end if;
  end if;
 else
  select * into parent from public.group_slots where id=new.group_slot_id and clinic_id=new.clinic_id;
  select * into c from public.classes where clinic_id=new.clinic_id and legacy_source='group_slot' and legacy_source_id=new.group_slot_id;
  if c.id is null then raise exception 'LEGACY_RECONCILIATION_REQUIRED'; end if;
  if not public.has_unit_access(c.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
  select * into cm from public.class_memberships where clinic_id=new.clinic_id and legacy_source='group_slot_membership' and legacy_source_id=new.id for update;
  if cm.id is not null and tg_op='UPDATE' and row(new.group_slot_id,new.patient_id,new.starts_at,new.ends_at,new.weekdays,new.status,new.deleted_at) is not distinct from row(old.group_slot_id,old.patient_id,old.starts_at,old.ends_at,old.weekdays,old.status,old.deleted_at) then
   update public.class_memberships set enrollment_id=new.enrollment_id where id=cm.id; return new;
  end if;
  if cm.id is null and tg_op='INSERT' and new.status='active' and new.deleted_at is null then
   select * into cm from public.class_memberships where clinic_id=new.clinic_id and class_id=c.id and patient_id=new.patient_id and legacy_source is null
    and effective_from<=new.starts_at and (effective_to is null or new.starts_at<effective_to) order by effective_from desc limit 1 for update;
   if cm.id is not null then
    if cm.enrollment_id is not null and cm.enrollment_id is distinct from new.enrollment_id then raise exception 'GROUP_HAS_OTHER_ENROLLMENT'; end if;
    update public.class_memberships set enrollment_id=coalesce(new.enrollment_id,enrollment_id),legacy_source='group_slot_membership',legacy_source_id=new.id where id=cm.id;
    return new;
   end if;
  end if;
  if cm.id is not null then
   -- Preserve the past version; a future edit starts no earlier than today.
   starts:=greatest(current_date,cm.effective_from);
   update public.class_memberships set effective_to=least(coalesce(effective_to,starts),starts),legacy_source='group_slot_membership_revision:'||id::text where id=cm.id;
  end if;
  if new.status='active' and new.deleted_at is null then
   starts:=case when tg_op='INSERT' then new.starts_at else greatest(current_date,new.starts_at) end;
   until_date:=case when new.ends_at is null then null else new.ends_at+1 end;
   if until_date is not null and until_date<=starts then raise exception 'INVALID_MEMBERSHIP_PERIOD'; end if;
   insert into public.class_memberships(clinic_id,class_id,patient_id,enrollment_id,effective_from,effective_to,weekdays,created_by,legacy_source,legacy_source_id)
   values(new.clinic_id,c.id,new.patient_id,new.enrollment_id,starts,until_date,public.agenda_weekdays(coalesce(new.weekdays,parent.weekdays)),auth.uid(),'group_slot_membership',new.id);
  end if;
 end if;
 return new;
end $$;
-- Empty ranges represent an explicitly cancelled future membership, preserving its ID.
alter table public.class_memberships drop constraint class_memberships_check;
alter table public.class_memberships add constraint class_memberships_period check(effective_to is null or effective_to>=effective_from);
create trigger legacy_group_bridge after insert or update on public.group_slots for each row execute function public.bridge_legacy_group_write();
create trigger legacy_membership_bridge after insert or update on public.group_slot_memberships for each row execute function public.bridge_legacy_group_write();
revoke all on function public.bridge_legacy_group_write() from public,anon,authenticated;

create or replace function public.generate_class_occurrences(
  p_class_schedule_id uuid,
  p_from date,
  p_to date
) returns table(created_count integer, existing_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.class_schedules;
  target_class public.classes;
  effective_from date;
  effective_to date;
begin
  if p_from is null or p_to is null or p_to <= p_from or p_to-p_from>93 then
    raise exception 'INVALID_OCCURRENCE_WINDOW';
  end if;
  if not public.has_agenda_permission(false) or not public.has_role(array['admin','manager','reception','professional']::public.user_role[]) then
    raise exception 'FORBIDDEN';
  end if;

  select s.*
    into target
    from public.class_schedules s
    join public.classes c on c.id = s.class_id
   where s.id = p_class_schedule_id
     and s.clinic_id = public.current_clinic_id()
     and c.clinic_id = public.current_clinic_id()
     and (public.has_unit_access(c.unit_id) or s.planned_professional_id=public.current_professional_id());

  if not found or (public.current_role()='professional' and target.planned_professional_id is distinct from public.current_professional_id()) then
    raise exception 'CLASS_SCHEDULE_NOT_FOUND';
  end if;
  select c.*
    into target_class
    from public.classes c
   where c.id = target.class_id
     and c.clinic_id = public.current_clinic_id();
  if target_class.status <> 'active' then
    return query select 0, 0;
    return;
  end if;

  effective_from := greatest(p_from, target.effective_from);
  effective_to := least(p_to, coalesce(target.effective_to, p_to));
  if effective_from >= effective_to then
    return query select 0, 0;
    return;
  end if;

  return query
  with candidate_dates as (
    select day::date as local_date
    from generate_series(effective_from, effective_to - 1, interval '1 day') as day
    where target.weekdays @> array[
      (case extract(isodow from day)::integer
        when 1 then 'monday'
        when 2 then 'tuesday'
        when 3 then 'wednesday'
        when 4 then 'thursday'
        when 5 then 'friday'
        when 6 then 'saturday'
        when 7 then 'sunday'
      end)::public.class_weekday
    ]
  ), inserted as (
    insert into public.class_occurrences (
      clinic_id, class_id, class_schedule_id, unit_id, service_id, local_date,
      local_start_time, local_end_time, timezone, start_at, end_at,
      planned_professional_id, actual_professional_id, effective_capacity, room_id,
      status, created_by
    )
    select
      target.clinic_id, target.class_id, target.id, target_class.unit_id, target_class.service_id, candidate.local_date,
      target.start_time, target.end_time, target.timezone,
      (candidate.local_date + target.start_time) at time zone target.timezone,
      (candidate.local_date + target.end_time) at time zone target.timezone,
      target.planned_professional_id, null, target.effective_capacity, target.room_id,
      'planned'::public.class_occurrence_status, auth.uid()
    from candidate_dates candidate
    on conflict (class_schedule_id, local_date) do nothing
    returning id
  )
  select
    (select count(*)::integer from inserted),
    (select count(*)::integer from candidate_dates) - (select count(*)::integer from inserted);
end
$$;

revoke execute on function public.generate_class_occurrences(uuid, date, date) from public, anon;
grant execute on function public.generate_class_occurrences(uuid, date, date) to authenticated;

create function public.ensure_calendar_window(p_unit_id uuid,p_from date,p_to date) returns integer
language plpgsql security definer set search_path='' as $$
declare s record; result record; total integer:=0;
begin
 if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>93 then raise exception 'INVALID_OCCURRENCE_WINDOW'; end if;
 if not public.has_agenda_permission(false) or not public.has_role(array['admin','manager','reception','professional']::public.user_role[]) then raise exception 'FORBIDDEN'; end if;
 if not public.can_view_agenda_unit(p_unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
 for s in select cs.id from public.class_schedules cs join public.classes c on c.id=cs.class_id
  where c.clinic_id=public.current_clinic_id() and c.unit_id=p_unit_id and c.status='active'
  and daterange(cs.effective_from,cs.effective_to,'[)')&&daterange(p_from,p_to,'[)')
  and (public.current_role()<>'professional' or cs.planned_professional_id=public.current_professional_id())
 loop
  select * into result from public.generate_class_occurrences(s.id,p_from,p_to);
  total:=total+result.created_count;
 end loop; return total;
end $$;
revoke all on function public.ensure_calendar_window(uuid,date,date) from public,anon;
grant execute on function public.ensure_calendar_window(uuid,date,date) to authenticated;

create function public.operational_group_slots() returns setof jsonb
language sql stable security definer set search_path='' as $$
 select to_jsonb(gs)||jsonb_build_object('class_id',null,'reconciliation_required',true,'schedule_versions','[]'::jsonb)
 from public.group_slots gs where gs.clinic_id=public.current_clinic_id() and gs.deleted_at is null
 and public.has_agenda_permission(false) and public.has_unit_access(gs.unit_id)
 and (public.current_role() in('admin','manager','reception') or gs.professional_id=public.current_professional_id())
 and not exists(select 1 from public.classes c where c.legacy_source='group_slot' and c.legacy_source_id=gs.id and c.clinic_id=gs.clinic_id)
 union all
 select jsonb_build_object('id',coalesce(c.legacy_source_id,c.id),'class_id',c.id,'unit_id',c.unit_id,'name',c.name,'service_id',c.service_id,'active',c.status='active','professional_id',s.planned_professional_id,
 'weekdays',(select jsonb_agg(case d when 'sunday' then 0 when 'monday' then 1 when 'tuesday' then 2 when 'wednesday' then 3 when 'thursday' then 4 when 'friday' then 5 else 6 end) from unnest(s.weekdays) d),
 'starts_at',s.start_time,'duration_minutes',extract(epoch from(s.end_time-s.start_time))/60,'capacity',s.effective_capacity,'room_id',s.room_id,'starts_on',s.effective_from,'ends_on',s.effective_to-1,
 'schedule_versions',(select jsonb_agg(to_jsonb(v) order by v.effective_from) from public.class_schedules v where v.class_id=c.id),'reconciliation_required',false)
 from public.classes c left join lateral(select cs.* from public.class_schedules cs where cs.class_id=c.id order by (cs.effective_from<=current_date and (cs.effective_to is null or current_date<cs.effective_to)) desc,cs.effective_from desc limit 1) s on true
 where c.clinic_id=public.current_clinic_id() and public.can_access_class(c.id)
$$;
create function public.operational_group_memberships() returns setof jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',m.id,'class_membership_id',m.id,'group_slot_id',coalesce(c.legacy_source_id,c.id),'class_id',c.id,'enrollment_id',m.enrollment_id,'patient_id',m.patient_id,'starts_at',m.effective_from,'ends_at',m.effective_to-1,'status','active',
 'weekdays',(select jsonb_agg(case d when 'sunday' then 0 when 'monday' then 1 when 'tuesday' then 2 when 'wednesday' then 3 when 'thursday' then 4 when 'friday' then 5 else 6 end) from unnest(coalesce(m.weekdays,public.agenda_weekdays(lm.weekdays))) d),
 'class_membership_weekdays',coalesce(m.weekdays,public.agenda_weekdays(lm.weekdays)), 'patients',jsonb_build_object('id',p.id,'name',p.name,'phone',p.phone),'group_slots',jsonb_build_object('name',c.name,'unit_id',c.unit_id))
 from public.class_memberships m join public.classes c on c.id=m.class_id join public.patients p on p.id=m.patient_id
 left join public.group_slot_memberships lm on m.legacy_source='group_slot_membership' and lm.id=m.legacy_source_id
 where m.clinic_id=public.current_clinic_id() and public.can_access_class(c.id) and public.can_access_patient(p.id)
 and (m.effective_to is null or m.effective_to>m.effective_from)
 and (public.current_role()<>'professional' or exists(select 1 from public.class_schedules s where s.class_id=c.id and s.planned_professional_id=public.current_professional_id() and daterange(s.effective_from,s.effective_to,'[)')&&daterange(m.effective_from,m.effective_to,'[)')))
$$;

create function public.save_operational_membership(p_group_id uuid,p_patient_id uuid,p_from date,p_to date,p_weekdays public.class_weekday[],p_enrollment_id uuid default null,p_id uuid default null)
returns public.class_memberships language plpgsql security definer set search_path='' as $$
declare c public.classes; previous public.class_memberships; result public.class_memberships;
begin
 if not public.has_agenda_permission(true) or not public.has_role(array['admin','manager','reception']::public.user_role[]) then raise exception 'FORBIDDEN'; end if;
 perform public.lock_agenda_clinic(public.current_clinic_id());
 select * into c from public.classes where clinic_id=public.current_clinic_id() and (id=p_group_id or (legacy_source='group_slot' and legacy_source_id=p_group_id));
 if c.id is null then raise exception 'LEGACY_RECONCILIATION_REQUIRED'; end if;
 if c.status<>'active' then raise exception 'CLASS_INACTIVE'; end if;
 if not public.has_unit_access(c.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
 if p_from is null or (p_id is not null and p_from<current_date) or (p_to is not null and p_to<=p_from) or p_weekdays is null then raise exception 'INVALID_MEMBERSHIP_PERIOD'; end if;
 if p_id is not null then
  select * into previous from public.class_memberships where clinic_id=c.clinic_id and (id=p_id or (legacy_source='group_slot_membership' and legacy_source_id=p_id)) for update;
  if previous.id is null or previous.patient_id<>p_patient_id then raise exception 'CLASS_MEMBERSHIP_NOT_FOUND'; end if;
  if not exists(select 1 from public.classes pc where pc.id=previous.class_id and public.has_unit_access(pc.unit_id)) then raise exception 'UNIT_FORBIDDEN'; end if;
 end if;
 select * into result from public.class_memberships where class_id=c.id and patient_id=p_patient_id and effective_from=p_from and effective_to is not distinct from p_to and weekdays=p_weekdays;
 if result.id is not null then return result; end if;
 if previous.id is not null then
  if previous.effective_to is not null and previous.effective_to<p_from then raise exception 'CLASS_MEMBERSHIP_NOT_FOUND'; end if;
  update public.class_memberships set effective_to=greatest(previous.effective_from,p_from) where id=previous.id;
 end if;
 insert into public.class_memberships(clinic_id,class_id,patient_id,enrollment_id,effective_from,effective_to,weekdays,created_by)
 values(c.clinic_id,c.id,p_patient_id,p_enrollment_id,p_from,p_to,p_weekdays,auth.uid()) returning * into result;
 insert into public.audit_events(clinic_id,unit_id,user_id,action,entity_type,entity_id,metadata) values(c.clinic_id,c.unit_id,auth.uid(),'class.membership_versioned','class_membership',result.id,jsonb_build_object('previous_id',previous.id,'effective_from',p_from));
 return result;
end $$;
create function public.end_operational_membership(p_id uuid,p_effective_from date) returns public.class_memberships
language plpgsql security definer set search_path='' as $$
declare m public.class_memberships; c public.classes;
begin
 if not public.has_agenda_permission(true) or not public.has_role(array['admin','manager','reception']::public.user_role[]) then raise exception 'FORBIDDEN'; end if;
 perform public.lock_agenda_clinic(public.current_clinic_id());
 if p_effective_from is null or p_effective_from<current_date then raise exception 'SCHEDULE_HISTORY_IMMUTABLE'; end if;
 select * into m from public.class_memberships where clinic_id=public.current_clinic_id() and (id=p_id or (legacy_source='group_slot_membership' and legacy_source_id=p_id)) for update;
 select * into c from public.classes where id=m.class_id;
 if m.id is null then raise exception 'CLASS_MEMBERSHIP_NOT_FOUND'; end if;
 if not public.has_unit_access(c.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
 update public.class_memberships set effective_to=least(coalesce(effective_to,greatest(p_effective_from,effective_from)),greatest(p_effective_from,effective_from)) where id=m.id returning * into m;
 insert into public.audit_events(clinic_id,unit_id,user_id,action,entity_type,entity_id,metadata) values(c.clinic_id,c.unit_id,auth.uid(),'class.membership_ended','class_membership',m.id,jsonb_build_object('effective_from',p_effective_from));
 return m;
end $$;
revoke all on function public.operational_group_slots(),public.operational_group_memberships(),public.save_operational_membership(uuid,uuid,date,date,public.class_weekday[],uuid,uuid),public.end_operational_membership(uuid,date) from public,anon;
grant execute on function public.operational_group_slots(),public.operational_group_memberships(),public.save_operational_membership(uuid,uuid,date,date,public.class_weekday[],uuid,uuid),public.end_operational_membership(uuid,date) to authenticated;
create function public.update_operational_group(p_group_id uuid,p_input jsonb) returns public.classes
language plpgsql security definer set search_path='' as $$
declare c public.classes; s public.class_schedules; requested date; days public.class_weekday[];
begin
 if not public.has_agenda_permission(true) or not public.has_role(array['admin','manager','reception']::public.user_role[]) then raise exception 'FORBIDDEN'; end if;
 perform public.lock_agenda_clinic(public.current_clinic_id());
 select * into c from public.classes where clinic_id=public.current_clinic_id() and (id=p_group_id or (legacy_source='group_slot' and legacy_source_id=p_group_id)) for update;
 if c.id is null then raise exception 'LEGACY_RECONCILIATION_REQUIRED'; end if;
 if not public.has_unit_access(c.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
 requested:=coalesce((p_input->>'effective_from')::date,current_date);
 if requested<current_date then raise exception 'SCHEDULE_HISTORY_IMMUTABLE'; end if;
 if p_input->>'active'='false' then
  if exists(select 1 from public.class_occurrences o join public.occurrence_participants op on op.class_occurrence_id=o.id join public.attendances a on a.occurrence_participant_id=op.id where o.class_id=c.id and o.local_date>=requested) then raise exception 'SCHEDULE_HAS_ATTENDANCE'; end if;
  update public.class_occurrences set status='cancelled',cancelled_at=now(),cancelled_by=auth.uid(),cancellation_reason='Class closed',updated_at=now() where class_id=c.id and local_date>=requested and status='planned';
  update public.classes set status='inactive',updated_at=now() where id=c.id returning * into c;
 else
  select * into s from public.class_schedules where class_id=c.id and effective_from<=requested and (effective_to is null or requested<effective_to) order by effective_from desc limit 1;
  days:=case when p_input?'weekdays' then public.agenda_weekdays(array(select jsonb_array_elements_text(p_input->'weekdays')::smallint)) else s.weekdays end;
  if p_input?'starts_at' and (days is distinct from s.weekdays or (p_input->>'starts_at')::time is distinct from s.start_time
   or (p_input->>'starts_at')::time+make_interval(mins=>(p_input->>'duration_minutes')::integer) is distinct from s.end_time
   or nullif(p_input->>'professional_id','')::uuid is distinct from s.planned_professional_id or nullif(p_input->>'room_id','')::uuid is distinct from s.room_id) then
   if requested=s.effective_from then raise exception 'USE_SCHEDULE_EFFECTIVE_DATE'; end if;
   perform public.change_class_schedule_from_date(c.id,requested,days,(p_input->>'starts_at')::time,(p_input->>'starts_at')::time+make_interval(mins=>(p_input->>'duration_minutes')::integer),s.timezone,nullif(p_input->>'professional_id','')::uuid,coalesce((p_input->>'capacity')::integer,s.effective_capacity),nullif(p_input->>'room_id','')::uuid);
  end if;
  update public.classes set name=coalesce(p_input->>'name',name),service_id=case when p_input?'service_id' then nullif(p_input->>'service_id','')::uuid else service_id end,status='active',updated_at=now() where id=c.id returning * into c;
 end if;
 insert into public.audit_events(clinic_id,unit_id,user_id,action,entity_type,entity_id,metadata) values(c.clinic_id,c.unit_id,auth.uid(),'class.updated','class',c.id,jsonb_build_object('effective_from',requested));
 return c;
end $$;
revoke all on function public.update_operational_group(uuid,jsonb) from public,anon;
grant execute on function public.update_operational_group(uuid,jsonb) to authenticated;

-- RN-006 removes one obsolete admission precondition from the CURRENT
-- financial predecessor. Do not replace the body from an older migration:
-- later approved releases added the contracted-price snapshot there.
do $patch$
declare definition text; marker text := $capacity$    if membership.id is null and (select count(*) from public.group_slot_memberships where group_slot_id=group_id and status='active' and deleted_at is null and starts_at<=coalesce(ends,'infinity'::date) and coalesce(ends_at,'infinity'::date)>=starts)>=selected_slot.capacity then raise exception 'GROUP_CAPACITY_REACHED'; end if;$capacity$;
begin
 definition:=pg_get_functiondef('public.save_enrollment_before_financial_release(jsonb,uuid,uuid)'::regprocedure);
 if position('contract_amount_cents' in definition)=0 then raise exception 'FINANCIAL_SNAPSHOT_PRECONDITION_FAILED'; end if;
 if position(marker in definition)>0 then execute replace(definition,marker,'');
 elsif position('GROUP_CAPACITY_REACHED' in definition)>0 then raise exception 'CAPACITY_PATCH_PRECONDITION_FAILED'; end if;
end $patch$;

create or replace function public.effective_occurrence_patient_ids(p_occurrence_id uuid) returns table(patient_id uuid)
language plpgsql stable security definer set search_path='' as $$ begin
 if not public.can_access_occurrence(p_occurrence_id) then raise exception 'CLASS_OCCURRENCE_NOT_FOUND'; end if;
 return query select r.patient_id from public._effective_occurrence_patient_ids(p_occurrence_id) r;
end $$;

create or replace function public.update_class_occurrence(
  p_occurrence_id uuid,
  p_start_time time,
  p_end_time time,
  p_actual_professional_id uuid,
  p_room_id uuid
) returns public.class_occurrences
language plpgsql security definer set search_path = '' as $$
declare target public.class_occurrences; target_professional uuid; result public.class_occurrences;
begin
  perform public.lock_agenda_clinic(public.current_clinic_id());
  select * into target from public.class_occurrences
   where id = p_occurrence_id and clinic_id = public.current_clinic_id() for update;
  if not found or not public.can_access_class(target.class_id) then raise exception 'CLASS_OCCURRENCE_NOT_FOUND'; end if;
  if not public.has_role(array['admin','manager','reception']::public.user_role[]) then raise exception 'FORBIDDEN'; end if;
  if target.status = 'cancelled' then raise exception 'OCCURRENCE_CANCELLED'; end if;
  if p_start_time >= p_end_time then raise exception 'INVALID_TIME_RANGE'; end if;
  target_professional := coalesce(p_actual_professional_id, target.planned_professional_id);
  if target_professional is not null then
    if not exists (select 1 from public.professionals p where p.id = target_professional and p.clinic_id = target.clinic_id and p.active and p.deleted_at is null) then
      raise exception 'PROFESSIONAL_NOT_AVAILABLE_FOR_UNIT';
    end if;
    if exists (select 1 from public.class_occurrences o where o.clinic_id = target.clinic_id and o.id <> target.id and o.status in ('planned','in_progress') and coalesce(o.actual_professional_id, o.planned_professional_id) = target_professional and ((target.start_at at time zone target.timezone)::date + p_start_time) at time zone target.timezone < o.end_at and o.start_at < ((target.start_at at time zone target.timezone)::date + p_end_time) at time zone target.timezone)
      or exists (select 1 from public.appointments a where a.clinic_id = target.clinic_id and a.professional_id = target_professional and a.deleted_at is null and a.status not in ('cancelled','completed') and ((target.start_at at time zone target.timezone)::date + p_start_time) at time zone target.timezone < a.ends_at and a.starts_at < ((target.start_at at time zone target.timezone)::date + p_end_time) at time zone target.timezone) then
      raise exception 'PROFESSIONAL_SCHEDULE_CONFLICT';
    end if;
  end if;
  update public.class_occurrences set local_start_time = p_start_time, local_end_time = p_end_time,
    start_at = ((target.start_at at time zone target.timezone)::date + p_start_time) at time zone target.timezone,
    end_at = ((target.start_at at time zone target.timezone)::date + p_end_time) at time zone target.timezone,
    actual_professional_id = p_actual_professional_id, room_id = p_room_id, updated_at = now()
  where id = target.id returning * into result;
  return result;
end $$;


create or replace function public.add_occurrence_participant(p_occurrence_id uuid, p_patient_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.class_occurrences; target_clinic uuid; membership_id uuid; present boolean; current_count integer; participant public.occurrence_participants;
begin
  perform public.lock_agenda_clinic(public.current_clinic_id());
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

  perform public.assert_agenda_window(target.clinic_id,null,p_patient_id,target.start_at,target.end_at,target.id,null,target.class_id);

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
  perform public.lock_agenda_clinic(public.current_clinic_id());
  select * into target from public.class_occurrences where id = p_occurrence_id and clinic_id = public.current_clinic_id() for update;
  if not found or not public.can_access_class(target.class_id) then raise exception 'CLASS_OCCURRENCE_NOT_FOUND'; end if;
  if not public.has_role(array['admin','manager','reception']::public.user_role[]) or not public.has_unit_access(target.unit_id) or not public.has_module_permission('agenda', true) then raise exception 'FORBIDDEN'; end if;
  if target.status = 'cancelled' then raise exception 'OCCURRENCE_CANCELLED'; end if;
  if target.status <> 'planned' then raise exception 'INVALID_OCCURRENCE_STATE_TRANSITION'; end if;
  if exists(select 1 from public.occurrence_participants p join public.attendances a on a.occurrence_participant_id=p.id where p.class_occurrence_id=target.id and p.patient_id=p_patient_id) then raise exception 'OCCURRENCE_HAS_ATTENDANCE'; end if;
  if exists(select 1 from public.occurrence_participants p where p.class_occurrence_id=target.id and p.patient_id=p_patient_id and p.status='active' and p.source_type='makeup_reservation') then raise exception 'MAKEUP_CREDIT_IN_USE'; end if;
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

create function public.calendar_occurrence_rosters(p_ids uuid[]) returns table(occurrence_id uuid,patient_ids uuid[])
language plpgsql stable security definer set search_path='' as $$ begin
 if cardinality(p_ids)>1000 or not public.has_agenda_permission(false) then raise exception 'FORBIDDEN'; end if;
 return query select o.id,array(select r.patient_id from public._effective_occurrence_patient_ids(o.id) r) from public.class_occurrences o where o.id=any(p_ids) and public.can_access_occurrence(o.id);
end $$;
revoke all on function public.calendar_occurrence_rosters(uuid[]) from public,anon;
grant execute on function public.calendar_occurrence_rosters(uuid[]) to authenticated;


-- SECTION occurrence_attendance_corrections
-- Contextual attendance and corrections; prior rows and authors remain intact.
alter table public.attendances add column notes text check(notes is null or length(notes)<=2000);
alter table public.attendance_revisions add column before_notes text,add column after_notes text;
alter table public.attendance_revisions drop constraint attendance_revisions_check;
alter table public.attendance_revisions add constraint attendance_revision_change check(before_status<>after_status or before_notes is distinct from after_notes);
create policy attendances_context on public.attendances as restrictive for select to authenticated using(exists(select 1 from public.occurrence_participants p where p.id=occurrence_participant_id and public.can_access_occurrence(p.class_occurrence_id)));
create policy attendance_revisions_context on public.attendance_revisions as restrictive for select to authenticated using(exists(select 1 from public.attendances a join public.occurrence_participants p on p.id=a.occurrence_participant_id where a.id=attendance_id and public.can_access_occurrence(p.class_occurrence_id)));
create or replace function public.get_class_occurrence_attendance(p_occurrence_id uuid)
returns table(patient_id uuid, patient_name text, patient_active boolean, source_type text,
  attendance_id uuid, attendance_status text, recorded_at timestamptz, correction_count bigint)
language plpgsql stable security definer set search_path = '' as $$
declare target public.class_occurrences;
begin
  select * into target from public.class_occurrences
  where id = p_occurrence_id and clinic_id = public.current_clinic_id();
  if not found or not public.can_access_occurrence(target.id) then
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
    left join public.group_slot_memberships lm on m.legacy_source='group_slot_membership' and lm.id=m.legacy_source_id
      where m.class_id = target.class_id and m.clinic_id = target.clinic_id
        and m.effective_from <= target.local_date and (m.effective_to is null or target.local_date < m.effective_to)
        and (case extract(isodow from target.local_date)::integer
          when 1 then 'monday'::public.class_weekday when 2 then 'tuesday'::public.class_weekday
          when 3 then 'wednesday'::public.class_weekday when 4 then 'thursday'::public.class_weekday
          when 5 then 'friday'::public.class_weekday when 6 then 'saturday'::public.class_weekday
          else 'sunday'::public.class_weekday end) = any(coalesce(m.weekdays, public.agenda_weekdays(lm.weekdays), s.weekdays))
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
  if not found or not public.can_access_occurrence(target.id) then
    raise exception 'CLASS_OCCURRENCE_NOT_FOUND';
  end if;
  if not public.has_agenda_permission(true) then raise exception 'FORBIDDEN'; end if;
  if target.status = 'cancelled' then raise exception 'OCCURRENCE_CANCELLED'; end if;
  if (target.start_at at time zone target.timezone)::date>(now() at time zone target.timezone)::date then raise exception 'FUTURE_ATTENDANCE'; end if;
  if target.status not in ('planned','in_progress','completed') then raise exception 'INVALID_OCCURRENCE_STATE_TRANSITION'; end if;
  is_manager := public.current_role() in ('admin','manager','reception','professional');
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
    left join public.group_slot_memberships lm on m.legacy_source='group_slot_membership' and lm.id=m.legacy_source_id
    where m.class_id = target.class_id and m.clinic_id = target.clinic_id and m.patient_id = p_patient_id
      and m.effective_from <= target.local_date and (m.effective_to is null or target.local_date < m.effective_to)
      and (case extract(isodow from target.local_date)::integer
        when 1 then 'monday'::public.class_weekday when 2 then 'tuesday'::public.class_weekday
        when 3 then 'wednesday'::public.class_weekday when 4 then 'thursday'::public.class_weekday
        when 5 then 'friday'::public.class_weekday when 6 then 'saturday'::public.class_weekday
        else 'sunday'::public.class_weekday end) = any(coalesce(m.weekdays, public.agenda_weekdays(lm.weekdays), s.weekdays)) limit 1;
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

create function public.save_occurrence_attendance(p_occurrence_id uuid,p_patient_id uuid,p_status text,p_reason text default null,p_expected_version integer default null,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_record public.attendances; result jsonb; current_notes text; status_changed boolean;
begin
  perform public.lock_agenda_clinic(public.current_clinic_id());
 if not public.can_access_occurrence(p_occurrence_id) or not public.has_agenda_permission(true) then raise exception 'FORBIDDEN'; end if;
 perform 1 from public.class_occurrences where id=p_occurrence_id for update;
 select a.* into current_record from public.attendances a join public.occurrence_participants p on p.id=a.occurrence_participant_id where p.class_occurrence_id=p_occurrence_id and p.patient_id=p_patient_id for update of a;
 if current_record.id is not null and p_expected_version is distinct from current_record.version and (current_record.status is distinct from p_status or current_record.notes is distinct from p_notes) then raise exception 'ATTENDANCE_VERSION_CONFLICT'; end if;
 if p_notes is not null and length(p_notes)>2000 then raise exception 'INVALID_ATTENDANCE_NOTES'; end if;
 status_changed:=current_record.status is distinct from p_status;
 if current_record.id is not null and current_record.notes is distinct from p_notes and length(trim(coalesce(p_reason,'')))<3 then raise exception 'ATTENDANCE_CORRECTION_REASON_REQUIRED'; end if;
 result:=public.record_class_occurrence_attendance(p_occurrence_id,p_patient_id,p_status,p_reason);
 if current_record.id is null then
  update public.attendances set notes=p_notes where id=(result->>'attendanceId')::uuid;
 elsif current_record.notes is distinct from p_notes then
  if not status_changed then
   insert into public.attendance_revisions(clinic_id,attendance_id,before_status,after_status,reason,actor_id,before_notes,after_notes)
   values(current_record.clinic_id,current_record.id,current_record.status,p_status,trim(p_reason),auth.uid(),current_record.notes,p_notes);
  else
   update public.attendance_revisions set before_notes=current_record.notes,after_notes=p_notes where attendance_id=current_record.id and created_at=now() and actor_id=auth.uid();
  end if;
  update public.attendances set notes=p_notes,updated_at=now(),updated_by=auth.uid(),version=version+case when status_changed then 0 else 1 end where id=current_record.id;
  result:=result||jsonb_build_object('status','corrected');
 end if;
 return result;
end $$;
create function public.get_occurrence_attendance_details(p_occurrence_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.can_access_occurrence(p_occurrence_id) then raise exception 'CLASS_OCCURRENCE_NOT_FOUND'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('notes',a.notes,'version',a.version,'history',(select coalesce(jsonb_agg(jsonb_build_object('before_status',v.before_status,'after_status',v.after_status,'reason',v.reason,'actor_id',v.actor_id,'created_at',v.created_at,'before_notes',v.before_notes,'after_notes',v.after_notes) order by v.created_at),'[]'::jsonb) from public.attendance_revisions v where v.attendance_id=a.id))),'[]'::jsonb)
 into result from public.get_class_occurrence_attendance(p_occurrence_id) r left join public.attendances a on a.id=r.attendance_id;
 return result;
end $$;
revoke all on function public.save_occurrence_attendance(uuid,uuid,text,text,integer,text),public.get_occurrence_attendance_details(uuid) from public,anon;
grant execute on function public.save_occurrence_attendance(uuid,uuid,text,text,integer,text),public.get_occurrence_attendance_details(uuid) to authenticated;


-- SECTION financial_and_professional_integrity
-- Close direct DML/RPC bypasses while preserving approved financial behavior.
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
  if not public.has_role(array['admin','manager','finance']::public.user_role[]) then
    raise exception 'FORBIDDEN';
  end if;
  if not public.has_module_permission('finance',false) or not public.has_module_permission('finance',true) then raise exception 'FORBIDDEN'; end if;
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

create or replace function public.reverse_payment(
  p_payment_id uuid,
  p_reason text,
  p_request_id uuid
) returns public.payments
language plpgsql security definer set search_path = '' as $$
declare target public.payments; charge_row public.charges; result public.payments;
begin
  if not public.has_role(array['admin','manager','finance']::public.user_role[]) then
    raise exception 'FORBIDDEN';
  end if;
  if not public.has_module_permission('finance',false) or not public.has_module_permission('finance',true) then raise exception 'FORBIDDEN'; end if;
  if length(trim(coalesce(p_reason,''))) < 10 then raise exception 'REVERSAL_REASON_REQUIRED'; end if;
  select * into target from public.payments
    where id = p_payment_id and clinic_id = public.current_clinic_id();
  if target.id is null then raise exception 'PAYMENT_NOT_FOUND'; end if;
  select * into charge_row from public.charges where id = target.charge_id and clinic_id=target.clinic_id for update;
  if not public.has_unit_access(charge_row.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
  select * into target from public.payments where id=p_payment_id for update;
  if target.reversed_at is not null then return target; end if;
  update public.payments set reversed_at = now(), reversal_reason = trim(p_reason), reversed_by = auth.uid()
    where id = target.id returning * into result;
  update public.charges set
    paid_cents = greatest(paid_cents - target.amount_cents, 0),
    status = case when greatest(paid_cents - target.amount_cents, 0) = 0 then 'pending'::public.charge_status else 'partial'::public.charge_status end,
    updated_at = now()
    where id = charge_row.id;
  update public.financial_entries set deleted_at = now(), updated_at = now()
    where payment_id = target.id and clinic_id = target.clinic_id and deleted_at is null;
  insert into public.audit_events(clinic_id, unit_id, user_id, action, entity_type, entity_id, request_id, metadata)
    values(target.clinic_id, charge_row.unit_id, auth.uid(), 'payment.reversed', 'payment', target.id, p_request_id, jsonb_build_object('reason', trim(p_reason), 'amount_cents', target.amount_cents));
  return result;
end $$;

revoke insert,update,delete on public.payments from anon,authenticated;
revoke update,delete on public.charges from anon,authenticated;
-- Standalone charge insertion remains supported; a deferred guard checks the
-- final persisted balance after the complete financial transaction finishes.
create function public.check_payment_balance() returns trigger language plpgsql security definer set search_path='' as $$
declare target_id uuid; c public.charges; received integer;
begin
 if auth.uid() is null then return null; end if;
 if tg_table_name='charges' then target_id:=new.id;
 else target_id:=coalesce(new.charge_id,old.charge_id); end if;
 select * into c from public.charges where id=target_id;
 select coalesce(sum(p.amount_cents),0)::integer into received from public.payments p where p.charge_id=target_id and p.reversed_at is null;
 if c.id is null or c.paid_cents<>received or (c.status='paid' and (received=0 or received<>c.amount_cents))
  or (c.status='partial' and (received<=0 or received>=c.amount_cents)) or (received>0 and c.status not in('paid','partial'))
  or (received>0 and c.deleted_at is not null) then raise exception 'PAYMENT_BALANCE_CONFLICT'; end if;
 return null;
end $$;
create constraint trigger charge_payment_balance after insert or update on public.charges deferrable initially deferred for each row execute function public.check_payment_balance();
create constraint trigger receipt_payment_balance after insert or update or delete on public.payments deferrable initially deferred for each row execute function public.check_payment_balance();
revoke all on function public.check_payment_balance() from public,anon,authenticated;

-- Professional + unit + user association is one transaction, including audit.
create function public.save_professional(p_input jsonb,p_id uuid default null) returns public.professionals
language plpgsql security definer set search_path='' as $$
declare result public.professionals; unit_id uuid; selected_units uuid[]; profile uuid;
begin
 if not public.has_module_permission('settings',false) or not public.has_module_permission('settings',true) or not public.has_role(array['admin','manager','reception']::public.user_role[]) then raise exception 'FORBIDDEN'; end if;
 if jsonb_typeof(p_input)<>'object' or exists(select 1 from jsonb_object_keys(p_input) k where k not in('name','council','specialty','active','unitIds','profile_id')) then raise exception 'INVALID_PROFESSIONAL_INPUT'; end if;
 if p_id is not null then
  select * into result from public.professionals where id=p_id and clinic_id=public.current_clinic_id() and deleted_at is null for update;
  if result.id is null then raise exception 'PROFESSIONAL_NOT_FOUND'; end if;
 end if;
 if p_input?'unitIds' then
  selected_units:=array(select distinct jsonb_array_elements_text(p_input->'unitIds')::uuid);
  if cardinality(selected_units)=0 then raise exception 'INVALID_PROFESSIONAL_UNITS'; end if;
  foreach unit_id in array selected_units loop
   if not public.has_unit_access(unit_id) or not exists(select 1 from public.units u where u.id=unit_id and u.clinic_id=public.current_clinic_id() and u.deleted_at is null) then raise exception 'UNIT_FORBIDDEN'; end if;
  end loop;
 elsif p_id is null then raise exception 'INVALID_PROFESSIONAL_UNITS';
 end if;
 profile:=case when p_input?'profile_id' then nullif(p_input->>'profile_id','')::uuid else result.profile_id end;
 if profile is not null then
  -- The lock also serializes assignment attempts without adding a constraint
  -- over potentially duplicated historical references.
  perform pg_advisory_xact_lock(hashtextextended('professional-profile:'||profile::text,0));
  if not exists(select 1 from public.profiles p where p.id=profile and p.clinic_id=public.current_clinic_id() and p.status='active' and p.deleted_at is null) then raise exception 'INVALID_PROFESSIONAL_PROFILE'; end if;
  if exists(select 1 from public.professionals p where p.profile_id=profile and p.id is distinct from p_id and p.deleted_at is null) then raise exception 'PROFESSIONAL_PROFILE_ALREADY_LINKED'; end if;
 end if;
 if p_id is null then
  insert into public.professionals(clinic_id,name,council,specialty,active,profile_id) values(public.current_clinic_id(),p_input->>'name',p_input->>'council',p_input->>'specialty',coalesce((p_input->>'active')::boolean,true),profile) returning * into result;
 else
  update public.professionals set name=coalesce(p_input->>'name',name),council=case when p_input?'council' then p_input->>'council' else council end,specialty=case when p_input?'specialty' then p_input->>'specialty' else specialty end,active=coalesce((p_input->>'active')::boolean,active),profile_id=profile,updated_at=now() where id=p_id returning * into result;
 end if;
 if selected_units is not null then
  delete from public.professional_units pu where pu.professional_id=result.id and not(pu.unit_id=any(selected_units));
  insert into public.professional_units(professional_id,unit_id) select result.id,unnest(selected_units) on conflict do nothing;
 end if;
 insert into public.audit_events(clinic_id,user_id,action,entity_type,entity_id) values(result.clinic_id,auth.uid(),'professional.saved','professional',result.id);
 return result;
end $$;
revoke all on function public.save_professional(jsonb,uuid) from public,anon;
grant execute on function public.save_professional(jsonb,uuid) to authenticated;

-- Supabase default grants vary across historical deployments. Declare the
-- effective boundary explicitly, without changing roles or individual grants.
revoke all on all tables in schema public from anon;
revoke select on public.profiles,public.profile_permissions from authenticated;
grant select(id,clinic_id,name,role,status,created_at,deleted_at) on public.profiles to authenticated;
grant select(profile_id,module,can_view,can_edit) on public.profile_permissions to authenticated;
revoke insert,update,delete on public.charges,public.enrollments,public.plans,public.professionals,public.professional_units from authenticated;
revoke update,delete on public.audit_events from authenticated;
create policy payments_module_read on public.payments as restrictive for select to authenticated using(public.has_module_permission('finance',false));
create policy financial_entries_module_read on public.financial_entries as restrictive for select to authenticated using(public.has_module_permission('finance',false));
create policy financial_entries_module_write on public.financial_entries as restrictive for update to authenticated using(public.has_module_permission('finance',false) and public.has_module_permission('finance',true)) with check(public.has_module_permission('finance',false) and public.has_module_permission('finance',true));
create policy clinical_records_module_read on public.clinical_records as restrictive for select to authenticated using(public.has_module_permission('records',false));
create policy clinical_records_module_insert on public.clinical_records as restrictive for insert to authenticated with check(public.has_module_permission('records',false) and public.has_module_permission('records',true));
create policy clinical_records_module_update on public.clinical_records as restrictive for update to authenticated using(public.has_module_permission('records',false) and public.has_module_permission('records',true)) with check(public.has_module_permission('records',true));
create policy attachments_module_read on public.attachments as restrictive for select to authenticated using(public.has_module_permission('records',false));
create policy attachments_module_write on public.attachments as restrictive for update to authenticated using(public.has_module_permission('records',false) and public.has_module_permission('records',true)) with check(public.has_module_permission('records',true));

create function public.create_standalone_charge(p_input jsonb) returns public.charges
language plpgsql security definer set search_path='' as $$
declare result public.charges;
begin
 if not public.has_role(array['admin','manager','finance']::public.user_role[]) or not public.has_module_permission('finance',true) or not public.has_module_permission('finance',false) then raise exception 'FORBIDDEN'; end if;
 if not public.can_create_financial_charge((p_input->>'patient_id')::uuid,(p_input->>'unit_id')::uuid,null) then raise exception 'INVALID_PATIENT_SCOPE'; end if;
 if (p_input->>'coverage_to')::date<(p_input->>'coverage_from')::date then raise exception 'INVALID_PERIOD'; end if;
 insert into public.charges(clinic_id,unit_id,patient_id,description,amount_cents,due_at,coverage_from,coverage_to,status)
 values(public.current_clinic_id(),(p_input->>'unit_id')::uuid,(p_input->>'patient_id')::uuid,p_input->>'description',(p_input->>'amount_cents')::integer,(p_input->>'due_at')::date,(p_input->>'coverage_from')::date,(p_input->>'coverage_to')::date,'pending') returning * into result;
 insert into public.audit_events(clinic_id,unit_id,user_id,action,entity_type,entity_id) values(result.clinic_id,result.unit_id,auth.uid(),'charge.created','charge',result.id);
 return result;
end $$;
create function public.professional_profiles() returns table(id uuid,name text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_module_permission('settings',false) or not public.has_module_permission('settings',true) or not public.has_role(array['admin','manager','reception']::public.user_role[]) then raise exception 'FORBIDDEN'; end if;
 return query select p.id,p.name from public.profiles p where p.clinic_id=public.current_clinic_id() and p.status='active' and p.deleted_at is null order by p.name;
end $$;
revoke all on function public.create_standalone_charge(jsonb),public.professional_profiles() from public,anon;
grant execute on function public.create_standalone_charge(jsonb),public.professional_profiles() to authenticated;

revoke insert on public.financial_entries from authenticated;
grant insert(clinic_id,unit_id,kind,description,category,cost_center,amount_cents,competence_date,settled_at) on public.financial_entries to authenticated;
create policy financial_entries_module_insert on public.financial_entries as restrictive for insert to authenticated with check(public.has_module_permission('finance',false) and public.has_module_permission('finance',true));
create policy attachments_module_insert on public.attachments as restrictive for insert to authenticated with check(public.has_module_permission('records',false) and public.has_module_permission('records',true));

create or replace function public.link_pending_group_memberships_to_enrollment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is not null then
    update public.class_attendances attendance
       set enrollment_id = null,
           updated_at = now()
     where attendance.enrollment_id = new.id;

    update public.group_slot_memberships membership
       set enrollment_id = null,
           updated_at = now()
     where membership.enrollment_id = new.id;
  elsif new.status = 'active' then
    update public.class_memberships cm set enrollment_id=new.id from public.classes c
    where cm.class_id=c.id and cm.clinic_id=new.clinic_id and cm.patient_id=new.patient_id and cm.enrollment_id is null
      and c.unit_id=new.unit_id and c.status='active' and (cm.effective_to is null or cm.effective_to>=new.starts_at)
      and (new.ends_at is null or cm.effective_from<=new.ends_at);
    update public.group_slot_memberships membership
       set enrollment_id = new.id,
           updated_at = now()
     where membership.clinic_id = new.clinic_id
       and membership.patient_id = new.patient_id
       and membership.enrollment_id is null
       and membership.status = 'active'
       and membership.deleted_at is null
       and membership.group_slot_id in (
         select slot.id
           from public.group_slots slot
          where slot.clinic_id = new.clinic_id
            and slot.unit_id = new.unit_id
            and slot.deleted_at is null
       );

    update public.class_attendances attendance
       set enrollment_id = new.id,
           updated_at = now()
     where attendance.enrollment_id is null
       and attendance.membership_id in (
         select membership.id
           from public.group_slot_memberships membership
          where membership.enrollment_id = new.id
       );
  end if;
  return new;
end;
$$;



-- SECTION makeup_lifecycle
-- Reuse the existing attendance and occurrence_participants identities. There is
-- no credit backfill or invented deadline: undefined policy requires review.
alter table public.clinics add column makeup_policy jsonb check(makeup_policy is null or jsonb_typeof(makeup_policy)='object');
alter table public.plans add column makeup_policy jsonb check(makeup_policy is null or jsonb_typeof(makeup_policy)='object');
alter table public.attendances add column makeup_state text not null default 'none' check(makeup_state in('none','review','eligible','reserved','consumed','waived')),
 add column makeup_occurrence_id uuid references public.class_occurrences(id), add column makeup_participant_id uuid references public.occurrence_participants(id),add column makeup_reason text;
alter table public.class_attendances add column makeup_occurrence_id uuid references public.class_occurrences(id),add column makeup_participant_id uuid references public.occurrence_participants(id),add column makeup_reason text;
alter table public.class_attendances drop constraint class_attendances_makeup_status_check;
alter table public.class_attendances add constraint class_attendances_makeup_status_check check(makeup_status in('not_required','pending','reserved','completed','waived','review'));
create unique index attendances_makeup_participant on public.attendances(makeup_participant_id) where makeup_participant_id is not null;
create unique index legacy_attendances_makeup_participant on public.class_attendances(makeup_participant_id) where makeup_participant_id is not null;

create function public.attendance_makeup_lifecycle() returns trigger language plpgsql security definer set search_path='' as $$
declare participant public.occurrence_participants; origin public.attendances; legacy public.class_attendances; policy jsonb; member public.class_memberships; accepted boolean;
begin
 if tg_op='UPDATE' and new.status=old.status then return new; end if;
 select * into participant from public.occurrence_participants where id=new.occurrence_participant_id;
 if participant.source_type='makeup_reservation' then
  select * into origin from public.attendances where id=participant.source_id for update;
  if origin.id is not null then
   if origin.makeup_participant_id is not null and origin.makeup_participant_id<>participant.id then raise exception 'MAKEUP_CREDIT_IN_USE'; end if;
   if new.status in('PRESENT','LATE') then update public.attendances set makeup_state='consumed' where id=origin.id;
   elsif new.status in('ABSENT_JUSTIFIED','ABSENT_UNJUSTIFIED','CANCELLED_IN_ADVANCE','CANCELLED_LATE') then
    select coalesce(pl.makeup_policy,c.makeup_policy) into policy from public.clinics c left join public.occurrence_participants op on op.id=origin.occurrence_participant_id left join public.class_memberships m on m.id=op.source_id left join public.enrollments e on e.id=m.enrollment_id left join public.plans pl on pl.id=e.plan_id where c.id=origin.clinic_id;
    update public.attendances set makeup_state=case policy->>'no_show_action' when 'return' then 'eligible' when 'forfeit' then 'waived' else 'review' end,makeup_participant_id=null,makeup_occurrence_id=null where id=origin.id;
   end if;
  else
   select * into legacy from public.class_attendances where id=participant.source_id and clinic_id=participant.clinic_id for update;
   if legacy.id is null then raise exception 'MAKEUP_CREDIT_NOT_FOUND'; end if;
   if new.status in('PRESENT','LATE') then update public.class_attendances set makeup_status='completed',makeup_completed_at=now() where id=legacy.id;
   else update public.class_attendances set makeup_status='review',makeup_participant_id=null,makeup_occurrence_id=null where id=legacy.id; end if;
  end if;
  return new;
 end if;
 if tg_op='UPDATE' and old.makeup_state in('reserved','consumed') then raise exception 'MAKEUP_CREDIT_IN_USE'; end if;
 select * into member from public.class_memberships where id=participant.source_id;
 select coalesce(pl.makeup_policy,c.makeup_policy) into policy from public.clinics c left join public.enrollments e on e.id=member.enrollment_id left join public.plans pl on pl.id=e.plan_id where c.id=new.clinic_id;
 if new.status in('ABSENT_JUSTIFIED','ABSENT_UNJUSTIFIED','CANCELLED_IN_ADVANCE','CANCELLED_LATE') then
  accepted:=coalesce((policy->'eligible_statuses')?new.status,false);
  update public.attendances set makeup_state=case when accepted then 'eligible' when policy is null then 'review' else 'none' end where id=new.id;
 else update public.attendances set makeup_state='none' where id=new.id; end if;
 return new;
end $$;
create trigger attendance_makeup_lifecycle after insert or update of status on public.attendances for each row execute function public.attendance_makeup_lifecycle();
revoke all on function public.attendance_makeup_lifecycle() from public,anon,authenticated;

create function public.makeup_credits() returns setof jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',a.id,'legacy',false,'patient_id',p.id,'patient_name',p.name,'source_date',o.local_date,'state',a.makeup_state,'occurrence_id',a.makeup_occurrence_id,'reason',a.makeup_reason)
 from public.attendances a join public.occurrence_participants op on op.id=a.occurrence_participant_id join public.class_occurrences o on o.id=op.class_occurrence_id join public.patients p on p.id=op.patient_id
 where a.clinic_id=public.current_clinic_id() and a.makeup_state<>'none' and public.has_agenda_permission(false) and public.can_access_patient(p.id)
 union all
 select jsonb_build_object('id',a.id,'legacy',true,'patient_id',p.id,'patient_name',p.name,'source_date',a.class_date,'state',case a.makeup_status when 'pending' then 'eligible' when 'completed' then 'consumed' else a.makeup_status end,'occurrence_id',a.makeup_occurrence_id,'reason',a.makeup_reason)
 from public.class_attendances a join public.patients p on p.id=a.patient_id where a.clinic_id=public.current_clinic_id() and a.status='absent' and a.makeup_status<>'not_required' and public.has_agenda_permission(false) and public.can_access_patient(p.id)
$$;
create function public.manage_makeup_credit(p_credit uuid,p_action text,p_occurrence uuid default null,p_reason text default null,p_legacy boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare credit public.attendances; legacy public.class_attendances; target public.class_occurrences; part public.occurrence_participants; patient uuid; state text; previous_occurrence uuid;
begin
 if not public.has_agenda_permission(true) or not public.has_role(array['admin','manager','reception']::public.user_role[]) then raise exception 'FORBIDDEN'; end if;
 perform public.lock_agenda_clinic(public.current_clinic_id());
 if p_legacy then
  select * into legacy from public.class_attendances where id=p_credit and clinic_id=public.current_clinic_id() for update;
  if legacy.id is null or legacy.status<>'absent' then raise exception 'MAKEUP_CREDIT_NOT_FOUND'; end if;
  patient:=legacy.patient_id;state:=case legacy.makeup_status when 'pending' then 'eligible' when 'completed' then 'consumed' else legacy.makeup_status end;previous_occurrence:=legacy.makeup_occurrence_id;
 else
  select * into credit from public.attendances where id=p_credit and clinic_id=public.current_clinic_id() for update;
  if credit.id is null then raise exception 'MAKEUP_CREDIT_NOT_FOUND'; end if;
  select patient_id into patient from public.occurrence_participants where id=credit.occurrence_participant_id;
  state:=credit.makeup_state; previous_occurrence:=credit.makeup_occurrence_id;
 end if;
 if not public.can_access_patient(patient) then raise exception 'FORBIDDEN'; end if;
 if p_action='reserve' then
  if state='reserved' and previous_occurrence=p_occurrence then return jsonb_build_object('state','reserved','occurrence_id',p_occurrence); end if;
  if state<>'eligible' then raise exception 'MAKEUP_CREDIT_UNAVAILABLE'; end if;
  select * into target from public.class_occurrences where id=p_occurrence and clinic_id=public.current_clinic_id() for update;
  if target.id is null or not public.has_unit_access(target.unit_id) then raise exception 'CLASS_OCCURRENCE_NOT_FOUND'; end if;
  if target.status<>'planned' or target.end_at<now() then raise exception 'INVALID_OCCURRENCE_STATE_TRANSITION'; end if;
  if exists(select 1 from public._effective_occurrence_patient_ids(target.id) r where r.patient_id=patient) then raise exception 'PATIENT_ALREADY_IN_ROSTER'; end if;
  perform public.add_occurrence_participant(target.id,patient);
  update public.occurrence_participants set source_type='makeup_reservation',source_id=p_credit where class_occurrence_id=target.id and patient_id=patient returning * into part;
  state:='reserved';
 elsif p_action in('return','forfeit','approve') then
  if length(trim(coalesce(p_reason,'')))<3 then raise exception 'MAKEUP_REASON_REQUIRED'; end if;
  if state='consumed' then raise exception 'MAKEUP_CREDIT_IN_USE'; end if;
  if state='reserved' then
   if exists(select 1 from public.attendances a join public.occurrence_participants p on p.id=a.occurrence_participant_id where p.class_occurrence_id=previous_occurrence and p.patient_id=patient and a.status in('PRESENT','LATE')) then raise exception 'MAKEUP_CREDIT_IN_USE'; end if;
   update public.occurrence_participants set status='cancelled',cancelled_at=now(),cancelled_by=auth.uid(),cancellation_reason=trim(p_reason),updated_at=now(),updated_by=auth.uid() where class_occurrence_id=previous_occurrence and patient_id=patient and source_type='makeup_reservation' and source_id=p_credit;
  end if;
  state:=case when p_action='forfeit' then 'waived' else 'eligible' end;
 else raise exception 'INVALID_MAKEUP_ACTION'; end if;
 if p_legacy then
  update public.class_attendances set makeup_status=case when state='eligible' then 'pending' else state end,makeup_occurrence_id=case when state='reserved' then p_occurrence else null end,makeup_participant_id=case when state='reserved' then part.id else null end,makeup_reason=p_reason where id=p_credit;
 else
  update public.attendances set makeup_state=state,makeup_occurrence_id=case when state='reserved' then p_occurrence else null end,makeup_participant_id=case when state='reserved' then part.id else null end,makeup_reason=p_reason where id=p_credit;
 end if;
 insert into public.audit_events(clinic_id,user_id,action,entity_type,entity_id,metadata) values(public.current_clinic_id(),auth.uid(),'makeup.'||p_action,'makeup_credit',p_credit,jsonb_build_object('occurrence_id',p_occurrence,'reason',p_reason,'legacy',p_legacy));
 return jsonb_build_object('state',state,'occurrence_id',p_occurrence);
end $$;
revoke all on function public.makeup_credits(),public.manage_makeup_credit(uuid,text,uuid,text,boolean) from public,anon;
grant execute on function public.makeup_credits(),public.manage_makeup_credit(uuid,text,uuid,text,boolean) to authenticated;
-- Old writes cannot maintain a second attendance/credit lifecycle.
revoke insert,update,delete on public.class_attendances from authenticated;
revoke execute on function public.record_class_occurrence_attendance(uuid,uuid,text,text) from authenticated;


-- SECTION calendar_exceptions
-- Reuse appointment blocks for closures and professional unavailability.
create function public.save_agenda_exception(p_kind text,p_unit_id uuid,p_professional_id uuid,p_from timestamptz,p_to timestamptz,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.appointments; affected jsonb;
begin
 if not public.has_agenda_permission(true) or not public.has_role(array['admin','manager','reception']::public.user_role[]) then raise exception 'FORBIDDEN'; end if;
 if p_kind is null or p_kind not in('holiday','leave') or p_from is null or p_to is null or p_from>=p_to or length(trim(coalesce(p_reason,'')))<3 then raise exception 'INVALID_CALENDAR_EXCEPTION'; end if;
 if not public.has_unit_access(p_unit_id) or not exists(select 1 from public.units u where u.id=p_unit_id and u.clinic_id=public.current_clinic_id()) then raise exception 'UNIT_FORBIDDEN'; end if;
 if (p_from at time zone 'America/Sao_Paulo')::date<(now() at time zone 'America/Sao_Paulo')::date then raise exception 'SCHEDULE_HISTORY_IMMUTABLE'; end if;
 if p_kind='leave' and not exists(select 1 from public.professionals p where p.id=p_professional_id and p.clinic_id=public.current_clinic_id() and p.active and p.deleted_at is null) then raise exception 'PROFESSIONAL_NOT_FOUND'; end if;
 perform public.lock_agenda_clinic(public.current_clinic_id());
 if p_kind='holiday' and exists(select 1 from public.units u where u.clinic_id=public.current_clinic_id() and u.active and u.deleted_at is null and not public.has_unit_access(u.id)) then raise exception 'ALL_UNITS_REQUIRED'; end if;
 if exists(select 1 from public.class_occurrences o where o.clinic_id=public.current_clinic_id() and o.start_at<p_to and p_from<o.end_at and (p_kind='holiday' or coalesce(o.actual_professional_id,o.planned_professional_id)=p_professional_id) and not public.has_unit_access(o.unit_id)) then raise exception 'ALL_UNITS_REQUIRED'; end if;
 if p_kind='holiday' and exists(select 1 from public.class_occurrences o join public.occurrence_participants op on op.class_occurrence_id=o.id where o.clinic_id=public.current_clinic_id() and o.start_at<p_to and p_from<o.end_at and (op.source_type='makeup_reservation' and op.status='active' or exists(select 1 from public.attendances a where a.occurrence_participant_id=op.id))) then raise exception 'OCCURRENCE_HAS_ATTENDANCE_OR_MAKEUP'; end if;
 insert into public.appointments(clinic_id,unit_id,professional_id,starts_at,ends_at,status,notes,availability_kind)
 values(public.current_clinic_id(),p_unit_id,case when p_kind='leave' then p_professional_id else null end,p_from,p_to,'blocked',trim(p_reason),p_kind) returning * into result;
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'unit_id',o.unit_id,'start_at',o.start_at,'class_id',o.class_id)),'[]'::jsonb) into affected from public.class_occurrences o where o.clinic_id=result.clinic_id and o.start_at<p_to and p_from<o.end_at and o.status='planned' and (p_kind='holiday' or coalesce(o.actual_professional_id,o.planned_professional_id)=p_professional_id);
 if p_kind='holiday' then
  update public.class_occurrences set status='cancelled',cancelled_at=now(),cancelled_by=auth.uid(),cancellation_reason='holiday: '||trim(p_reason),updated_at=now()
  where clinic_id=result.clinic_id and start_at<p_to and p_from<end_at and status='planned';
 end if;
 insert into public.audit_events(clinic_id,unit_id,user_id,action,entity_type,entity_id,metadata) values(result.clinic_id,p_unit_id,auth.uid(),'agenda.'||p_kind,'appointment',result.id,jsonb_build_object('from',p_from,'to',p_to,'reason',p_reason));
 return jsonb_build_object('exception',to_jsonb(result),'affected',affected);
end $$;
revoke all on function public.save_agenda_exception(text,uuid,uuid,timestamptz,timestamptz,text) from public,anon;
grant execute on function public.save_agenda_exception(text,uuid,uuid,timestamptz,timestamptz,text) to authenticated;


-- SECTION occurrence_rescheduling
-- Keep the original recurrence date/key and roster; an exception has its own
-- displayed date. Generation can never recreate a second copy of this lesson.
alter table public.class_occurrences add column exception_date date,
 add column calendar_date date generated always as(coalesce(exception_date,local_date)) stored;
create index class_occurrences_calendar_date on public.class_occurrences(unit_id,calendar_date);
create function public.reschedule_class_occurrence(p_id uuid,p_date date,p_start time,p_end time,p_professional uuid,p_room uuid,p_reason text)
returns public.class_occurrences language plpgsql security definer set search_path='' as $$
declare target public.class_occurrences; result public.class_occurrences; planned_date public.class_occurrences;
begin
 if not public.has_agenda_permission(true) or not public.has_role(array['admin','manager','reception']::public.user_role[]) then raise exception 'FORBIDDEN'; end if;
 perform public.lock_agenda_clinic(public.current_clinic_id());
 select * into target from public.class_occurrences where id=p_id and clinic_id=public.current_clinic_id() for update;
 if target.id is null or not public.has_unit_access(target.unit_id) then raise exception 'CLASS_OCCURRENCE_NOT_FOUND'; end if;
 if length(trim(coalesce(p_reason,'')))<3 then raise exception 'OCCURRENCE_REASON_REQUIRED'; end if;
 if target.status<>'planned' then raise exception 'INVALID_OCCURRENCE_STATE_TRANSITION'; end if;
 if p_date<(now() at time zone target.timezone)::date or p_start>=p_end then raise exception 'INVALID_TIME_RANGE'; end if;
 if exists(select 1 from public.appointments a where a.clinic_id=target.clinic_id and a.availability_kind='holiday' and a.status='blocked' and a.deleted_at is null and a.starts_at<(p_date+p_end) at time zone target.timezone and (p_date+p_start) at time zone target.timezone<a.ends_at) then raise exception 'HOLIDAY_CLOSURE_REQUIRES_APPROVAL'; end if;
 -- The original recurring slot on the destination date is a separate lesson.
 if p_date<>target.local_date and exists(select 1 from public.class_schedules s where s.class_id=target.class_id and s.effective_from<=p_date and (s.effective_to is null or p_date<s.effective_to)
  and (array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']::public.class_weekday[])[extract(isodow from p_date)::int]=any(s.weekdays)
  and p_start<s.end_time and s.start_time<p_end
  and not exists(select 1 from public.class_occurrences o where o.class_schedule_id=s.id and o.local_date=p_date and o.status='cancelled')) then raise exception 'PROFESSIONAL_SCHEDULE_CONFLICT'; end if;
 update public.class_occurrences set exception_date=p_date,local_start_time=p_start,local_end_time=p_end,
 start_at=(p_date+p_start) at time zone timezone,end_at=(p_date+p_end) at time zone timezone,
 actual_professional_id=p_professional,room_id=p_room,updated_at=now() where id=target.id returning * into result;
 insert into public.audit_events(clinic_id,unit_id,user_id,action,entity_type,entity_id,metadata) values(target.clinic_id,target.unit_id,auth.uid(),'class_occurrence.rescheduled','class_occurrence',target.id,jsonb_build_object('previous_start_at',target.start_at,'start_at',result.start_at,'previous_professional',target.actual_professional_id,'actual_professional',result.actual_professional_id,'reason',trim(p_reason)));
 return result;
end $$;
create function public.reopen_holiday_occurrence(p_id uuid,p_reason text) returns public.class_occurrences
language plpgsql security definer set search_path='' as $$
declare target public.class_occurrences;
begin
 if not public.has_agenda_permission(true) or not public.has_role(array['admin','manager','reception']::public.user_role[]) then raise exception 'FORBIDDEN'; end if;
 perform public.lock_agenda_clinic(public.current_clinic_id());
 select * into target from public.class_occurrences where id=p_id and clinic_id=public.current_clinic_id() for update;
 if target.id is null or not public.has_unit_access(target.unit_id) then raise exception 'CLASS_OCCURRENCE_NOT_FOUND'; end if;
 if target.status<>'cancelled' or target.cancellation_reason not like 'holiday%' or length(trim(coalesce(p_reason,'')))<3 then raise exception 'INVALID_OCCURRENCE_STATE_TRANSITION'; end if;
 update public.class_occurrences set status='planned',cancelled_at=null,cancelled_by=null,cancellation_reason=null,updated_at=now() where id=target.id returning * into target;
 insert into public.audit_events(clinic_id,unit_id,user_id,action,entity_type,entity_id,metadata) values(target.clinic_id,target.unit_id,auth.uid(),'holiday.operation_authorized','class_occurrence',target.id,jsonb_build_object('reason',trim(p_reason)));
 return target;
end $$;
revoke all on function public.reschedule_class_occurrence(uuid,date,time,time,uuid,uuid,text),public.reopen_holiday_occurrence(uuid,text) from public,anon;
grant execute on function public.reschedule_class_occurrence(uuid,date,time,time,uuid,uuid,text),public.reopen_holiday_occurrence(uuid,text) to authenticated;


-- SECTION transactional_users_and_audit
create function public.save_clinic_user(p_id uuid,p_input jsonb,p_create boolean default false) returns public.profiles
language plpgsql security definer set search_path='' as $$
declare target public.profiles; u uuid; permitted record; owner uuid;
begin
 if public.current_role()<>'admin' then raise exception 'FORBIDDEN'; end if;
 if p_input is null or jsonb_typeof(p_input)<>'object' or exists(select 1 from jsonb_object_keys(p_input) k where k not in('name','role','status','unitIds','permissions')) then raise exception 'INVALID_USER_INPUT'; end if;
 select owner_profile_id into owner from public.clinics where id=public.current_clinic_id();
 if p_id=owner and ((p_input?'role' and p_input->>'role'<>'admin') or (p_input?'status' and p_input->>'status'<>'active') or p_input?'unitIds') then raise exception 'PROTECTED_OWNER_ACCOUNT'; end if;
 if p_create then
  insert into public.profiles(id,clinic_id,name,role,status) values(p_id,public.current_clinic_id(),p_input->>'name',(p_input->>'role')::public.user_role,'invited') returning * into target;
 else
  select * into target from public.profiles where id=p_id and clinic_id=public.current_clinic_id() and deleted_at is null for update;
  if target.id is null then raise exception 'USER_NOT_FOUND'; end if;
  update public.profiles set name=coalesce(p_input->>'name',name),role=coalesce((p_input->>'role')::public.user_role,role),status=coalesce((p_input->>'status')::public.member_status,status),updated_at=now() where id=p_id returning * into target;
 end if;
 if p_input?'unitIds' then
  for u in select jsonb_array_elements_text(p_input->'unitIds')::uuid loop
   if not public.has_unit_access(u) or not exists(select 1 from public.units where id=u and clinic_id=target.clinic_id and deleted_at is null) then raise exception 'UNIT_FORBIDDEN'; end if;
  end loop;
  delete from public.profile_units where profile_id=p_id;
  insert into public.profile_units(profile_id,unit_id) select p_id,jsonb_array_elements_text(p_input->'unitIds')::uuid;
 end if;
 if p_input?'permissions' then
  for permitted in select key,value from jsonb_each(p_input->'permissions') loop
   if permitted.key not in('dashboard','agenda','patients','enrollments','records','finance','reports','imports','users','settings','privacy') or jsonb_typeof(permitted.value)<>'object' then raise exception 'INVALID_USER_PERMISSIONS'; end if;
   insert into public.profile_permissions(profile_id,module,can_view,can_edit) values(p_id,permitted.key,coalesce((permitted.value->>'canView')::boolean,false),coalesce((permitted.value->>'canEdit')::boolean,false))
   on conflict(profile_id,module) do update set can_view=excluded.can_view,can_edit=excluded.can_edit,updated_at=now();
  end loop;
 end if;
 insert into public.audit_events(clinic_id,user_id,action,entity_type,entity_id) values(target.clinic_id,auth.uid(),case when p_create then 'user.invited' else 'user.updated' end,'profile',p_id);
 return target;
end $$;
revoke all on function public.save_clinic_user(uuid,jsonb,boolean) from public,anon;
grant execute on function public.save_clinic_user(uuid,jsonb,boolean) to authenticated;

-- Domain changes and their minimal audit record share the database transaction.
-- No clinical payload, contact information, financial secret or raw diff is logged.
create function public.audit_operational_change() returns trigger language plpgsql security definer set search_path='' as $$
declare before_value jsonb; after_value jsonb; scope uuid;
begin
 if auth.uid() is null then return new; end if;
 before_value:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
 after_value:=to_jsonb(new);scope:=nullif(after_value->>'unit_id','')::uuid;
 insert into public.audit_events(clinic_id,unit_id,user_id,action,entity_type,entity_id,metadata)
 values(new.clinic_id,scope,auth.uid(),tg_table_name||'.persisted',tg_table_name,new.id,
 jsonb_strip_nulls(jsonb_build_object('operation',tg_op,'before_status',before_value->>'status','after_status',after_value->>'status','before_start',coalesce(before_value->>'start_at',before_value->>'effective_from'),'after_start',coalesce(after_value->>'start_at',after_value->>'effective_from'),'before_end',coalesce(before_value->>'end_at',before_value->>'effective_to'),'after_end',coalesce(after_value->>'end_at',after_value->>'effective_to'),'before_professional',before_value->>'actual_professional_id','after_professional',after_value->>'actual_professional_id')));
 return new;
end $$;
revoke all on function public.audit_operational_change() from public,anon,authenticated;
do $$ declare t text; begin foreach t in array array['classes','class_schedules','class_memberships','class_occurrences','occurrence_participants','patients','clinical_records','attachments'] loop
 execute format('create trigger operational_audit after insert or update on public.%I for each row execute function public.audit_operational_change()',t);
end loop; end $$;


-- SECTION internal_notifications_and_policy
-- Extend the existing notification log; clinical content is never copied here.
alter table public.notifications drop constraint notifications_channel_check;
alter table public.notifications add constraint notifications_channel_check check(channel in('whatsapp','email','internal'));
alter table public.notifications add column recipient_profile_id uuid references public.profiles(id),add column read_at timestamptz;
create index notifications_internal_recipient on public.notifications(recipient_profile_id,scheduled_at desc) where channel='internal';
create policy notifications_internal_select on public.notifications for select to authenticated using(clinic_id=public.current_clinic_id() and channel='internal' and recipient_profile_id=auth.uid() and public.has_agenda_permission(false));
create policy notifications_internal_insert_guard on public.notifications as restrictive for insert to authenticated with check(channel<>'internal');
create policy notifications_internal_update_guard on public.notifications as restrictive for update to authenticated using(channel<>'internal') with check(channel<>'internal');
create function public.set_notification_read(p_id uuid,p_read boolean) returns public.notifications
language plpgsql security definer set search_path='' as $$ declare result public.notifications; begin
 if not public.has_agenda_permission(false) then raise exception 'FORBIDDEN'; end if;
 update public.notifications set read_at=case when p_read then now() else null end,updated_at=now() where id=p_id and clinic_id=public.current_clinic_id() and channel='internal' and recipient_profile_id=auth.uid() returning * into result;
 if result.id is null then raise exception 'NOTIFICATION_NOT_FOUND'; end if;return result;
end $$;
create function public.notify_occurrence_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or row(new.start_at,new.end_at,new.status,new.actual_professional_id) is not distinct from row(old.start_at,old.end_at,old.status,old.actual_professional_id) then return new; end if;
 insert into public.notifications(clinic_id,channel,template_key,payload,scheduled_at,recipient_profile_id)
 select new.clinic_id,'internal','agenda.'||case when new.status='cancelled' then 'cancelled' when old.status='cancelled' then 'reopened' when new.actual_professional_id is distinct from old.actual_professional_id then 'substituted' else 'rescheduled' end,
 jsonb_build_object('occurrence_id',new.id,'unit_id',new.unit_id,'start_at',new.start_at,'status',new.status),now(),p.id
 from public.profiles p where p.clinic_id=new.clinic_id and p.status='active' and p.deleted_at is null
 and (p.role='admin' or exists(select 1 from public.profile_permissions pp where pp.profile_id=p.id and pp.module='agenda' and pp.can_view))
 and ((p.role in('admin','manager','reception') and (p.role='admin' or exists(select 1 from public.profile_units pu where pu.profile_id=p.id and pu.unit_id=new.unit_id)))
 or exists(select 1 from public.professionals pro where pro.profile_id=p.id and pro.id in(new.planned_professional_id,new.actual_professional_id,old.actual_professional_id)));
 return new;
end $$;
create trigger occurrence_notifications after update on public.class_occurrences for each row execute function public.notify_occurrence_change();
revoke all on function public.notify_occurrence_change() from public,anon,authenticated;
revoke all on function public.set_notification_read(uuid,boolean) from public,anon;
grant execute on function public.set_notification_read(uuid,boolean) to authenticated;
create function public.set_makeup_policy(p_policy jsonb,p_plan uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not public.has_role(array['admin','manager']::public.user_role[]) or not public.has_module_permission('settings',false) or not public.has_module_permission('settings',true) then raise exception 'FORBIDDEN'; end if;
 if p_policy is not null and (jsonb_typeof(p_policy)<>'object' or exists(select 1 from jsonb_object_keys(p_policy) k where k not in('eligible_statuses','no_show_action')) or jsonb_typeof(p_policy->'eligible_statuses') is distinct from 'array' or exists(select 1 from jsonb_array_elements_text(p_policy->'eligible_statuses') s where s not in('ABSENT_JUSTIFIED','ABSENT_UNJUSTIFIED','CANCELLED_IN_ADVANCE','CANCELLED_LATE')) or (p_policy->>'no_show_action') is null or (p_policy->>'no_show_action') not in('return','forfeit','review')) then raise exception 'INVALID_MAKEUP_POLICY'; end if;
 if p_plan is null then update public.clinics set makeup_policy=p_policy where id=public.current_clinic_id();
 else update public.plans set makeup_policy=p_policy where id=p_plan and clinic_id=public.current_clinic_id() and deleted_at is null;
 if not found then raise exception 'PLAN_NOT_FOUND'; end if;end if;
 insert into public.audit_events(clinic_id,user_id,action,entity_type,entity_id,metadata) values(public.current_clinic_id(),auth.uid(),'makeup.policy_updated',case when p_plan is null then 'clinic' else 'plan' end,coalesce(p_plan,public.current_clinic_id()),jsonb_build_object('policy',p_policy));
 return p_policy;
end $$;
create function public.get_makeup_policy() returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
 if not public.has_role(array['admin','manager']::public.user_role[]) or not public.has_module_permission('settings',false) then raise exception 'FORBIDDEN'; end if;
 return (select makeup_policy from public.clinics where id=public.current_clinic_id());end $$;
revoke all on function public.set_makeup_policy(jsonb,uuid),public.get_makeup_policy() from public,anon;
grant execute on function public.set_makeup_policy(jsonb,uuid),public.get_makeup_policy() to authenticated;


-- SECTION clinical_reference_integrity
-- Clinical links must agree at the database boundary as well as in HTTP schemas.
create function public.clinical_reference_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare template public.record_templates;
begin
 if auth.uid() is null then return new; end if;
 if not public.has_module_permission('records',false) or not public.has_module_permission('records',true) or new.clinic_id<>public.current_clinic_id() then raise exception 'FORBIDDEN'; end if;
 if not exists(select 1 from public.patients p where p.id=new.patient_id and p.clinic_id=new.clinic_id and p.deleted_at is null and public.can_access_patient(p.id)) then raise exception 'PATIENT_NOT_FOUND'; end if;
 if not public.has_unit_access(new.unit_id) and not(public.current_role()='professional' and public.can_view_agenda_unit(new.unit_id)) then raise exception 'UNIT_FORBIDDEN'; end if;
 if not exists(select 1 from public.units u where u.id=new.unit_id and u.clinic_id=new.clinic_id) or not exists(select 1 from public.professionals p where p.id=new.professional_id and p.clinic_id=new.clinic_id and p.deleted_at is null) then raise exception 'INVALID_CLINICAL_SCOPE'; end if;
 if public.current_role()='professional' and new.professional_id is distinct from public.current_professional_id() then raise exception 'FORBIDDEN'; end if;
 if new.appointment_id is not null and not exists(select 1 from public.appointments a where a.id=new.appointment_id and a.clinic_id=new.clinic_id and a.patient_id=new.patient_id and a.professional_id=new.professional_id and a.unit_id=new.unit_id) then raise exception 'INVALID_APPOINTMENT_SCOPE'; end if;
 if new.template_id is not null then
  select * into template from public.record_templates where id=new.template_id and clinic_id=new.clinic_id;
  if template.id is null then raise exception 'INVALID_RECORD_TEMPLATE'; end if;
  if tg_op='INSERT' and not template.active then raise exception 'INVALID_RECORD_TEMPLATE'; end if;
  if new.template_version is null then new.template_version:=template.version; end if;
 end if;
 if new.rectifies_id is not null and not exists(select 1 from public.clinical_records c where c.id=new.rectifies_id and c.clinic_id=new.clinic_id and c.patient_id=new.patient_id and c.professional_id=new.professional_id and c.status='signed') then raise exception 'INVALID_CLINICAL_RECTIFICATION'; end if;
 return new;
end $$;
create trigger clinical_reference_guard before insert or update on public.clinical_records for each row execute function public.clinical_reference_guard();
revoke all on function public.clinical_reference_guard() from public,anon,authenticated;

create or replace function public.current_professional_id() returns uuid language sql stable security definer set search_path='' as $$
 select case when count(*)=1 then min(p.id::text)::uuid else null end from public.professionals p where p.profile_id=auth.uid() and p.clinic_id=public.current_clinic_id() and p.active and p.deleted_at is null
$$;

-- Known object paths must not bypass the module gate on attachment metadata.
create policy operational_files_read on storage.objects as restrictive for select to authenticated using(
 case bucket_id when 'clinical-files' then public.has_module_permission('records',false)
 when 'financial-files' then public.has_module_permission('finance',false) else true end
);
create policy operational_files_insert on storage.objects as restrictive for insert to authenticated with check(
 case bucket_id when 'clinical-files' then public.has_module_permission('records',false) and public.has_module_permission('records',true)
 when 'financial-files' then public.has_module_permission('finance',false) and public.has_module_permission('finance',true) else true end
);
-- Physical clinical objects are retained; the API performs metadata soft deletion.
create policy operational_files_delete on storage.objects as restrictive for delete to authenticated using(
 bucket_id<>'clinical-files' and (bucket_id<>'financial-files' or (public.has_module_permission('finance',false) and public.has_module_permission('finance',true)))
);


-- Acquire the clinic lock before row locks in the previously published mutation
-- RPCs as well. This prevents lock inversion with attendance/makeup/schedule RPCs.
do $locks$ declare signature text; definition text; begin
 foreach signature in array array[
 'public.create_class_schedule(uuid,date,public.class_weekday[],time,time,text,uuid,integer,uuid)',
 'public.change_class_schedule_from_date(uuid,date,public.class_weekday[],time,time,text,uuid,integer,uuid)',
 'public.cancel_class_occurrence(uuid)'
 ] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if position(E'\nbegin\n' in definition)=0 then raise exception 'UNEXPECTED_AGENDA_RPC_DEFINITION';end if;
  definition:=regexp_replace(definition,E'\nbegin\n',E'\nbegin\n  perform public.lock_agenda_clinic(public.current_clinic_id());\n');
  execute definition;
 end loop;
end $locks$;
