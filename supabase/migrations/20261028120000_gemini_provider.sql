-- Additive provider registry update. No provider is created or enabled automatically.
alter table public.ai_provider_profiles
  drop constraint if exists ai_provider_profiles_provider_check;
alter table public.ai_provider_profiles
  add constraint ai_provider_profiles_provider_check
  check (provider in ('openai','moonshot','qwen_cloud','qwen_local','groq','gemini','huggingchat','koboldcpp_local','other'));
comment on column public.ai_provider_profiles.provider is
  'Gemini reuses the text-generation adapter; server credentials, free-tier confirmation and data-processing approval are required. No provider is enabled by this migration.';
