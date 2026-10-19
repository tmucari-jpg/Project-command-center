alter table public.projects
  add column if not exists review_cadence_days integer
    check (review_cadence_days is null or review_cadence_days between 1 and 365);

comment on column public.projects.review_cadence_days is
  'Cadencia parametrizada para calcular a proxima revisao. Nula preserva a data existente e impede o PCC de inventar uma cadencia.';
