-- Immutable final deliverables and evidence archives.
-- The official PCC archive is append-only after delivery: any later change must
-- be represented as a new deliverable version that supersedes the prior one.

alter table public.deliverables
  add column if not exists artifact_type text not null default 'other',
  add column if not exists artifact_url text,
  add column if not exists artifact_reference text,
  add column if not exists artifact_version integer not null default 1,
  add column if not exists supersedes_deliverable_id uuid references public.deliverables(id) on delete restrict,
  add column if not exists locked_at timestamptz;

alter table public.deliverables
  drop constraint if exists deliverables_artifact_type_check;

alter table public.deliverables
  add constraint deliverables_artifact_type_check
  check (
    artifact_type in (
      'document',
      'spreadsheet',
      'presentation',
      'pdf',
      'website',
      'application',
      'dashboard',
      'api',
      'dataset',
      'prototype',
      'other'
    )
  );

alter table public.deliverables
  drop constraint if exists deliverables_artifact_version_check;

alter table public.deliverables
  add constraint deliverables_artifact_version_check
  check (artifact_version >= 1);

create unique index if not exists deliverables_single_successor_idx
  on public.deliverables (supersedes_deliverable_id)
  where supersedes_deliverable_id is not null;

create index if not exists deliverables_locked_at_idx
  on public.deliverables (locked_at)
  where locked_at is not null;

update public.deliverables
set locked_at = coalesce(updated_at, created_at, now())
where status = 'completed'
  and locked_at is null;

create or replace function private.protect_final_deliverable_archive()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'completed' or old.locked_at is not null then
      raise exception 'Entregável final bloqueado: crie uma nova versão no PCC em vez de alterar ou apagar o arquivo oficial.'
        using errcode = '23514';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and (old.status = 'completed' or old.locked_at is not null) then
    raise exception 'Entregável final bloqueado: crie uma nova versão no PCC em vez de alterar o arquivo oficial.'
      using errcode = '23514';
  end if;

  if new.status = 'completed' then
    if tg_op = 'INSERT' then
      raise exception 'Um entregável não pode nascer como concluído. Registe o resultado e a evidência antes de o entregar.'
        using errcode = '23514';
    end if;

    if new.artifact_type in ('website', 'application', 'dashboard', 'api') then
      if nullif(btrim(new.artifact_url), '') is null then
        raise exception 'Entregáveis digitais executáveis exigem um URL oficial antes do fecho.'
          using errcode = '23514';
      end if;
      if nullif(btrim(new.artifact_reference), '') is null then
        raise exception 'Entregáveis digitais executáveis exigem uma referência imutável de versão (deploy, commit ou release).'
          using errcode = '23514';
      end if;
    end if;

    if not exists (
      select 1
      from public.evidence e
      where e.deliverable_id = new.id
        and e.user_id = new.user_id
    ) then
      raise exception 'O entregável precisa de evidência associada antes de ser bloqueado como entregue.'
        using errcode = '23514';
    end if;

    new.locked_at := coalesce(new.locked_at, now());
  else
    new.locked_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_final_deliverable_archive on public.deliverables;
create trigger protect_final_deliverable_archive
before insert or update or delete on public.deliverables
for each row execute function private.protect_final_deliverable_archive();

create or replace function private.protect_locked_deliverable_evidence()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  old_deliverable uuid;
  new_deliverable uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    old_deliverable := old.deliverable_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    new_deliverable := new.deliverable_id;
  end if;

  if old_deliverable is not null and exists (
    select 1
    from public.deliverables d
    where d.id = old_deliverable
      and (d.status = 'completed' or d.locked_at is not null)
  ) then
    raise exception 'A evidência de um entregável final está bloqueada e deve permanecer no histórico.'
      using errcode = '23514';
  end if;

  if new_deliverable is not null and exists (
    select 1
    from public.deliverables d
    where d.id = new_deliverable
      and (d.status = 'completed' or d.locked_at is not null)
  ) then
    raise exception 'Não é permitido alterar o arquivo de evidências de um entregável final. Crie uma nova versão do entregável.'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_locked_deliverable_evidence on public.evidence;
create trigger protect_locked_deliverable_evidence
before insert or update or delete on public.evidence
for each row execute function private.protect_locked_deliverable_evidence();

comment on column public.deliverables.artifact_reference is
  'Identificador imutável da versão oficial: commit SHA, deployment ID, release ID, hash ou referência equivalente.';

comment on column public.deliverables.locked_at is
  'Data em que o entregável passou a arquivo oficial imutável do PCC.';
