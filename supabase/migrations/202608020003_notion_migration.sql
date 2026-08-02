create table public.migration_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  source text not null default 'notion',
  entity_type text not null,
  external_id text not null,
  source_url text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'staged' check (status in ('staged','imported','duplicate','pending','rejected')),
  target_table text,
  target_id uuid,
  issue text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, source, entity_type, external_id)
);
create index migration_items_batch_idx on public.migration_items(batch_id, entity_type, status);

create unique index patients_notion_external_unique
  on public.patients(clinic_id, migration_source, external_id)
  where migration_source is not null and external_id is not null and deleted_at is null;

alter table public.professionals add column if not exists migration_source text;
alter table public.professionals add column if not exists external_id text;
create unique index professionals_notion_external_unique
  on public.professionals(clinic_id, migration_source, external_id)
  where migration_source is not null and external_id is not null and deleted_at is null;

alter table public.import_batches add column if not exists entity_type text;
alter table public.import_batches add column if not exists stage text not null default 'upload';
alter table public.import_batches add column if not exists source_page_id text;
alter table public.import_batches add column if not exists completed_at timestamptz;
alter table public.import_batches add column if not exists errors jsonb not null default '[]'::jsonb;

alter table public.migration_items enable row level security;
create policy migration_items_select on public.migration_items for select
  using (clinic_id = public.current_clinic_id() and public.has_role(array['admin','manager']::public.user_role[]));

comment on table public.migration_items is 'Staging rastreável e idempotente para migrações externas; payload bruto nunca é exposto ao portal.';
