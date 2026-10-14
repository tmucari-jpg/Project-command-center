create schema if not exists private;

create or replace function private.is_global_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.scope_type = 'global'
      and ur.role in ('owner', 'admin')
  );
$$;

revoke all on function private.is_global_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_global_admin() to authenticated;

do $$
declare
  r record;
begin
  for r in
    select c.table_name
    from information_schema.columns c
    join pg_class pc on pc.relname = c.table_name
    join pg_namespace pn on pn.oid = pc.relnamespace and pn.nspname = 'public'
    where c.table_schema = 'public'
      and c.column_name = 'user_id'
      and pc.relrowsecurity
  loop
    execute format('drop policy if exists "Global admins can select" on public.%I', r.table_name);
    execute format(
      'create policy "Global admins can select" on public.%I for select to authenticated using ((select private.is_global_admin()))',
      r.table_name
    );

    execute format('drop policy if exists "Global admins can insert" on public.%I', r.table_name);
    execute format(
      'create policy "Global admins can insert" on public.%I for insert to authenticated with check ((select private.is_global_admin()))',
      r.table_name
    );

    execute format('drop policy if exists "Global admins can update" on public.%I', r.table_name);
    execute format(
      'create policy "Global admins can update" on public.%I for update to authenticated using ((select private.is_global_admin())) with check ((select private.is_global_admin()))',
      r.table_name
    );

    execute format('drop policy if exists "Global admins can delete" on public.%I', r.table_name);
    execute format(
      'create policy "Global admins can delete" on public.%I for delete to authenticated using ((select private.is_global_admin()))',
      r.table_name
    );
  end loop;
end $$;
