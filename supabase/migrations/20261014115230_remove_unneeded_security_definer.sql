drop policy if exists "Users can view own api rate limits" on public.api_rate_limits;
create policy "Users can view own api rate limits"
on public.api_rate_limits
for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can create own api rate limits" on public.api_rate_limits;
create policy "Users can create own api rate limits"
on public.api_rate_limits
for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Users can update own api rate limits" on public.api_rate_limits;
create policy "Users can update own api rate limits"
on public.api_rate_limits
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

alter function public.check_brave_search_rate_limit() security invoker;
alter function public.set_next_action(uuid) security invoker;
