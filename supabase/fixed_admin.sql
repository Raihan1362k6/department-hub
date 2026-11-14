-- Make the specified account a permanent admin in an existing Supabase project.
do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'Run supabase/schema.sql first.';
  end if;
end;
$$;

update public.profiles
set role = 'admin'
where lower(email) = '2026eeb061.raihan@students.iiests.ac.in';

create or replace function public.protect_fixed_admin_profile()
returns trigger
language plpgsql
set search_path = public
as $$
declare fixed_admin_email constant text := '2026eeb061.raihan@students.iiests.ac.in';
begin
  if tg_op = 'DELETE' then
    if lower(old.email) = fixed_admin_email then
      raise exception 'The fixed admin account cannot be removed';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE'
    and lower(old.email) = fixed_admin_email
    and lower(new.email) <> fixed_admin_email then
    raise exception 'The fixed admin account email cannot be changed';
  end if;

  if lower(new.email) = fixed_admin_email and new.role <> 'admin' then
    raise exception 'The fixed admin account must remain an admin';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_fixed_admin_profile on public.profiles;
create trigger protect_fixed_admin_profile
before insert or update or delete on public.profiles
for each row execute procedure public.protect_fixed_admin_profile();

notify pgrst, 'reload schema';
