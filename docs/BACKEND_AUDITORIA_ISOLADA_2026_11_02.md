# PCC — Auditoria backend independente (02/11/2026)

**Base:** QA `qa/integracao-g3-gie360-gemini-mobile-20261030`. **Branch:** `fix/backend-isolado-autorizacao-consistencia-20261102`. **PR:** #113 (rascunho).

## Alterações implementadas
- `application/app/(protected)/mutations.ts`: retornos da publicação de status e criação de diagnóstico deixam de expor mensagens SQL/Supabase brutas ao cliente. Mantida a verificação de propriedade (`user_id` e `project_id`) antes da operação.
- `application/scripts/test-backend-publication-guards.mjs`: teste estático de filtragem por workspace e sanitização de mensagens.
- `.github/workflows/ci.yml`: execução do teste automático na pipeline CI.

## Defeitos detectados e ainda não corrigidos
1. **Não-atomicidade (alto):** `publishProjectClientStatus` grava snapshot, revoga links e emite novo link em operações distintas. Uma falha de rede/SQL pode deixar o estado parcialmente actualizado e causar duplicação/conflito de versões sob concorrência. Requer RPC de base com transacção e lock por projecto, ou migração equivalente testada num Supabase isolado. Não tentar rollback manual dos dados em produção.
2. **Diagnóstico (alto):** `createClientDiagnosticRequest` revoga token anterior antes de garantir que o novo foi persistido. Requer emissão e revogação atómicas com idempotência.
3. **Workspace (alto; validar):** `requireUser` substitui `user.id` pelo ID do owner global quando o autenticado tem papel admin. Confirmar se isto é delegação intencional e rever RLS, logs de autoria e separação tenant antes de modificar.
4. **Aprovação humana (por validar):** confirmar nas RPC e gates que aprovação interna e externa não é inferida por status, download ou submissão.
5. **Offline (por validar):** ainda não existe prova de replay idempotente, resolução de conflitos, persistência após reinício ou sincronização em dispositivo real.
6. **APIs (parcial):** normalização de erros realizada nos fluxos identificados; restantes endpoints necessitam inventário e ensaios.
7. **Testes:** as verificações acrescentadas são estáticas; não substituem testes autenticados de concorrência, integridade, acesso cruzado e end-to-end.

## Próximos critérios de integração
- CI verde para SHA desta branch; logs e links anexados ao PR.
- DB de ensaio com dados artificiais e isolamento comprovado.
- Testes simultâneos de duas publicações e duas emissões de questionário: exactamente uma versão corrente e um token activo; sem períodos de indisponibilidade, duplicações ou aprovações implícitas.
- Testes A/B de utilizadores para autorização por workspace.
- Teste offline de gravação, reinício, reconexão e deduplicação.
- Revisão humana do diff e autorização explícita antes de qualquer merge ou deploy.

**Não executado:** migração, inserção de dados, alterações de Vercel/Supabase, merge ou deployment de produção. **Não declarar aceitação integral.**
