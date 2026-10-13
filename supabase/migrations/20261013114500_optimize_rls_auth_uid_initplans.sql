-- Optimise RLS auth lookups without changing authorization semantics.
-- Rewrites only policies that still call auth.uid() directly.

do $$
declare
  p record;
  new_qual text;
  new_check text;
  stmt text;
begin
  for p in
    select schemaname, tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname='public'
      and (
        (coalesce(qual,'') like '%auth.uid()%' and coalesce(qual,'') not ilike '%select auth.uid%')
        or
        (coalesce(with_check,'') like '%auth.uid()%' and coalesce(with_check,'') not ilike '%select auth.uid%')
      )
  loop
    new_qual := case
      when p.qual is null then null
      else replace(p.qual, 'auth.uid()', '(select auth.uid())')
    end;

    new_check := case
      when p.with_check is null then null
      else replace(p.with_check, 'auth.uid()', '(select auth.uid())')
    end;

    stmt := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);

    if p.cmd in ('SELECT','DELETE') then
      stmt := stmt || format(' using (%s)', new_qual);
    elsif p.cmd = 'INSERT' then
      stmt := stmt || format(' with check (%s)', new_check);
    elsif p.cmd = 'UPDATE' then
      stmt := stmt || format(' using (%s) with check (%s)', new_qual, new_check);
    elsif p.cmd = 'ALL' then
      if new_qual is not null then
        stmt := stmt || format(' using (%s)', new_qual);
      end if;
      if new_check is not null then
        stmt := stmt || format(' with check (%s)', new_check);
      end if;
    end if;

    execute stmt;
  end loop;
end
$$;
