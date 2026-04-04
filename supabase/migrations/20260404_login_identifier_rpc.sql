create or replace function public.resolve_login_identifier(input_identifier text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized text := lower(btrim(input_identifier));
  resolved_email text;
  alias_count int;
begin
  if normalized is null or normalized = '' then
    return null;
  end if;

  if position('@' in normalized) > 0 then
    select lower(email)
    into resolved_email
    from auth.users
    where lower(email) = normalized
    limit 1;

    return resolved_email;
  end if;

  select count(*), min(lower(email))
  into alias_count, resolved_email
  from auth.users
  where split_part(lower(email), '@', 1) = normalized;

  if alias_count = 1 then
    return resolved_email;
  end if;

  return null;
end;
$$;

grant execute on function public.resolve_login_identifier(text) to anon, authenticated;
