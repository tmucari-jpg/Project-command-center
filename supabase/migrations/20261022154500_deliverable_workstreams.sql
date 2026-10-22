-- Organiza entregáveis por vertente sem separar o projecto em módulos isolados.
alter table public.deliverables
  add column if not exists workstream text not null default 'general';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'deliverables_workstream_check'
      and conrelid = 'public.deliverables'::regclass
  ) then
    alter table public.deliverables
      add constraint deliverables_workstream_check
      check (workstream in (
        'general',
        'commercial',
        'financial',
        'operational',
        'governance',
        'technical',
        'other'
      ));
  end if;
end $$;

create index if not exists deliverables_user_workstream_project_idx
  on public.deliverables (user_id, workstream, project_id);
