alter table public.patients
  add column active boolean not null default true;

alter table public.responsibles
  add column active boolean not null default true;
