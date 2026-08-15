create or replace function public.activate_own_profile()
returns public.member_status
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  activated_status public.member_status;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  update public.profiles
     set status = 'active',
         updated_at = now()
   where id = auth.uid()
     and status = 'invited'
     and deleted_at is null
  returning status into activated_status;

  if activated_status is not null then
    return activated_status;
  end if;

  select status
    into activated_status
    from public.profiles
   where id = auth.uid()
     and deleted_at is null;

  if activated_status is null then
    raise exception 'MEMBERSHIP_NOT_FOUND';
  end if;

  return activated_status;
end;
$$;

revoke all on function public.activate_own_profile() from public;
grant execute on function public.activate_own_profile() to authenticated;
