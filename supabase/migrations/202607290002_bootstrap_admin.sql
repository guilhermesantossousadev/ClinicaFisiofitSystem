do $$
declare
  admin_user_id constant uuid := 'd0422411-434d-43c8-af22-f8f163c9a3eb';
  target_clinic_id uuid;
  created_profile boolean := false;
begin
  if not exists (select 1 from auth.users where id = admin_user_id) then
    raise exception 'ADMIN_AUTH_USER_NOT_FOUND';
  end if;

  select id
    into target_clinic_id
    from public.clinics
   where deleted_at is null
   order by created_at
   limit 1;

  if target_clinic_id is null then
    insert into public.clinics(name)
    values ('Clínica Fisiofit')
    returning id into target_clinic_id;
  end if;

  if not exists (select 1 from public.profiles where id = admin_user_id) then
    insert into public.profiles(
      id,
      clinic_id,
      name,
      role,
      status,
      mfa_required
    )
    values (
      admin_user_id,
      target_clinic_id,
      'Guilherme Santos de Sousa',
      'admin',
      'active',
      true
    );
    created_profile := true;
  else
    update public.profiles
       set clinic_id = target_clinic_id,
           name = 'Guilherme Santos de Sousa',
           role = 'admin',
           status = 'active',
           mfa_required = true,
           deleted_at = null,
           updated_at = now()
     where id = admin_user_id;
  end if;

  if created_profile then
    insert into public.audit_events(
      clinic_id,
      user_id,
      action,
      entity_type,
      entity_id,
      metadata
    )
    values (
      target_clinic_id,
      admin_user_id,
      'admin.bootstrapped',
      'profile',
      admin_user_id,
      jsonb_build_object('source', 'versioned_migration')
    );
  end if;
end
$$;
