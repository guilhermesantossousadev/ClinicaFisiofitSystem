-- Fase 1: autorização fail-closed por clínica, papel e unidade.
-- Esta migração é corretiva: não altere migrations já aplicadas em produção.

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
    from public.profiles p
   where p.id = auth.uid()
     and p.status = 'active'
     and p.deleted_at is null
   limit 1
$$;

create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = ''
as $$
  select p.*
    from public.profiles p
   where p.id = auth.uid()
     and p.status = 'active'
     and p.deleted_at is null
   limit 1
$$;

create or replace function public.current_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.clinic_id
    from public.profiles p
   where p.id = auth.uid()
     and p.status = 'active'
     and p.deleted_at is null
   limit 1
$$;

create or replace function public.has_role(allowed public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_role() = any(allowed), false)
$$;

create or replace function public.has_unit_access(target_unit uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.profiles p
      join public.units u on u.id = target_unit
     where p.id = auth.uid()
       and p.status = 'active'
       and p.deleted_at is null
       and u.clinic_id = p.clinic_id
       and u.deleted_at is null
       and (
         p.role = 'admin'
         or exists (
           select 1
             from public.profile_units pu
            where pu.profile_id = p.id
              and pu.unit_id = u.id
         )
       )
  )
$$;

create or replace function public.same_clinic_profile(target_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = target_profile
       and p.clinic_id = public.current_clinic_id()
  )
$$;

create or replace function public.same_clinic_professional(target_professional uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.professionals p
     where p.id = target_professional
       and p.clinic_id = public.current_clinic_id()
       and p.deleted_at is null
  )
$$;

create or replace function public.current_professional_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
    from public.professionals p
   where p.profile_id = auth.uid()
     and p.clinic_id = public.current_clinic_id()
     and p.active
     and p.deleted_at is null
   limit 1
$$;

create or replace function public.can_access_professional(target_professional uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.professionals p
     where p.id = target_professional
       and p.clinic_id = public.current_clinic_id()
       and p.deleted_at is null
       and (
         public.current_role() = 'admin'
         or p.profile_id = auth.uid()
         or exists (
           select 1
             from public.professional_units pu
            where pu.professional_id = p.id
              and public.has_unit_access(pu.unit_id)
         )
       )
  )
$$;

create or replace function public.can_access_patient(target_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.patients p
     where p.id = target_patient
       and p.clinic_id = public.current_clinic_id()
       and p.deleted_at is null
       and (
         (
           public.has_role(array['admin','manager','reception']::public.user_role[])
           and public.has_unit_access(p.primary_unit_id)
         )
         or (
           public.current_role() = 'professional'
           and exists (
             select 1
               from public.appointments a
              where a.patient_id = p.id
                and a.professional_id = public.current_professional_id()
                and a.clinic_id = p.clinic_id
                and a.deleted_at is null
                and public.has_unit_access(a.unit_id)
           )
         )
       )
  )
$$;

create or replace function public.can_access_appointment(target_appointment uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.appointments a
     where a.id = target_appointment
       and a.clinic_id = public.current_clinic_id()
       and a.deleted_at is null
       and public.has_unit_access(a.unit_id)
       and (
         public.has_role(array['admin','manager','reception']::public.user_role[])
         or (
           public.current_role() = 'professional'
           and a.professional_id = public.current_professional_id()
         )
       )
  )
$$;

create or replace function public.can_access_charge(target_charge uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.charges c
     where c.id = target_charge
       and c.clinic_id = public.current_clinic_id()
       and c.deleted_at is null
       and public.has_unit_access(c.unit_id)
       and public.has_role(array['admin','manager','finance']::public.user_role[])
  )
$$;

create or replace function public.can_access_group_slot(target_slot uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.group_slots gs
     where gs.id = target_slot
       and gs.clinic_id = public.current_clinic_id()
       and gs.deleted_at is null
       and public.has_unit_access(gs.unit_id)
       and public.has_role(array['admin','manager','reception','professional']::public.user_role[])
  )
$$;

