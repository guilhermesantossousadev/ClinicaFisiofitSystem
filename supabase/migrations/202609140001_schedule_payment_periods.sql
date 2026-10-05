alter table public.charges add column coverage_from date;
alter table public.charges add column coverage_to date;
alter table public.charges add constraint charges_coverage_period check (
  (coverage_from is null and coverage_to is null) or
  (coverage_from is not null and coverage_to is not null and coverage_to >= coverage_from)
);

-- Serialize allocations for each group, then check occupancy at each start boundary.
create or replace function public.check_group_membership_capacity()
returns trigger language plpgsql set search_path = public as $$
declare target public.group_slots; boundary date; occupied integer;
begin
  if new.deleted_at is not null or new.status <> 'active' then return new; end if;
  select * into target from public.group_slots where id = new.group_slot_id for update;
  if not target.active or target.deleted_at is not null then raise exception 'GROUP_INACTIVE'; end if;
  if new.ends_at < new.starts_at then raise exception 'INVALID_PERIOD'; end if;
  for boundary in
    select new.starts_at union
    select m.starts_at from public.group_slot_memberships m
    where m.group_slot_id = new.group_slot_id and m.id <> new.id
      and m.status = 'active' and m.deleted_at is null
      and m.starts_at >= new.starts_at and m.starts_at <= coalesce(new.ends_at, 'infinity'::date)
  loop
    select count(*) into occupied from public.group_slot_memberships m
    where m.group_slot_id = new.group_slot_id and m.id <> new.id
      and m.status = 'active' and m.deleted_at is null
      and m.starts_at <= boundary and coalesce(m.ends_at, 'infinity'::date) >= boundary;
    if occupied >= target.capacity then raise exception 'GROUP_CAPACITY_REACHED'; end if;
    if exists (select 1 from public.group_slot_memberships m where m.group_slot_id = new.group_slot_id
      and m.id <> new.id and m.patient_id = new.patient_id and m.status = 'active' and m.deleted_at is null
      and m.starts_at <= boundary and coalesce(m.ends_at, 'infinity'::date) >= boundary)
    then raise exception 'DUPLICATE_GROUP_MEMBER'; end if;
  end loop;
  return new;
end $$;
create trigger group_membership_capacity before insert or update on public.group_slot_memberships
for each row execute function public.check_group_membership_capacity();
