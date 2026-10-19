alter table public.factory_validations
  add column if not exists monetization_status text
    check (monetization_status is null or monetization_status in ('yes','potential','not_primary','insufficient')),
  add column if not exists monetization_rationale text,
  add column if not exists primary_return_type text
    check (primary_return_type is null or primary_return_type in (
      'financial','operational','productivity','adoption','strategic','risk_reduction','social_personal','mixed','undetermined'
    )),
  add column if not exists secondary_return_types text[] not null default '{}'::text[],
  add column if not exists return_summary text,
  add column if not exists return_evidence text,
  add column if not exists return_confidence text
    check (return_confidence is null or return_confidence in ('low','medium','high','verified'));

alter table public.factory_validations
  drop constraint if exists factory_validations_secondary_return_types_check;

alter table public.factory_validations
  add constraint factory_validations_secondary_return_types_check
  check (
    secondary_return_types <@ array[
      'financial','operational','productivity','adoption','strategic','risk_reduction','social_personal'
    ]::text[]
  );

comment on column public.factory_validations.monetization_status is
  'Avalia separadamente se existe caminho de monetizacao. not_primary significa que monetizacao nao e o objectivo principal, nao que seja impossivel.';
comment on column public.factory_validations.primary_return_type is
  'Natureza principal do valor esperado do projecto, independente de monetizacao.';
comment on column public.factory_validations.return_evidence is
  'Base factual ou documental usada para suportar a avaliacao do retorno; nao representa retorno ja realizado.';