create or replace function public.has_module_permission(target_module text, edit_access boolean default false)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.current_role() = 'admin' then true
    else exists (
      select 1
        from public.profile_permissions pp
       where pp.profile_id = auth.uid()
         and pp.module = target_module
         and case when edit_access then pp.can_edit else pp.can_view end
    )
  end
$$;

create or replace function public.bootstrap_available()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and not exists (select 1 from public.clinics)
$$;

-- Corrige permissões existentes antes de ativar default deny na API.
insert into public.profile_permissions(profile_id, module, can_view, can_edit)
select p.id, permission.module, permission.can_view, permission.can_edit
  from public.profiles p
  cross join lateral (
    values
      ('dashboard', p.role in ('manager'), p.role in ('manager')),
      ('agenda', p.role in ('manager','reception','professional'), p.role in ('manager','reception','professional')),
      ('patients', p.role in ('manager','reception','professional'), p.role in ('manager','reception')),
      ('enrollments', p.role in ('manager','reception','finance'), p.role in ('manager','finance')),
      ('records', p.role in ('manager','professional'), p.role in ('manager','professional')),
      ('finance', p.role in ('manager','finance'), p.role in ('manager','finance')),
      ('reports', p.role in ('manager','finance'), false),
      ('imports', p.role in ('manager'), p.role in ('manager')),
      ('users', p.role in ('manager'), false),
      ('settings', p.role in ('manager'), p.role in ('manager')),
      ('privacy', p.role in ('manager'), p.role in ('manager'))
  ) as permission(module, can_view, can_edit)
 where p.role <> 'admin'
on conflict (profile_id, module) do nothing;

-- Remove as políticas permissivas anteriores.
drop policy if exists clinic_isolation on public.clinics;
drop policy if exists profiles_self_or_admin on public.profiles;
drop policy if exists units_member_select on public.units;
drop policy if exists profile_units_member_select on public.profile_units;
drop policy if exists appointments_unit_write on public.appointments;
drop policy if exists patients_unit_write on public.patients;
drop policy if exists clinical_professional_write on public.clinical_records;
drop policy if exists finance_write on public.financial_entries;
drop policy if exists profile_permissions_read on public.profile_permissions;
drop policy if exists profile_permissions_admin_write on public.profile_permissions;
drop policy if exists data_subject_requests_clinic_access on public.data_subject_requests;
drop policy if exists privacy_incidents_clinic_access on public.privacy_incidents;
drop policy if exists migration_items_select on public.migration_items;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'rooms','professionals','patients','responsibles','consents','services','plans','group_slots',
    'enrollments','group_slot_memberships','appointments','record_templates','clinical_records',
    'charges','payments','financial_entries','commissions','monthly_closings','attachments',
    'fiscal_documents','notifications','import_batches','audit_events'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_clinic_select', table_name);
  end loop;
end $$;

-- Clínica, perfis e unidades.
create policy clinics_select on public.clinics for select
using (id = public.current_clinic_id());
create policy clinics_admin_update on public.clinics for update
using (id = public.current_clinic_id() and public.current_role() = 'admin')
with check (id = public.current_clinic_id() and public.current_role() = 'admin');

create policy profiles_select on public.profiles for select
using (
  id = auth.uid()
  or (clinic_id = public.current_clinic_id() and public.has_role(array['admin','manager']::public.user_role[]))
);
create policy profiles_admin_write on public.profiles for all
using (clinic_id = public.current_clinic_id() and public.current_role() = 'admin')
with check (clinic_id = public.current_clinic_id() and public.current_role() = 'admin');

create policy units_select on public.units for select
using (clinic_id = public.current_clinic_id() and public.has_unit_access(id));
create policy units_admin_write on public.units for all
using (clinic_id = public.current_clinic_id() and public.current_role() = 'admin')
with check (clinic_id = public.current_clinic_id() and public.current_role() = 'admin');

create policy profile_units_select on public.profile_units for select
using (
  profile_id = auth.uid()
  or (
    public.has_role(array['admin','manager']::public.user_role[])
    and public.same_clinic_profile(profile_id)
  )
);
create policy profile_units_admin_write on public.profile_units for all
using (public.current_role() = 'admin' and public.same_clinic_profile(profile_id))
with check (
  public.current_role() = 'admin'
  and public.same_clinic_profile(profile_id)
  and public.has_unit_access(unit_id)
);

