drop index if exists public.patients_notion_external_unique;
create unique index patients_notion_external_unique
  on public.patients(clinic_id, migration_source, external_id);

drop index if exists public.professionals_notion_external_unique;
create unique index professionals_notion_external_unique
  on public.professionals(clinic_id, migration_source, external_id);

update public.import_batches
set status = 'failed',
    stage = 'reconcile',
    errors = errors || jsonb_build_array(jsonb_build_object(
      'reason', 'Lote interrompido antes da importação por configuração de idempotência; seguro para repetir.'
    )),
    updated_at = now()
where source = 'notion' and status = 'processing';
