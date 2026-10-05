-- Preserva escopo e permissões; impede recebimentos em cobranças canceladas.
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
declare
  target public.charges;
  result public.payments;
begin
  if not public.has_role(array['admin','manager','finance']::public.user_role[]) then
    raise exception 'FORBIDDEN';
  end if;
  if p_method not in ('pix','card','cash','transfer') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;

  select * into target
    from public.charges
   where id = p_charge_id
     and clinic_id = public.current_clinic_id()
     and deleted_at is null
   for update;
  if target.id is null then raise exception 'CHARGE_NOT_FOUND'; end if;
  if not public.has_unit_access(target.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;

  select * into result
    from public.payments
   where clinic_id = target.clinic_id
     and idempotency_key = p_idempotency_key;
  if result.id is not null then return result; end if;

  if target.status = 'cancelled' then raise exception 'CHARGE_CANCELLED'; end if;
  if result.id is null and coalesce(trim(p_idempotency_key), '') = '' then raise exception 'IDEMPOTENCY_REQUIRED'; end if;

  if p_amount_cents <= 0 or target.paid_cents + p_amount_cents > target.amount_cents then
    raise exception 'INVALID_PAYMENT_AMOUNT';
  end if;

  insert into public.payments(clinic_id, charge_id, amount_cents, method, paid_at, idempotency_key)
  values(target.clinic_id, target.id, p_amount_cents, p_method, p_paid_at, p_idempotency_key)
  returning * into result;

  update public.charges
     set paid_cents = paid_cents + p_amount_cents,
         status = case
           when paid_cents + p_amount_cents = amount_cents then 'paid'::public.charge_status
           else 'partial'::public.charge_status
         end,
         updated_at = now()
   where id = target.id;

  insert into public.financial_entries(
    clinic_id, unit_id, charge_id, payment_id, kind, description,
    category, amount_cents, competence_date, settled_at
  ) values (
    target.clinic_id, target.unit_id, target.id, result.id, 'income',
    target.description, 'Recebimentos', p_amount_cents, p_paid_at::date, p_paid_at
  );

  insert into public.audit_events(
    clinic_id, unit_id, user_id, action, entity_type, entity_id, request_id, metadata
  ) values (
    target.clinic_id, target.unit_id, auth.uid(), 'payment.created', 'payment',
    result.id, p_request_id, jsonb_build_object('amount_cents', p_amount_cents)
  );

  return result;
end
$$;