create policy profile_permissions_select on public.profile_permissions for select
using (
  profile_id = auth.uid()
  or (
    public.has_role(array['admin','manager']::public.user_role[])
    and public.same_clinic_profile(profile_id)
  )
);
create policy profile_permissions_admin_write on public.profile_permissions for all
using (public.current_role() = 'admin' and public.same_clinic_profile(profile_id))
with check (public.current_role() = 'admin' and public.same_clinic_profile(profile_id));

-- Cadastros operacionais.
create policy rooms_select on public.rooms for select
using (
  clinic_id = public.current_clinic_id()
  and public.has_unit_access(unit_id)
  and public.has_role(array['admin','manager','reception','professional']::public.user_role[])
);
create policy rooms_write on public.rooms for all
using (clinic_id = public.current_clinic_id() and public.has_unit_access(unit_id) and public.has_role(array['admin','manager']::public.user_role[]))
with check (clinic_id = public.current_clinic_id() and public.has_unit_access(unit_id) and public.has_role(array['admin','manager']::public.user_role[]));

create policy professionals_select on public.professionals for select
using (
  clinic_id = public.current_clinic_id()
  and public.has_role(array['admin','manager','reception','professional','finance']::public.user_role[])
  and public.can_access_professional(id)
);
create policy professionals_write on public.professionals for all
using (clinic_id = public.current_clinic_id() and public.has_role(array['admin','manager']::public.user_role[]))
with check (clinic_id = public.current_clinic_id() and public.has_role(array['admin','manager']::public.user_role[]));

create policy professional_units_select on public.professional_units for select
using (public.same_clinic_professional(professional_id) and public.has_unit_access(unit_id));
create policy professional_units_write on public.professional_units for all
using (public.same_clinic_professional(professional_id) and public.has_unit_access(unit_id) and public.has_role(array['admin','manager']::public.user_role[]))
with check (public.same_clinic_professional(professional_id) and public.has_unit_access(unit_id) and public.has_role(array['admin','manager']::public.user_role[]));

create policy services_select on public.services for select
using (clinic_id = public.current_clinic_id() and public.has_role(array['admin','manager','reception','professional']::public.user_role[]));
create policy services_write on public.services for all
using (clinic_id = public.current_clinic_id() and public.has_role(array['admin','manager']::public.user_role[]))
with check (clinic_id = public.current_clinic_id() and public.has_role(array['admin','manager']::public.user_role[]));

create policy plans_select on public.plans for select
using (clinic_id = public.current_clinic_id() and public.has_role(array['admin','manager','reception','finance']::public.user_role[]));
create policy plans_write on public.plans for all
using (clinic_id = public.current_clinic_id() and public.has_role(array['admin','manager','finance']::public.user_role[]))
with check (clinic_id = public.current_clinic_id() and public.has_role(array['admin','manager','finance']::public.user_role[]));

create policy record_templates_select on public.record_templates for select
using (clinic_id = public.current_clinic_id() and public.has_role(array['admin','manager','professional']::public.user_role[]));
create policy record_templates_write on public.record_templates for all
using (clinic_id = public.current_clinic_id() and public.has_role(array['admin','manager']::public.user_role[]))
with check (clinic_id = public.current_clinic_id() and public.has_role(array['admin','manager']::public.user_role[]));

-- Pacientes e agenda.
create policy patients_select on public.patients for select
using (clinic_id = public.current_clinic_id() and public.can_access_patient(id));
create policy patients_write on public.patients for all
using (
  clinic_id = public.current_clinic_id()
  and public.has_unit_access(primary_unit_id)
  and public.has_role(array['admin','manager','reception']::public.user_role[])
)
with check (
  clinic_id = public.current_clinic_id()
  and public.has_unit_access(primary_unit_id)
  and public.has_role(array['admin','manager','reception']::public.user_role[])
);

