-- AGENDA-003: additive persistence only. No legacy backfill or runtime writes.

create extension if not exists btree_gist;

create type public.class_status as enum ('active', 'inactive');
create type public.class_occurrence_status as enum ('planned', 'in_progress', 'completed', 'cancelled');
create type public.class_weekday as enum (
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
);

create function public.class_weekdays_are_unique(p_weekdays public.class_weekday[])
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select cardinality(p_weekdays) = (select count(distinct weekday) from unnest(p_weekdays) as weekday)
$$;

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  unit_id uuid not null references public.units(id),
  name text not null check (char_length(trim(name)) between 1 and 100),
  service_id uuid references public.services(id),
  status public.class_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  unique (id, clinic_id)
);

create index classes_unit_status_idx on public.classes(unit_id, status);

create table public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  class_id uuid not null references public.classes(id) on delete restrict,
  effective_from date not null,
  effective_to date,
  weekdays public.class_weekday[] not null,
  start_time time not null,
  end_time time not null,
  timezone text not null,
  planned_professional_id uuid references public.professionals(id),
  effective_capacity integer not null check (effective_capacity > 0),
  room_id uuid references public.rooms(id),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  unique (id, class_id),
  check (effective_to is null or effective_to > effective_from),
  check (cardinality(weekdays) between 1 and 7),
  check (public.class_weekdays_are_unique(weekdays)),
  check (start_time < end_time),
  check (char_length(trim(timezone)) > 0),
  exclude using gist (
    class_id with =,
    daterange(effective_from, effective_to, '[)') with &&
  )
);

create index class_schedules_class_effective_idx on public.class_schedules(class_id, effective_from);
create index class_schedules_professional_idx on public.class_schedules(planned_professional_id) where planned_professional_id is not null;

create table public.class_occurrences (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  class_id uuid not null references public.classes(id) on delete restrict,
  class_schedule_id uuid not null,
  unit_id uuid not null references public.units(id),
  service_id uuid references public.services(id),
  local_date date not null,
  local_start_time time not null,
  local_end_time time not null,
  timezone text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  planned_professional_id uuid references public.professionals(id),
  actual_professional_id uuid references public.professionals(id),
  effective_capacity integer not null check (effective_capacity > 0),
  room_id uuid references public.rooms(id),
  status public.class_occurrence_status not null default 'planned',
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  unique (class_schedule_id, local_date),
  foreign key (class_schedule_id, class_id) references public.class_schedules(id, class_id) on delete restrict,
  check (local_start_time < local_end_time),
  check (start_at < end_at),
  check (char_length(trim(timezone)) > 0)
);

create index class_occurrences_unit_date_idx on public.class_occurrences(unit_id, local_date);
create index class_occurrences_class_start_idx on public.class_occurrences(class_id, start_at);
create index class_occurrences_schedule_date_idx on public.class_occurrences(class_schedule_id, local_date);
create index class_occurrences_planned_professional_idx on public.class_occurrences(planned_professional_id, start_at) where planned_professional_id is not null;
create index class_occurrences_actual_professional_idx on public.class_occurrences(actual_professional_id, start_at) where actual_professional_id is not null;

create table public.class_memberships (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  class_id uuid not null references public.classes(id) on delete restrict,
  patient_id uuid not null references public.patients(id),
  enrollment_id uuid references public.enrollments(id),
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  check (effective_to is null or effective_to > effective_from),
  exclude using gist (
    class_id with =,
    patient_id with =,
    daterange(effective_from, effective_to, '[)') with &&
  )
);

create index class_memberships_class_effective_idx on public.class_memberships(class_id, effective_from);
create index class_memberships_patient_effective_idx on public.class_memberships(patient_id, effective_from);

create or replace function public.can_access_class(target_class uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.classes c
    where c.id = target_class
      and c.clinic_id = public.current_clinic_id()
      and public.has_unit_access(c.unit_id)
      and (
        public.has_role(array['admin','manager','reception']::public.user_role[])
        or exists (
          select 1
          from public.class_schedules s
          where s.class_id = c.id
            and s.planned_professional_id = public.current_professional_id()
        )
      )
  )
$$;

alter table public.classes enable row level security;
alter table public.class_schedules enable row level security;
alter table public.class_occurrences enable row level security;
alter table public.class_memberships enable row level security;

create policy classes_select on public.classes for select
using (public.can_access_class(id));
create policy classes_write on public.classes for all
using (clinic_id = public.current_clinic_id() and public.has_unit_access(unit_id) and public.has_role(array['admin','manager','reception']::public.user_role[]))
with check (clinic_id = public.current_clinic_id() and public.has_unit_access(unit_id) and created_by = auth.uid() and public.has_role(array['admin','manager','reception']::public.user_role[]));

create policy class_schedules_select on public.class_schedules for select
using (public.can_access_class(class_id));
create policy class_schedules_write on public.class_schedules for all
using (public.can_access_class(class_id) and public.has_role(array['admin','manager','reception']::public.user_role[]))
with check (clinic_id = public.current_clinic_id() and public.can_access_class(class_id) and created_by = auth.uid() and public.has_role(array['admin','manager','reception']::public.user_role[]));

create policy class_occurrences_select on public.class_occurrences for select
using (public.can_access_class(class_id));
create policy class_occurrences_write on public.class_occurrences for all
using (public.can_access_class(class_id) and public.has_role(array['admin','manager','reception']::public.user_role[]))
with check (clinic_id = public.current_clinic_id() and public.can_access_class(class_id) and created_by = auth.uid() and public.has_role(array['admin','manager','reception']::public.user_role[]));

create policy class_memberships_select on public.class_memberships for select
using (public.can_access_class(class_id));
create policy class_memberships_write on public.class_memberships for all
using (public.can_access_class(class_id) and public.has_role(array['admin','manager','reception']::public.user_role[]))
with check (clinic_id = public.current_clinic_id() and public.can_access_class(class_id) and created_by = auth.uid() and public.has_role(array['admin','manager','reception']::public.user_role[]));

revoke execute on function public.can_access_class(uuid) from public, anon;
grant execute on function public.can_access_class(uuid) to authenticated;
