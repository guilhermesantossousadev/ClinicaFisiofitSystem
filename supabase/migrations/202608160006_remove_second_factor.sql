create or replace function public.bootstrap_clinic(p_name text, p_admin_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_clinic_id uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if exists(select 1 from public.clinics) then raise exception 'BOOTSTRAP_ALREADY_COMPLETED'; end if;
  if length(trim(p_name)) < 3 or length(trim(p_admin_name)) < 3 then raise exception 'INVALID_BOOTSTRAP_DATA'; end if;
  insert into public.clinics(name) values(trim(p_name)) returning id into new_clinic_id;
  insert into public.profiles(id, clinic_id, name, role, status)
    values(auth.uid(), new_clinic_id, trim(p_admin_name), 'admin', 'active');
  insert into public.audit_events(clinic_id, user_id, action, entity_type, entity_id)
    values(new_clinic_id, auth.uid(), 'clinic.bootstrapped', 'clinic', new_clinic_id);
  return new_clinic_id;
end $$;

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
       or new.deleted_at is not null then
      raise exception 'PROTECTED_OWNER_ACCOUNT' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

alter table public.profiles drop column if exists mfa_required;
