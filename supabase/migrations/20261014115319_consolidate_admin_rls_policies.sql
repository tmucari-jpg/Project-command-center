do $$
declare
  g record;
  b record;
  using_expr text;
  check_expr text;
begin
  for g in
    select schemaname, tablename, policyname, cmd
    from pg_policies
    where schemaname='public'
      and policyname like 'Global admins can %'
    order by tablename, cmd
  loop
    select *
      into b
    from pg_policies
    where schemaname=g.schemaname
      and tablename=g.tablename
      and cmd=g.cmd
      and policyname not like 'Global admins can %'
    order by policyname
    limit 1;

    if found then
      if g.cmd in ('SELECT','DELETE') then
        using_expr := format('(%s) OR (select private.is_global_admin())', b.qual);
        execute format(
          'alter policy %I on %I.%I using (%s)',
          b.policyname, b.schemaname, b.tablename, using_expr
        );
      elsif g.cmd = 'INSERT' then
        check_expr := format('(%s) OR (select private.is_global_admin())', b.with_check);
        execute format(
          'alter policy %I on %I.%I with check (%s)',
          b.policyname, b.schemaname, b.tablename, check_expr
        );
      elsif g.cmd = 'UPDATE' then
        using_expr := format('(%s) OR (select private.is_global_admin())', b.qual);
        check_expr := format(
          '(%s) OR (select private.is_global_admin())',
          coalesce(b.with_check, b.qual)
        );
        execute format(
          'alter policy %I on %I.%I using (%s) with check (%s)',
          b.policyname, b.schemaname, b.tablename, using_expr, check_expr
        );
      else
        continue;
      end if;

      execute format(
        'drop policy %I on %I.%I',
        g.policyname, g.schemaname, g.tablename
      );
    end if;
  end loop;
end $$;
