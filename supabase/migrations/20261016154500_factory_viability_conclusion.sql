alter table public.factory_validations
  add column if not exists viability_status text,
  add column if not exists viability_summary text,
  add column if not exists conditions_to_proceed text,
  add column if not exists missing_information text;

alter table public.factory_validations
  drop constraint if exists factory_validations_viability_status_check;

alter table public.factory_validations
  add constraint factory_validations_viability_status_check
  check (
    viability_status is null
    or viability_status = any (
      array['viable'::text, 'conditional'::text, 'not_viable'::text, 'insufficient'::text]
    )
  );

comment on column public.factory_validations.viability_status is
  'Explicit PCC project viability conclusion before the human decision.';

comment on column public.factory_validations.viability_summary is
  'Evidence-based explanation supporting the project viability conclusion.';

comment on column public.factory_validations.conditions_to_proceed is
  'Conditions that must be met before resources are committed.';

comment on column public.factory_validations.missing_information is
  'Information still required when viability cannot yet be established.';
