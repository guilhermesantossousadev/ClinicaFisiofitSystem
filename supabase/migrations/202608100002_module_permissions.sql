create table public.profile_permissions (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  module text not null check (module in ('dashboard','agenda','patients','enrollments','records','finance','reports','imports','users','settings','privacy')),
  can_view boolean not null default false,
  can_edit boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, module)
);

alter table public.profile_permissions enable row level security;
create policy profile_permissions_read on public.profile_permissions for select using (
  profile_id = auth.uid() or (exists (select 1 from public.profiles p where p.id = auth.uid() and p.clinic_id = (select clinic_id from public.profiles where id = profile_permissions.profile_id) and p.role in ('admin','manager')))
);
create policy profile_permissions_admin_write on public.profile_permissions for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.clinic_id = (select clinic_id from public.profiles where id = profile_permissions.profile_id) and p.role = 'admin')
) with check (true);

create index profile_permissions_profile_idx on public.profile_permissions(profile_id);
