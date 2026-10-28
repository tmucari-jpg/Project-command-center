create table public.gie360_ai_requests (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.gie360_organizations(id),
 user_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 status text not null default 'reserved' check(status in('reserved','completed','failed')),
 provider text, source_refs text[] not null default '{}', error_code text
);
alter table public.gie360_ai_requests enable row level security;
revoke all on public.gie360_ai_requests from anon, authenticated;
grant select on public.gie360_ai_requests to authenticated;
create policy gie360_ai_audit_read on public.gie360_ai_requests for select to authenticated using(private.gie360_can_access(organization_id));
create index gie360_ai_rate on public.gie360_ai_requests(organization_id,created_at);

create function private.gie360_reserve_ai(p_organization_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_org public.gie360_organizations%rowtype; v_id uuid;
begin
 if auth.uid() is null or not private.gie360_can_access(p_organization_id) then raise exception 'GIE360_ORGANIZATION_FORBIDDEN'; end if;
 select * into v_org from public.gie360_organizations where id=p_organization_id for update;
 if not v_org.ai_cloud_authorized or not v_org.contract_approved or not ('ai'=any(v_org.approved_modules)) or not exists(
   select 1 from public.pcc_product_packages where code=v_org.package_code and 'ai'=any(modules)
 ) then raise exception 'GIE360_AI_SCOPE_NOT_APPROVED'; end if;
 if (select count(*) from public.gie360_ai_requests where organization_id=p_organization_id and created_at>now()-interval '1 minute')>=10 then
   raise exception 'GIE360_AI_RATE_LIMIT'; end if;
 insert into public.gie360_ai_requests(organization_id,user_id) values(p_organization_id,auth.uid()) returning id into v_id;
 return v_id;
end;
$$;
revoke all on function private.gie360_reserve_ai(uuid) from public,anon;
grant execute on function private.gie360_reserve_ai(uuid) to authenticated;
create function public.gie360_reserve_ai(p_organization_id uuid)
returns uuid language sql security invoker set search_path='' as $$ select private.gie360_reserve_ai(p_organization_id); $$;
revoke all on function public.gie360_reserve_ai(uuid) from public,anon;
grant execute on function public.gie360_reserve_ai(uuid) to authenticated;
