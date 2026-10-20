update public.deliverables d
set owner_id = p.owner_id
from public.projects p
where d.project_id = p.id
  and d.owner_id is null
  and p.owner_id is not null;

comment on column public.deliverables.owner_id is
  'Responsável pelo resultado/entregável. Por defeito herda o responsável explícito do projecto, sem o substituir quando já estiver definido.';
