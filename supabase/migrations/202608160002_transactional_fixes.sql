-- Operações compostas executadas por uma RPC já participam de uma única
-- transação PostgreSQL. Blocos EXCEPTION abaixo criam savepoints para que um
-- lote inválido seja integralmente compensado antes de ser marcado como falho.

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

create or replace function public.approve_commission(
  p_commission_id uuid,
  p_request_id uuid
) returns public.commissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.commissions;
begin
  if not public.has_role(array['admin','manager','finance']::public.user_role[]) then
    raise exception 'FORBIDDEN';
  end if;

  select * into result
    from public.commissions
   where id = p_commission_id
     and clinic_id = public.current_clinic_id()
   for update;
  if result.id is null then raise exception 'COMMISSION_NOT_FOUND'; end if;
  if not public.has_unit_access(result.unit_id) then raise exception 'UNIT_FORBIDDEN'; end if;
  if result.status = 'approved' then return result; end if;
  if result.status <> 'pending' then raise exception 'COMMISSION_NOT_PENDING'; end if;

  update public.commissions
     set status = 'approved', approved_by = auth.uid(), approved_at = now()
   where id = result.id
   returning * into result;

  if result.amount_cents > 0 then
    insert into public.financial_entries(
      clinic_id, unit_id, kind, description, category, cost_center,
      amount_cents, competence_date, settled_at
    ) values (
      result.clinic_id, result.unit_id, 'expense', 'Comissão profissional aprovada',
      'Comissões', 'Equipe', result.amount_cents, current_date, now()
    );
  end if;

  insert into public.audit_events(
    clinic_id, unit_id, user_id, action, entity_type, entity_id, request_id, metadata
  ) values (
    result.clinic_id, result.unit_id, auth.uid(), 'commission.approved', 'commission',
    result.id, p_request_id, jsonb_build_object('amount_cents', result.amount_cents)
  );

  return result;
end
$$;

create or replace function public.complete_appointment(
  p_appointment_id uuid,
  p_request_id uuid
) returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.appointments;
  consume_session boolean := false;
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
  if public.current_role() = 'professional'
     and result.professional_id is distinct from public.current_professional_id() then
    raise exception 'PROFESSIONAL_FORBIDDEN';
  end if;
  consume_session := result.enrollment_id is not null and result.session_consumed_at is null;
  if result.status = 'completed' and not consume_session then return result; end if;

  update public.appointments
     set status = 'completed',
         session_consumed_at = case when consume_session then now() else session_consumed_at end,
         updated_at = now()
   where id = result.id
   returning * into result;

  if consume_session then
    update public.enrollments
       set sessions_used = sessions_used + 1, updated_at = now()
     where id = result.enrollment_id
       and clinic_id = result.clinic_id
       and unit_id = result.unit_id
       and deleted_at is null;
    if not found then raise exception 'ENROLLMENT_NOT_FOUND'; end if;
  end if;

  insert into public.audit_events(
    clinic_id, unit_id, user_id, action, entity_type, entity_id, request_id,
    metadata
  ) values (
    result.clinic_id, result.unit_id, auth.uid(), 'appointment.completed',
    'appointment', result.id, p_request_id,
    jsonb_build_object('session_consumed', consume_session)
  );

  return result;
end
$$;