create policy responsibles_select on public.responsibles for select
using (clinic_id = public.current_clinic_id() and public.can_access_patient(patient_id));
create policy responsibles_write on public.responsibles for all
using (clinic_id = public.current_clinic_id() and public.can_access_patient(patient_id) and public.has_role(array['admin','manager','reception']::public.user_role[]))
with check (clinic_id = public.current_clinic_id() and public.can_access_patient(patient_id) and public.has_role(array['admin','manager','reception']::public.user_role[]));

create policy consents_select on public.consents for select
using (clinic_id = public.current_clinic_id() and public.can_access_patient(patient_id));
create policy consents_write on public.consents for all
using (clinic_id = public.current_clinic_id() and public.can_access_patient(patient_id) and public.has_role(array['admin','manager','reception']::public.user_role[]))
with check (clinic_id = public.current_clinic_id() and public.can_access_patient(patient_id) and public.has_role(array['admin','manager','reception']::public.user_role[]));

create policy group_slots_select on public.group_slots for select
using (
  clinic_id = public.current_clinic_id()
  and public.has_unit_access(unit_id)
  and public.has_role(array['admin','manager','reception','professional']::public.user_role[])
);
create policy group_slots_write on public.group_slots for all
using (clinic_id = public.current_clinic_id() and public.has_unit_access(unit_id) and public.has_role(array['admin','manager','reception']::public.user_role[]))
with check (clinic_id = public.current_clinic_id() and public.has_unit_access(unit_id) and public.has_role(array['admin','manager','reception']::public.user_role[]));

create policy group_slot_memberships_select on public.group_slot_memberships for select
using (clinic_id = public.current_clinic_id() and public.can_access_group_slot(group_slot_id));
create policy group_slot_memberships_write on public.group_slot_memberships for all
using (clinic_id = public.current_clinic_id() and public.can_access_group_slot(group_slot_id) and public.has_role(array['admin','manager','reception']::public.user_role[]))
with check (clinic_id = public.current_clinic_id() and public.can_access_group_slot(group_slot_id) and public.has_role(array['admin','manager','reception']::public.user_role[]));

create policy appointments_select on public.appointments for select
using (clinic_id = public.current_clinic_id() and public.can_access_appointment(id));
create policy appointments_insert on public.appointments for insert
with check (
  clinic_id = public.current_clinic_id()
  and public.has_unit_access(unit_id)
  and (
    public.has_role(array['admin','manager','reception']::public.user_role[])
    or (public.current_role() = 'professional' and professional_id = public.current_professional_id())
  )
);
create policy appointments_update on public.appointments for update
using (clinic_id = public.current_clinic_id() and public.can_access_appointment(id))
with check (
  clinic_id = public.current_clinic_id()
  and public.has_unit_access(unit_id)
  and (
    public.has_role(array['admin','manager','reception']::public.user_role[])
    or (public.current_role() = 'professional' and professional_id = public.current_professional_id())
  )
);

create policy enrollments_select on public.enrollments for select
using (
  clinic_id = public.current_clinic_id()
  and public.has_unit_access(unit_id)
  and public.has_role(array['admin','manager','reception','finance']::public.user_role[])
);
create policy enrollments_write on public.enrollments for all
using (clinic_id = public.current_clinic_id() and public.has_unit_access(unit_id) and public.has_role(array['admin','manager','finance']::public.user_role[]))
with check (clinic_id = public.current_clinic_id() and public.has_unit_access(unit_id) and public.has_role(array['admin','manager','finance']::public.user_role[]));

-- Prontuário: financeiro e recepção não possuem acesso.
create policy clinical_records_select on public.clinical_records for select
using (
  clinic_id = public.current_clinic_id()
  and public.has_unit_access(unit_id)
  and (
    public.has_role(array['admin','manager']::public.user_role[])
    or (public.current_role() = 'professional' and professional_id = public.current_professional_id())
  )
);
create policy clinical_records_write on public.clinical_records for all
using (
  clinic_id = public.current_clinic_id()
  and public.has_unit_access(unit_id)
  and (
    public.has_role(array['admin','manager']::public.user_role[])
    or (public.current_role() = 'professional' and professional_id = public.current_professional_id())
  )
)
with check (
  clinic_id = public.current_clinic_id()
  and public.has_unit_access(unit_id)
  and (
    public.has_role(array['admin','manager']::public.user_role[])
    or (public.current_role() = 'professional' and professional_id = public.current_professional_id())
  )
);

