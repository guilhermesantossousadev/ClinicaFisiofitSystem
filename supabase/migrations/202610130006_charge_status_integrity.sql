-- Administrative status changes cannot record a payment. Only the dedicated
-- payment and reversal RPCs may move a charge into paid/partial states.
create or replace function public.update_unpaid_charge_status(
  p_charge_id uuid,
  p_status public.charge_status,
  p_request_id uuid
) returns public.charges
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.charges;
  result public.charges;
begin
  if not public.has_role(array['admin','manager','finance']::public.user_role[])
     or not public.has_module_permission('enrollments', false)
     or not public.has_module_permission('enrollments', true) then
    raise exception 'FORBIDDEN';
  end if;

  if p_status in ('paid'::public.charge_status, 'partial'::public.charge_status) then
    raise exception 'STATUS_MANAGED_BY_PAYMENT';
  end if;

  select * into target
    from public.charges
   where id = p_charge_id
     and clinic_id = public.current_clinic_id()
     and deleted_at is null
   for update;
  if target.id is null then raise exception 'CHARGE_NOT_FOUND'; end if;
  if not public.has_unit_access(target.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;

  if target.status in ('paid'::public.charge_status, 'partial'::public.charge_status)
     or target.paid_cents > 0
     or exists (
       select 1 from public.payments p
        where p.clinic_id = target.clinic_id
          and p.charge_id = target.id
          and p.reversed_at is null
     ) then
    raise exception 'CHARGE_HAS_PAYMENTS';
  end if;

  update public.charges
     set status = p_status,
         updated_at = now()
   where id = target.id
     and clinic_id = target.clinic_id
     and deleted_at is null
   returning * into result;

  insert into public.audit_events(clinic_id, unit_id, user_id, action, entity_type, entity_id, request_id, metadata)
  values(target.clinic_id, target.unit_id, auth.uid(), 'charge.status_updated', 'charge', target.id, p_request_id,
    jsonb_build_object('previous_status', target.status, 'status', result.status));

  return result;
end
$$;

revoke all on function public.update_unpaid_charge_status(uuid, public.charge_status, uuid) from public, anon;
grant execute on function public.update_unpaid_charge_status(uuid, public.charge_status, uuid) to authenticated;
