-- Client identities cannot use the public Data API to create a PCC workspace.
-- This restrictive overlay preserves every existing manager policy and all rows.
create or replace function private.gie360_is_client()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.gie360_memberships where client_user_id = auth.uid()
  );
$$;
revoke all on function private.gie360_is_client() from public, anon;
grant execute on function private.gie360_is_client() to authenticated;

do $$
declare r record;
begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relrowsecurity
      and c.relname not like 'gie360\_%' escape '\'
      and c.relname not in ('pcc_products','pcc_product_packages')
  loop
    execute format('create policy gie360_no_management on public.%I as restrictive for all to authenticated using (not (select private.gie360_is_client())) with check (not (select private.gie360_is_client()))', r.relname);
  end loop;
end;
$$;
