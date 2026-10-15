-- INSERT ... RETURNING checks SELECT policies against the proposed tuple before
-- inserting it. can_access_patient(id) queries patients, so it cannot find that
-- tuple yet (changing function volatility does not solve this).
-- Evaluate the existing administrative primary-unit access rule on the tuple.
-- Keep can_access_patient for existing relationship-based/professional access.
-- No INSERT/UPDATE checks, grants, helper functions or RLS settings are changed.
alter policy patients_module_select on public.patients
using (
  public.can_access_patient(id)
  or (
    clinic_id = public.current_clinic_id()
    and deleted_at is null
    and public.has_module_permission('patients', false)
    and public.has_role(array['admin', 'manager', 'reception']::public.user_role[])
    and public.has_unit_access(primary_unit_id)
  )
);
