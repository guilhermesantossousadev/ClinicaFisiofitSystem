create or replace function public.correct_unpaid_charge_amount(
  p_charge_id uuid,
  p_expected_amount_cents integer,
  p_amount_cents integer,
  p_reason text,
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
     or not public.has_module_permission('finance', true) then
    raise exception 'FORBIDDEN';
  end if;
  if p_expected_amount_cents is null or p_expected_amount_cents <= 0
     or p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'INVALID_CHARGE_AMOUNT';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 10 then
    raise exception 'CHARGE_REASON_REQUIRED';
  end if;

  select * into target from public.charges
   where id = p_charge_id and clinic_id = public.current_clinic_id()
     and deleted_at is null
   for update;
  if target.id is null then raise exception 'CHARGE_NOT_EDITABLE'; end if;
  if not public.has_unit_access(target.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
  if target.status not in ('pending', 'overdue') or target.amount_cents <> p_expected_amount_cents then
    raise exception 'CHARGE_AMOUNT_CONFLICT';
  end if;
  if target.paid_cents <> 0 or exists (
    select 1 from public.payments p where p.clinic_id = target.clinic_id and p.charge_id = target.id
  ) then
    raise exception 'CHARGE_HAS_PAYMENTS';
  end if;

  update public.charges set amount_cents = p_amount_cents, updated_at = now()
   where id = target.id and clinic_id = target.clinic_id
     and amount_cents = p_expected_amount_cents and paid_cents = 0
     and status in ('pending', 'overdue')
   returning * into result;
  if result.id is null then raise exception 'CHARGE_AMOUNT_CONFLICT'; end if;

  insert into public.audit_events(
    clinic_id, unit_id, user_id, action, entity_type, entity_id, request_id, metadata
  ) values (
    target.clinic_id, target.unit_id, auth.uid(), 'charge.amount_corrected', 'charge', target.id, p_request_id,
    jsonb_build_object(
      'previous_amount_cents', target.amount_cents,
      'amount_cents', p_amount_cents,
      'reason', trim(p_reason)
    )
  );
  return result;
end
$$;

revoke all on function public.correct_unpaid_charge_amount(uuid, integer, integer, text, uuid) from public, anon;
grant execute on function public.correct_unpaid_charge_amount(uuid, integer, integer, text, uuid) to authenticated;
