create or replace function public.reverse_payment(
  p_payment_id uuid,
  p_reason text,
  p_request_id uuid
) returns public.payments
language plpgsql security definer set search_path = public as $$
declare target public.payments; charge_row public.charges; result public.payments;
begin
  if not public.has_role(array['admin','manager','finance']::public.user_role[]) then
    raise exception 'FORBIDDEN';
  end if;
  if length(trim(p_reason)) < 10 then raise exception 'REVERSAL_REASON_REQUIRED'; end if;
  select * into target from public.payments
    where id = p_payment_id and clinic_id = public.current_clinic_id() for update;
  if target.id is null then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if target.reversed_at is not null then return target; end if;
  select * into charge_row from public.charges where id = target.charge_id for update;
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
end $$;
