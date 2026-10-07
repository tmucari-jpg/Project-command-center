-- ============================================================
-- FACTORY LIBRARY MVP
-- Reusable assets + automatic low-risk lessons from completed projects.
-- Behaviour-changing assets require explicit approval.
-- ============================================================

create table if not exists public.factory_library_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,

  asset_type text not null
    check (asset_type in ('component','workflow','template','prompt','strategy','lesson')),
  title text not null,
  summary text,
  content jsonb not null default '{}'::jsonb,

  source_type text
    check (source_type is null or source_type in ('project','factory_case','execution_arena','automation','manual')),
  source_id uuid,

  behavior_changing boolean not null default false,
  status text not null default 'candidate'
    check (status in ('candidate','approved','rejected','archived')),

  usage_count integer not null default 0 check (usage_count >= 0),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_factory_library_items_user_id
  on public.factory_library_items(user_id);
create index if not exists idx_factory_library_items_type
  on public.factory_library_items(asset_type);
create index if not exists idx_factory_library_items_status
  on public.factory_library_items(status);
create index if not exists idx_factory_library_items_source
  on public.factory_library_items(source_type, source_id);

alter table public.factory_library_items enable row level security;

drop policy if exists "Users can view own factory library items"
  on public.factory_library_items;
create policy "Users can view own factory library items"
  on public.factory_library_items
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can create own factory library items"
  on public.factory_library_items;
create policy "Users can create own factory library items"
  on public.factory_library_items
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update own factory library items"
  on public.factory_library_items;
create policy "Users can update own factory library items"
  on public.factory_library_items
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists update_factory_library_items_updated_at
  on public.factory_library_items;
create trigger update_factory_library_items_updated_at
  before update on public.factory_library_items
  for each row execute function public.update_updated_at_column();

create or replace function public.capture_completed_project_lesson()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed'
     and old.status is distinct from new.status
     and not exists (
       select 1
       from public.factory_library_items i
       where i.user_id = new.user_id
         and i.source_type = 'project'
         and i.source_id = new.id
         and i.asset_type = 'lesson'
     )
  then
    insert into public.factory_library_items (
      user_id,
      asset_type,
      title,
      summary,
      content,
      source_type,
      source_id,
      behavior_changing,
      status
    )
    values (
      new.user_id,
      'lesson',
      'Lição: ' || new.title,
      coalesce(new.expected_result, new.description, 'Snapshot automático de projecto concluído.'),
      jsonb_build_object(
        'project_title', new.title,
        'description', new.description,
        'expected_result', new.expected_result,
        'progress', new.progress,
        'notes', new.notes,
        'captured_at', now()
      ),
      'project',
      new.id,
      false,
      'approved'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists capture_completed_project_lesson_trigger on public.projects;
create trigger capture_completed_project_lesson_trigger
  after update of status on public.projects
  for each row
  execute function public.capture_completed_project_lesson();

revoke all on function public.capture_completed_project_lesson()
from public, anon, authenticated;
