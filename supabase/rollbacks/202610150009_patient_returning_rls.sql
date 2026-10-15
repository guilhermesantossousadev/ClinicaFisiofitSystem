-- Explicit rollback only; never included in the forward migration directory.
-- Restores the previous policy without changing or deleting clinical data.
-- This also restores the known INSERT ... RETURNING failure.
begin;
alter policy patients_module_select on public.patients
using (public.can_access_patient(id));
commit;
