-- A recepção executa o fluxo operacional de matrícula, sem ganhar leitura do financeiro.
update public.profile_permissions permission
   set can_view = true,
       can_edit = true,
       updated_at = now()
  from public.profiles profile
 where profile.id = permission.profile_id
   and profile.role = 'reception'
   and permission.module = 'enrollments'
   and permission.can_view = true
   and permission.can_edit = false;

drop policy if exists enrollments_write on public.enrollments;
create policy enrollments_write on public.enrollments for all
using (
  clinic_id = public.current_clinic_id()
  and public.has_unit_access(unit_id)
  and public.has_role(array['admin','manager','reception','finance']::public.user_role[])
)
with check (
  clinic_id = public.current_clinic_id()
  and public.has_unit_access(unit_id)
  and public.has_role(array['admin','manager','reception','finance']::public.user_role[])
);

-- A matrícula gera uma cobrança automaticamente. A recepção pode inseri-la,
-- mas continua sem permissão para consultar, alterar ou excluir dados financeiros.
drop policy if exists charges_access on public.charges;
create policy charges_select on public.charges for select
using (
  clinic_id = public.current_clinic_id()
  and public.has_unit_access(unit_id)
  and public.has_role(array['admin','manager','finance']::public.user_role[])
);
create policy charges_insert on public.charges for insert
with check (
  clinic_id = public.current_clinic_id()
  and public.has_unit_access(unit_id)
  and public.has_role(array['admin','manager','reception','finance']::public.user_role[])
  and enrollment_id is not null
  and exists (
    select 1
      from public.enrollments enrollment
     where enrollment.id = charges.enrollment_id
       and enrollment.clinic_id = charges.clinic_id
       and enrollment.unit_id = charges.unit_id
       and enrollment.patient_id = charges.patient_id
       and enrollment.status = 'active'
       and enrollment.deleted_at is null
  )
);
create policy charges_update on public.charges for update
using (
  clinic_id = public.current_clinic_id()
  and public.has_unit_access(unit_id)
  and public.has_role(array['admin','manager','finance']::public.user_role[])
)
with check (
  clinic_id = public.current_clinic_id()
  and public.has_unit_access(unit_id)
  and public.has_role(array['admin','manager','finance']::public.user_role[])
);
create policy charges_delete on public.charges for delete
using (
  clinic_id = public.current_clinic_id()
  and public.has_unit_access(unit_id)
  and public.has_role(array['admin','manager','finance']::public.user_role[])
);
