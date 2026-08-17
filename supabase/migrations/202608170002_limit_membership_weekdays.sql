alter table public.group_slot_memberships
  drop constraint if exists group_slot_memberships_weekdays_check,
  add constraint group_slot_memberships_weekdays_check
    check (cardinality(weekdays) between 1 and 3 and weekdays <@ array[1,2,3,4,5]::smallint[]);