create policy attachments_select on public.attachments for select
using (
  clinic_id = public.current_clinic_id()
  and patient_id is not null
  and public.can_access_patient(patient_id)
  and public.has_role(array['admin','manager','professional','reception']::public.user_role[])
);
create policy attachments_write on public.attachments for all
using (
  clinic_id = public.current_clinic_id()
  and patient_id is not null
  and public.can_access_patient(patient_id)
  and public.has_role(array['admin','manager','professional','reception']::public.user_role[])
)
with check (
  clinic_id = public.current_clinic_id()
  and patient_id is not null
  and public.can_access_patient(patient_id)
  and uploaded_by = auth.uid()
  and public.has_role(array['admin','manager','professional','reception']::public.user_role[])
);

-- Financeiro: profissionais e recepção não possuem acesso direto.
create policy charges_access on public.charges for all
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

create policy payments_access on public.payments for all
using (clinic_id = public.current_clinic_id() and public.can_access_charge(charge_id))
with check (clinic_id = public.current_clinic_id() and public.can_access_charge(charge_id));

create policy financial_entries_access on public.financial_entries for all
using (clinic_id = public.current_clinic_id() and public.has_unit_access(unit_id) and public.has_role(array['admin','manager','finance']::public.user_role[]))
with check (clinic_id = public.current_clinic_id() and public.has_unit_access(unit_id) and public.has_role(array['admin','manager','finance']::public.user_role[]));

create policy commissions_access on public.commissions for all
using (clinic_id = public.current_clinic_id() and public.has_unit_access(unit_id) and public.has_role(array['admin','manager','finance']::public.user_role[]))
with check (clinic_id = public.current_clinic_id() and public.has_unit_access(unit_id) and public.has_role(array['admin','manager','finance']::public.user_role[]));

create policy monthly_closings_access on public.monthly_closings for all
using (
  clinic_id = public.current_clinic_id()
  and (unit_id is not null and public.has_unit_access(unit_id) or unit_id is null and public.current_role() = 'admin')
  and public.has_role(array['admin','manager','finance']::public.user_role[])
)
with check (
  clinic_id = public.current_clinic_id()
  and (unit_id is not null and public.has_unit_access(unit_id) or unit_id is null and public.current_role() = 'admin')
  and public.has_role(array['admin','manager','finance']::public.user_role[])
);

create policy fiscal_documents_access on public.fiscal_documents for all
using (
  clinic_id = public.current_clinic_id()
  and exists (select 1 from public.payments p where p.id = payment_id and public.can_access_charge(p.charge_id))
)
with check (
  clinic_id = public.current_clinic_id()
  and exists (select 1 from public.payments p where p.id = payment_id and public.can_access_charge(p.charge_id))
);

-- Administração, importação, privacidade e auditoria.
create policy notifications_access on public.notifications for all
using (
  clinic_id = public.current_clinic_id()
  and patient_id is not null
  and public.can_access_patient(patient_id)
  and public.has_role(array['admin','manager','reception']::public.user_role[])
)
with check (
  clinic_id = public.current_clinic_id()
  and patient_id is not null
  and public.can_access_patient(patient_id)
  and public.has_role(array['admin','manager','reception']::public.user_role[])
);

create policy import_batches_access on public.import_batches for all
using (clinic_id = public.current_clinic_id() and public.has_role(array['admin','manager']::public.user_role[]))
with check (clinic_id = public.current_clinic_id() and created_by = auth.uid() and public.has_role(array['admin','manager']::public.user_role[]));

create policy migration_items_access on public.migration_items for all
using (clinic_id = public.current_clinic_id() and public.has_role(array['admin','manager']::public.user_role[]))
with check (clinic_id = public.current_clinic_id() and public.has_role(array['admin','manager']::public.user_role[]));

create policy data_subject_requests_access on public.data_subject_requests for all
using (clinic_id = public.current_clinic_id() and public.has_role(array['admin','manager']::public.user_role[]))
with check (clinic_id = public.current_clinic_id() and public.has_role(array['admin','manager']::public.user_role[]));

