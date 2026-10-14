-- Narrow read access required by the authenticated API; RLS remains the
-- boundary for profiles, permissions, clinics, and units.
grant select (id, clinic_id, name, role, status, deleted_at)
  on public.profiles to authenticated;
grant select (profile_id, module, can_view, can_edit)
  on public.profile_permissions to authenticated;
grant select on public.charges to authenticated;

drop policy if exists charges_select on public.charges;
create policy charges_select on public.charges for select
using (
  clinic_id = public.current_clinic_id()
  and public.has_unit_access(unit_id)
  and public.has_role(array['admin','manager','finance']::public.user_role[])
  and public.has_module_permission('enrollments', false)
);

-- Validate only the financial relationship. This deliberately returns a
-- boolean and does not grant finance users access to patient records.
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
           and e.status = 'active'
      )
    ), false)
$$;

revoke all on function public.can_create_financial_charge(uuid, uuid, uuid)
  from public, anon;
grant execute on function public.can_create_financial_charge(uuid, uuid, uuid)
  to authenticated;
