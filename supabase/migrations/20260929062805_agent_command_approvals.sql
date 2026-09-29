-- Proposal status changes are scoped to the authenticated owner. SELECT policy
-- already exists in the initial RLS migration and is required for UPDATE.
create policy "Users can update own AI commands"
on public.ai_commands for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
