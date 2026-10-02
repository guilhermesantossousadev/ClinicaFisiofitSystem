create table public.class_attendances (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  unit_id uuid not null references public.units(id),
  group_slot_id uuid not null references public.group_slots(id),
  membership_id uuid not null references public.group_slot_memberships(id),
  enrollment_id uuid not null references public.enrollments(id),
  patient_id uuid not null references public.patients(id),
  class_date date not null,
  status text not null check (status in ('present','absent')),
  makeup_status text not null default 'not_required' check (makeup_status in ('not_required','pending','completed','waived')),
  makeup_completed_at timestamptz,
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (membership_id, class_date),
  check (
    (status = 'present' and makeup_status = 'not_required')
    or status = 'absent'
  )
);

create index class_attendances_daily_idx on public.class_attendances(clinic_id, unit_id, class_date);
create index class_attendances_makeup_idx on public.class_attendances(clinic_id, makeup_status, class_date)
  where status = 'absent';

alter table public.class_attendances enable row level security;

create policy class_attendances_select on public.class_attendances for select
using (
  clinic_id = public.current_clinic_id()
  and public.can_access_group_slot(group_slot_id)
  and public.has_role(array['admin','manager','reception','professional']::public.user_role[])
);

create policy class_attendances_write on public.class_attendances for all
using (
  clinic_id = public.current_clinic_id()
  and public.can_access_group_slot(group_slot_id)
  and public.has_role(array['admin','manager','reception','professional']::public.user_role[])
)
with check (
  clinic_id = public.current_clinic_id()
  and public.can_access_group_slot(group_slot_id)
  and recorded_by = auth.uid()
  and public.has_role(array['admin','manager','reception','professional']::public.user_role[])
);