create or replace function public.import_rows_transactional(
  p_source text,
  p_filename text,
  p_unit_id uuid,
  p_rows jsonb,
  p_mapping jsonb,
  p_issues jsonb,
  p_idempotency_key text,
  p_request_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_clinic uuid := public.current_clinic_id();
  batch public.import_batches;
  item jsonb;
  entity text;
  target_table text;
  allowed_fields text[];
  target_id uuid;
  clean_values jsonb;
  column_names text;
  update_assignments text;
  row_unit uuid;
  imported jsonb := '{}'::jsonb;
  imported_count integer := 0;
  failure_message text;
begin
  if not public.has_role(array['admin','manager']::public.user_role[]) then
    raise exception 'FORBIDDEN';
  end if;
  if length(trim(coalesce(p_source, ''))) < 1
     or length(trim(coalesce(p_filename, ''))) < 1
     or length(coalesce(p_idempotency_key, '')) not between 12 and 120 then
    raise exception 'INVALID_IMPORT_METADATA';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'INVALID_IMPORT_ROWS'; end if;
  if p_unit_id is not null and not public.has_unit_access(p_unit_id) then
    raise exception 'UNIT_FORBIDDEN';
  end if;

  select * into batch
    from public.import_batches
   where clinic_id = current_clinic
     and idempotency_key = p_idempotency_key;
  if batch.id is not null then
    return jsonb_build_object(
      'batchId', batch.id, 'status', batch.status, 'imported', batch.totals->'imported',
      'issues', batch.errors, 'idempotent', true
    );
  end if;

  insert into public.import_batches(
    clinic_id, source, filename, mapping, status, stage, totals, errors,
    idempotency_key, created_by
  ) values (
    current_clinic, p_source, p_filename, coalesce(p_mapping, '{}'::jsonb), 'processing',
    'reconcile', jsonb_build_object('total', jsonb_array_length(p_rows)),
    coalesce(p_issues, '[]'::jsonb), p_idempotency_key, auth.uid()
  ) returning * into batch;

  begin
    for item in select value from jsonb_array_elements(p_rows) loop
      entity := item->>'entity';
      target_table := case entity
        when 'units' then 'units'
        when 'rooms' then 'rooms'
        when 'professionals' then 'professionals'
        when 'services' then 'services'
        when 'plans' then 'plans'
        when 'patients' then 'patients'
        when 'enrollments' then 'enrollments'
        when 'appointments' then 'appointments'
        when 'group_slots' then 'group_slots'
        when 'charges' then 'charges'
        when 'payments' then 'payments'
        when 'financial_entries' then 'financial_entries'
        when 'commissions' then 'commissions'
        when 'clinical_records' then 'clinical_records'
        when 'record_templates' then 'record_templates'
        else null
      end;
      allowed_fields := case entity
        when 'units' then array['name','phone','active','address']
        when 'rooms' then array['name','unit_id','capacity','active']
        when 'professionals' then array['name','council','specialty','active','migration_source','external_id']
        when 'services' then array['name','duration_minutes','price_cents','color','active']
        when 'plans' then array['name','kind','sessions_included','duration_days','price_cents','active']
        when 'patients' then array['primary_unit_id','name','cpf','birth_date','phone','email','address','tax_data','notes','external_id','migration_source','created_at']
        when 'enrollments' then array['patient_id','plan_id','unit_id','starts_at','ends_at','due_day','discount_cents','surcharge_cents','status']
        when 'appointments' then array['unit_id','patient_id','professional_id','service_id','room_id','enrollment_id','starts_at','ends_at','status','notes']
        when 'group_slots' then array['unit_id','room_id','professional_id','service_id','name','weekdays','starts_at','starts_on','ends_on','duration_minutes','capacity','active']
        when 'charges' then array['patient_id','enrollment_id','unit_id','description','amount_cents','due_at','installment_number','installment_count','status']
        when 'payments' then array['charge_id','amount_cents','method','paid_at','idempotency_key']
        when 'financial_entries' then array['unit_id','charge_id','payment_id','kind','description','category','cost_center','amount_cents','competence_date','settled_at']
        when 'commissions' then array['unit_id','professional_id','appointment_id','payment_id','amount_cents','basis','status']
        when 'clinical_records' then array['patient_id','appointment_id','professional_id','unit_id','kind','template_id','template_version','payload','status']
        when 'record_templates' then array['name','kind','specialty','schema','active']
        else array[]::text[]
      end;
      if not (item ? 'values') then target_table := null; end if;

      target_id := null;
      if target_table is not null then
        select coalesce(jsonb_object_agg(field.key, field.value), '{}'::jsonb)
          into clean_values
          from jsonb_each(coalesce(item->'values', '{}'::jsonb)) as field(key, value)
         where field.key = any(allowed_fields);
        clean_values := clean_values || jsonb_build_object('clinic_id', current_clinic);
        row_unit := coalesce(
          nullif(item->>'unit_id', ''),
          nullif(clean_values->>'unit_id', ''),
          nullif(clean_values->>'primary_unit_id', '')
        )::uuid;
        if row_unit is not null and not public.has_unit_access(row_unit) then
          raise exception 'IMPORT_UNIT_FORBIDDEN';
        end if;
        if clean_values->>'patient_id' is not null and not exists (
          select 1 from public.patients p
           where p.id = (clean_values->>'patient_id')::uuid
             and p.clinic_id = current_clinic
             and (row_unit is null or p.primary_unit_id = row_unit)
             and p.deleted_at is null
        ) then raise exception 'IMPORT_PATIENT_SCOPE_MISMATCH'; end if;
        if clean_values->>'professional_id' is not null and not exists (
          select 1 from public.professionals p
           where p.id = (clean_values->>'professional_id')::uuid
             and p.clinic_id = current_clinic
             and p.deleted_at is null
             and (row_unit is null or exists (
               select 1 from public.professional_units pu
                where pu.professional_id = p.id and pu.unit_id = row_unit
             ))
        ) then raise exception 'IMPORT_PROFESSIONAL_SCOPE_MISMATCH'; end if;
        if clean_values->>'room_id' is not null and not exists (
          select 1 from public.rooms r
           where r.id = (clean_values->>'room_id')::uuid
             and r.clinic_id = current_clinic
             and (row_unit is null or r.unit_id = row_unit)
             and r.deleted_at is null
        ) then raise exception 'IMPORT_ROOM_SCOPE_MISMATCH'; end if;
        if clean_values->>'service_id' is not null and not exists (
          select 1 from public.services s
           where s.id = (clean_values->>'service_id')::uuid
             and s.clinic_id = current_clinic
             and s.deleted_at is null
        ) then raise exception 'IMPORT_SERVICE_SCOPE_MISMATCH'; end if;

        if entity = 'payments' then
          select id into target_id
            from public.register_payment(
              (clean_values->>'charge_id')::uuid,
              (clean_values->>'amount_cents')::integer,
              clean_values->>'method',
              (clean_values->>'paid_at')::timestamptz,
              coalesce(clean_values->>'idempotency_key', p_idempotency_key || ':' || coalesce(item->>'external_id', pg_catalog.gen_random_uuid()::text)),
              p_request_id
            );
        else
          select string_agg(format('%I', key), ', ' order by key)
            into column_names
            from jsonb_object_keys(clean_values) as keys(key);

          if p_source = 'notion' and entity in ('professionals', 'patients') then
            select string_agg(format('%1$I = excluded.%1$I', key), ', ' order by key)
              into update_assignments
              from jsonb_object_keys(clean_values) as keys(key)
             where key not in ('clinic_id', 'migration_source', 'external_id');
            execute format(
              'insert into public.%1$I (%2$s) select %2$s from pg_catalog.jsonb_populate_record(null::public.%1$I, $1) as imported '
              || 'on conflict (clinic_id, migration_source, external_id) do update set %3$s returning id',
              target_table, column_names, update_assignments
            ) into target_id using clean_values;
          else
            execute format(
              'insert into public.%1$I (%2$s) select %2$s from pg_catalog.jsonb_populate_record(null::public.%1$I, $1) as imported returning id',
              target_table, column_names
            ) into target_id using clean_values;
          end if;

          if entity = 'professionals' and item->>'unit_id' is not null then
            insert into public.professional_units(professional_id, unit_id)
            values(target_id, (item->>'unit_id')::uuid)
            on conflict do nothing;
          end if;
        end if;

        imported_count := imported_count + 1;
        imported := jsonb_set(
          imported,
          array[entity],
          to_jsonb(coalesce((imported->>entity)::integer, 0) + 1),
          true
        );
      end if;

      insert into public.migration_items(
        clinic_id, batch_id, source, entity_type, external_id, source_url,
        payload, status, target_table, target_id
      ) values (
        current_clinic, batch.id, p_source, entity,
        coalesce(item->>'external_id', pg_catalog.gen_random_uuid()::text), item->>'source_url',
        coalesce(item->'payload', item->'values', '{}'::jsonb),
        case when target_id is null then coalesce(item->>'status', 'staged') else 'imported' end,
        target_table, target_id
      )
      on conflict (clinic_id, source, entity_type, external_id) do update
        set batch_id = excluded.batch_id,
            source_url = excluded.source_url,
            payload = excluded.payload,
            status = excluded.status,
            target_table = excluded.target_table,
            target_id = excluded.target_id,
            issue = null,
            updated_at = now();
    end loop;

    update public.import_batches
       set status = 'completed', stage = 'reconciled',
           totals = jsonb_build_object(
             'total', jsonb_array_length(p_rows),
             'importedCount', imported_count,
             'imported', imported
           ),
           errors = coalesce(p_issues, '[]'::jsonb),
           completed_at = now(), updated_at = now()
     where id = batch.id;
  exception when others then
    get stacked diagnostics failure_message = message_text;
    update public.import_batches
       set status = 'failed', stage = 'reconcile',
           totals = jsonb_build_object('total', jsonb_array_length(p_rows), 'importedCount', 0, 'imported', '{}'::jsonb),
           errors = coalesce(p_issues, '[]'::jsonb)
             || jsonb_build_array(jsonb_build_object(
               'entity', entity, 'externalId', item->>'external_id', 'reason', failure_message
             )),
           updated_at = now()
     where id = batch.id;
    insert into public.audit_events(
      clinic_id, unit_id, user_id, action, entity_type, entity_id, request_id, metadata
    ) values (
      current_clinic, p_unit_id, auth.uid(), 'import.failed', 'import_batch', batch.id,
      p_request_id, jsonb_build_object('reason', failure_message, 'compensated', true)
    );
    return jsonb_build_object(
      'batchId', batch.id, 'status', 'failed', 'imported', '{}'::jsonb,
      'issues', coalesce(p_issues, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'entity', entity, 'externalId', item->>'external_id', 'reason', failure_message
      )),
      'compensated', true
    );
  end;

  insert into public.audit_events(
    clinic_id, unit_id, user_id, action, entity_type, entity_id, request_id, metadata
  ) values (
    current_clinic, p_unit_id, auth.uid(), 'import.completed', 'import_batch', batch.id,
    p_request_id, jsonb_build_object('imported', imported, 'issues', jsonb_array_length(coalesce(p_issues, '[]'::jsonb)))
  );

  return jsonb_build_object(
    'batchId', batch.id, 'status', 'completed', 'imported', imported,
    'importedCount', imported_count, 'issues', coalesce(p_issues, '[]'::jsonb),
    'compensated', false
  );
end
$$;

revoke execute on function public.approve_commission(uuid, uuid) from public, anon;
revoke execute on function public.import_rows_transactional(text, text, uuid, jsonb, jsonb, jsonb, text, uuid) from public, anon;
grant execute on function public.approve_commission(uuid, uuid) to authenticated;
grant execute on function public.import_rows_transactional(text, text, uuid, jsonb, jsonb, jsonb, text, uuid) to authenticated;
