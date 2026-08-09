alter table public.import_batches add column if not exists rollback_at timestamptz;
alter table public.import_batches add column if not exists rollback_reason text;

create or replace function public.rollback_import_batch(p_batch_id uuid, p_reason text, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare batch public.import_batches; item record; restored integer := 0;
begin
  if not public.has_role(array['admin','manager']::public.user_role[]) then raise exception 'FORBIDDEN'; end if;
  if length(trim(p_reason)) < 10 then raise exception 'ROLLBACK_REASON_REQUIRED'; end if;
  select * into batch from public.import_batches where id = p_batch_id and clinic_id = public.current_clinic_id() for update;
  if batch.id is null then raise exception 'IMPORT_BATCH_NOT_FOUND'; end if;
  if batch.rollback_at is not null then return jsonb_build_object('batch_id', batch.id, 'restored', 0, 'already_rolled_back', true); end if;
  for item in select * from public.migration_items where batch_id = batch.id and status = 'imported' and target_id is not null loop
    if item.target_table in ('units','rooms','professionals','services','plans','patients','enrollments','appointments','group_slots','charges','financial_entries','commissions','clinical_records','record_templates') then
      execute format('update public.%I set deleted_at = now(), updated_at = now() where id = $1 and clinic_id = $2 and deleted_at is null', item.target_table) using item.target_id, batch.clinic_id;
      if found then restored := restored + 1; end if;
      update public.migration_items set status = 'rejected', issue = 'Rollback: ' || trim(p_reason), updated_at = now() where id = item.id;
    end if;
  end loop;
  update public.import_batches set rollback_at = now(), rollback_reason = trim(p_reason), status = 'failed', updated_at = now() where id = batch.id;
  insert into public.audit_events(clinic_id, user_id, action, entity_type, entity_id, request_id, metadata)
    values(batch.clinic_id, auth.uid(), 'import.rolled_back', 'import_batch', batch.id, p_request_id, jsonb_build_object('reason', trim(p_reason), 'restored', restored));
  return jsonb_build_object('batch_id', batch.id, 'restored', restored, 'already_rolled_back', false);
end $$;

create or replace function public.rollback_enrollment(p_enrollment_id uuid, p_reason text, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare target public.enrollments; affected integer := 0;
begin
  if not public.has_role(array['admin','manager','reception','finance']::public.user_role[]) then raise exception 'FORBIDDEN'; end if;
  if length(trim(p_reason)) < 10 then raise exception 'ROLLBACK_REASON_REQUIRED'; end if;
  select * into target from public.enrollments where id = p_enrollment_id and clinic_id = public.current_clinic_id() and deleted_at is null for update;
  if target.id is null then raise exception 'ENROLLMENT_NOT_FOUND'; end if;
  update public.group_slot_memberships set deleted_at = now(), updated_at = now() where enrollment_id = target.id and deleted_at is null;
  get diagnostics affected = row_count;
  update public.charges set deleted_at = now(), updated_at = now() where enrollment_id = target.id and clinic_id = target.clinic_id and paid_cents = 0 and deleted_at is null;
  update public.enrollments set deleted_at = now(), updated_at = now() where id = target.id;
  insert into public.audit_events(clinic_id, unit_id, user_id, action, entity_type, entity_id, request_id, metadata)
    values(target.clinic_id, target.unit_id, auth.uid(), 'enrollment.rolled_back', 'enrollment', target.id, p_request_id, jsonb_build_object('reason', trim(p_reason), 'memberships', affected));
  return jsonb_build_object('enrollment_id', target.id, 'memberships', affected);
end $$;