create policy privacy_incidents_access on public.privacy_incidents for all
using (clinic_id = public.current_clinic_id() and public.current_role() = 'admin')
with check (clinic_id = public.current_clinic_id() and public.current_role() = 'admin');

create policy audit_events_select on public.audit_events for select
using (clinic_id = public.current_clinic_id() and public.has_role(array['admin','manager']::public.user_role[]));
create policy audit_events_insert on public.audit_events for insert
with check (
  clinic_id = public.current_clinic_id()
  and user_id = auth.uid()
  and (unit_id is null or public.has_unit_access(unit_id))
);

create or replace function public.try_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception when invalid_text_representation then
  return null;
end
$$;

drop policy if exists clinical_files_select on storage.objects;
drop policy if exists clinical_files_insert on storage.objects;
drop policy if exists clinical_files_delete on storage.objects;
drop policy if exists financial_files_select on storage.objects;
drop policy if exists financial_files_insert on storage.objects;
drop policy if exists financial_files_delete on storage.objects;

create policy clinical_files_select on storage.objects for select to authenticated
using (
  bucket_id = 'clinical-files'
  and (storage.foldername(name))[1] = public.current_clinic_id()::text
  and public.can_access_patient(public.try_uuid((storage.foldername(name))[2]))
  and public.has_role(array['admin','manager','reception','professional']::public.user_role[])
);
create policy clinical_files_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'clinical-files'
  and (storage.foldername(name))[1] = public.current_clinic_id()::text
  and public.can_access_patient(public.try_uuid((storage.foldername(name))[2]))
  and public.has_role(array['admin','manager','reception','professional']::public.user_role[])
);
create policy clinical_files_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'clinical-files'
  and (storage.foldername(name))[1] = public.current_clinic_id()::text
  and public.can_access_patient(public.try_uuid((storage.foldername(name))[2]))
  and public.has_role(array['admin','manager','reception','professional']::public.user_role[])
);

create policy financial_files_select on storage.objects for select to authenticated
using (
  bucket_id = 'financial-files'
  and (storage.foldername(name))[1] = public.current_clinic_id()::text
  and public.has_role(array['admin','manager','finance']::public.user_role[])
);
create policy financial_files_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'financial-files'
  and (storage.foldername(name))[1] = public.current_clinic_id()::text
  and public.has_role(array['admin','manager','finance']::public.user_role[])
);
create policy financial_files_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'financial-files'
  and (storage.foldername(name))[1] = public.current_clinic_id()::text
  and public.has_role(array['admin','manager','finance']::public.user_role[])
);

-- RPCs sensíveis validam papel, unidade e proprietário internamente.
create or replace function public.check_appointment_conflict(
  p_unit_id uuid,
  p_professional_id uuid,
  p_room_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_exclude_id uuid default null,
  p_group_slot_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role(array['admin','manager','reception','professional']::public.user_role[])
     or not public.has_unit_access(p_unit_id) then
    raise exception 'FORBIDDEN';
  end if;
  if public.current_role() = 'professional' and p_professional_id is distinct from public.current_professional_id() then
    raise exception 'PROFESSIONAL_FORBIDDEN';
  end if;
  return jsonb_build_object(
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
       where gs.id = p_group_slot_id and gs.unit_id = p_unit_id
       group by gs.capacity
    ), false) end
  );
end
$$;

