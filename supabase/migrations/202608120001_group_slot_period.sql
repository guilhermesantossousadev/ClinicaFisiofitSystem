-- Permite limitar turmas recorrentes a um período de calendário.
alter table public.group_slots
  add column if not exists starts_on date,
  add column if not exists ends_on date;

alter table public.group_slots
  drop constraint if exists group_slots_period_check,
  add constraint group_slots_period_check
    check ((ends_on is null or starts_on is not null) and (ends_on is null or ends_on >= starts_on));
