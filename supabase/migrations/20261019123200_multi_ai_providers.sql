alter table public.ai_provider_profiles
  drop constraint if exists ai_provider_profiles_provider_check;

alter table public.ai_provider_profiles
  add constraint ai_provider_profiles_provider_check
  check (provider in ('openai','moonshot','qwen_cloud','qwen_local','groq','huggingchat','koboldcpp_local','other'));

comment on column public.ai_provider_profiles.provider is
  'Fornecedores suportados pelo PCC. moonshot representa Kimi API; qwen_cloud e qwen_local permanecem separados.';