create or replace function public.complete_appointment(p_appointment_id uuid, p_request_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare result public.appointments;
begin
  if not public.has_role(array['admin','manager','professional']::public.user_role[]) then
    raise exception 'FORBIDDEN';
  end if;
  select * into result
    from public.appointments
   where id = p_appointment_id
     and clinic_id = public.current_clinic_id()
     and deleted_at is null
   for update;
  if result.id is null then raise exception 'APPOINTMENT_NOT_FOUND'; end if;
  if not public.has_unit_access(result.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
  if public.current_role() = 'professional' and result.professional_id is distinct from public.current_professional_id() then
    raise exception 'PROFESSIONAL_FORBIDDEN';
  end if;
  if result.status = 'completed' then return result; end if;
  update public.appointments
     set status = 'completed', session_consumed_at = coalesce(session_consumed_at, now()), updated_at = now()
   where id = result.id
   returning * into result;
  if result.enrollment_id is not null then
    update public.enrollments
       set sessions_used = sessions_used + 1, updated_at = now()
     where id = result.enrollment_id;
  end if;
  insert into public.audit_events(clinic_id, unit_id, user_id, action, entity_type, entity_id, request_id)
  values(result.clinic_id, result.unit_id, auth.uid(), 'appointment.completed', 'appointment', result.id, p_request_id);
  return result;
end
$$;

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
declare target public.charges; result public.payments;
begin
  if not public.has_role(array['admin','manager','finance']::public.user_role[]) then raise exception 'FORBIDDEN'; end if;
  select * into target from public.charges
   where id = p_charge_id and clinic_id = public.current_clinic_id() and deleted_at is null
   for update;
  if target.id is null then raise exception 'CHARGE_NOT_FOUND'; end if;
  if not public.has_unit_access(target.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
  select * into result from public.payments
   where clinic_id = target.clinic_id and idempotency_key = p_idempotency_key;
  if result.id is not null then return result; end if;
  if p_amount_cents <= 0 or target.paid_cents + p_amount_cents > target.amount_cents then raise exception 'INVALID_PAYMENT_AMOUNT'; end if;
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
end
$$;

create or replace function public.reverse_payment(p_payment_id uuid, p_reason text, p_request_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare target public.payments; charge_row public.charges; result public.payments;
begin
  if not public.has_role(array['admin','manager','finance']::public.user_role[]) then raise exception 'FORBIDDEN'; end if;
  if length(trim(p_reason)) < 10 then raise exception 'REVERSAL_REASON_REQUIRED'; end if;
  select * into target from public.payments where id = p_payment_id and clinic_id = public.current_clinic_id() for update;
  if target.id is null then raise exception 'PAYMENT_NOT_FOUND'; end if;
  select * into charge_row from public.charges where id = target.charge_id and clinic_id = target.clinic_id for update;
  if not public.has_unit_access(charge_row.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
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
end
$$;

create or replace function public.rollback_import_batch(p_batch_id uuid, p_reason text, p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare batch public.import_batches; item record; restored integer := 0;
begin
  if not public.has_role(array['admin','manager']::public.user_role[]) then raise exception 'FORBIDDEN'; end if;
  if length(trim(p_reason)) < 10 then raise exception 'ROLLBACK_REASON_REQUIRED'; end if;
  select * into batch from public.import_batches where id = p_batch_id and clinic_id = public.current_clinic_id() for update;
  if batch.id is null then raise exception 'IMPORT_BATCH_NOT_FOUND'; end if;
  if batch.rollback_at is not null then return jsonb_build_object('batch_id', batch.id, 'restored', 0, 'already_rolled_back', true); end if;
  for item in select * from public.migration_items where batch_id = batch.id and status = 'imported' and target_id is not null loop
    if item.target_table in ('units','rooms','professionals','services','plans','patients','enrollments','appointments','group_slots','charges','financial_entries','commissions','clinical_records','record_templates') then
      execute format('update public.%I set deleted_at = now(), updated_at = now() where id = $1 and clinic_id = $2 and deleted_at is null', item.target_table)
      using item.target_id, batch.clinic_id;
      if found then restored := restored + 1; end if;
      update public.migration_items set status = 'rejected', issue = 'Rollback: ' || trim(p_reason), updated_at = now() where id = item.id;
    end if;
  end loop;
  update public.import_batches set rollback_at = now(), rollback_reason = trim(p_reason), status = 'failed', updated_at = now() where id = batch.id;
  insert into public.audit_events(clinic_id, user_id, action, entity_type, entity_id, request_id, metadata)
  values(batch.clinic_id, auth.uid(), 'import.rolled_back', 'import_batch', batch.id, p_request_id, jsonb_build_object('reason', trim(p_reason), 'restored', restored));
  return jsonb_build_object('batch_id', batch.id, 'restored', restored, 'already_rolled_back', false);
end
$$;

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
  update public.group_slot_memberships set deleted_at = now(), updated_at = now() where enrollment_id = target.id and deleted_at is null;
  get diagnostics affected = row_count;
  update public.charges set deleted_at = now(), updated_at = now() where enrollment_id = target.id and clinic_id = target.clinic_id and paid_cents = 0 and deleted_at is null;
  update public.enrollments set deleted_at = now(), updated_at = now() where id = target.id;
  insert into public.audit_events(clinic_id, unit_id, user_id, action, entity_type, entity_id, request_id, metadata)
  values(target.clinic_id, target.unit_id, auth.uid(), 'enrollment.rolled_back', 'enrollment', target.id, p_request_id, jsonb_build_object('reason', trim(p_reason), 'memberships', affected));
  return jsonb_build_object('enrollment_id', target.id, 'memberships', affected);
end
$$;

-- Funções SECURITY DEFINER não ficam executáveis por PUBLIC/anon.
revoke execute on function public.current_role() from public, anon;
revoke execute on function public.current_profile() from public, anon;
revoke execute on function public.current_clinic_id() from public, anon;
revoke execute on function public.has_role(public.user_role[]) from public, anon;
revoke execute on function public.has_unit_access(uuid) from public, anon;
revoke execute on function public.same_clinic_profile(uuid) from public, anon;
revoke execute on function public.same_clinic_professional(uuid) from public, anon;
revoke execute on function public.current_professional_id() from public, anon;
revoke execute on function public.can_access_professional(uuid) from public, anon;
revoke execute on function public.can_access_patient(uuid) from public, anon;
revoke execute on function public.can_access_appointment(uuid) from public, anon;
revoke execute on function public.can_access_charge(uuid) from public, anon;
revoke execute on function public.can_access_group_slot(uuid) from public, anon;
revoke execute on function public.has_module_permission(text, boolean) from public, anon;
revoke execute on function public.bootstrap_available() from public, anon;
revoke execute on function public.bootstrap_clinic(text, text) from public, anon;
revoke execute on function public.check_appointment_conflict(uuid, uuid, uuid, timestamptz, timestamptz, uuid, uuid) from public, anon;
revoke execute on function public.complete_appointment(uuid, uuid) from public, anon;
revoke execute on function public.register_payment(uuid, integer, text, timestamptz, text, uuid) from public, anon;
revoke execute on function public.reverse_payment(uuid, text, uuid) from public, anon;
revoke execute on function public.rollback_import_batch(uuid, text, uuid) from public, anon;
revoke execute on function public.rollback_enrollment(uuid, text, uuid) from public, anon;

grant execute on function public.current_role() to authenticated;
grant execute on function public.current_profile() to authenticated;
grant execute on function public.current_clinic_id() to authenticated;
grant execute on function public.has_role(public.user_role[]) to authenticated;
grant execute on function public.has_unit_access(uuid) to authenticated;
grant execute on function public.same_clinic_profile(uuid) to authenticated;
grant execute on function public.same_clinic_professional(uuid) to authenticated;
grant execute on function public.current_professional_id() to authenticated;
grant execute on function public.can_access_professional(uuid) to authenticated;
grant execute on function public.can_access_patient(uuid) to authenticated;
grant execute on function public.can_access_appointment(uuid) to authenticated;
grant execute on function public.can_access_charge(uuid) to authenticated;
grant execute on function public.can_access_group_slot(uuid) to authenticated;
grant execute on function public.has_module_permission(text, boolean) to authenticated;
grant execute on function public.bootstrap_available() to authenticated;
grant execute on function public.bootstrap_clinic(text, text) to authenticated;
grant execute on function public.check_appointment_conflict(uuid, uuid, uuid, timestamptz, timestamptz, uuid, uuid) to authenticated;
grant execute on function public.complete_appointment(uuid, uuid) to authenticated;
grant execute on function public.register_payment(uuid, integer, text, timestamptz, text, uuid) to authenticated;
grant execute on function public.reverse_payment(uuid, text, uuid) to authenticated;
grant execute on function public.rollback_import_batch(uuid, text, uuid) to authenticated;
grant execute on function public.rollback_enrollment(uuid, text, uuid) to authenticated;
