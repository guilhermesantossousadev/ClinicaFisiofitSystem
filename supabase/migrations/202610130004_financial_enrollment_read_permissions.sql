-- Grant only the reads required by the authenticated enrollment/finance API.
-- Row security remains responsible for clinic, unit, role, and module scope.

grant select on public.enrollments to authenticated;
-- Keep the normal authenticated table grant for roles that already pass
-- patients_select; finance is excluded from that row policy. Column grants
-- cannot vary by profile because every signed-in user uses role authenticated.
revoke select on public.patients from public, anon, authenticated;
grant select on public.patients to authenticated;
grant select on public.plans to authenticated;
grant select (id, clinic_id, deleted_at)
  on public.units to authenticated;

drop policy if exists patients_financial_enrollment_summary_select on public.patients;

-- Return only an enrollment-linked patient name to finance. Direct table reads
-- remain denied by patients_select/can_access_patient for the finance role.
create or replace function public.financial_enrollment_patient_summaries(
  p_patient_ids uuid[]
) returns table (id uuid, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name
    from public.patients p
   where p_patient_ids is not null
     and p.id = any(p_patient_ids)
     and p.clinic_id = public.current_clinic_id()
     and p.deleted_at is null
     and public.current_role() = 'finance'
     and public.has_module_permission('enrollments', false)
     and public.has_unit_access(p.primary_unit_id)
     and exists (
       select 1
         from public.enrollments e
        where e.patient_id = p.id
          and e.clinic_id = p.clinic_id
          and e.deleted_at is null
          and public.has_unit_access(e.unit_id)
     )
$$;

revoke all on function public.financial_enrollment_patient_summaries(uuid[])
  from public, anon, authenticated;
grant execute on function public.financial_enrollment_patient_summaries(uuid[])
  to authenticated;

-- Apply module permission as an additional AND condition so the existing
-- broad write policies cannot accidentally expose rows to direct API reads.
create policy enrollments_module_read_scope
  on public.enrollments as restrictive for select to authenticated
using (public.has_module_permission('enrollments', false));

create policy plans_module_read_scope
  on public.plans as restrictive for select to authenticated
using (public.has_module_permission('enrollments', false));
