# PCC — Matriz única de reconciliação sem retrabalho (02/11/2026)

**Work:** PR #112 `consolidation/pcc-operacional-20261102`. **Backend independente:** PR #113 `fix/backend-isolado-autorizacao-consistencia-20261102`. **Base comum:** `qa/integracao-g3-gie360-gemini-mobile-20261030`, commit `9778b800e50ba7b37313e05fbb357f69413b99ca`.

## Comparação verificável
- Work vs. QA: 121 commits, alterações funcionais amplas; relatório `docs/qa/20261102/RELATORIO_GO_NO_GO.md`. CI #1152 **success** (código testado `8386f66...`); execução isolada #64 **failure** no gate de dependências moderate, embora verificações de backend/browser descritas no relatório tenham passado.
- Backend independente vs. QA: 4 commits, 4 ficheiros: `.github/workflows/ci.yml`, `application/app/(protected)/mutations.ts`, `application/scripts/test-backend-publication-guards.mjs`, `docs/BACKEND_AUDITORIA_ISOLADA_2026_11_02.md`. CI #1151 **success**.
- Comparação directa: branches divergentes, 121 commits do Work não estão na branch independente; 4 commits exclusivos da branch independente não estão no Work. Não executar merge bruto.

## Matriz única de pendências e integração
| Prioridade | Área | Work comprovado/existente | Contributo exclusivo independente | Diferença/defeito e acção mínima | Evidência/estado |
| --- | --- | --- | --- | --- | --- |
| P0 | Identidade/workspace | `resolveWorkspaceUser`, fronteira PCC/GIE360, testes RLS/Auth | Nenhuma correcção do comportamento | **Não copiar `auth.ts` antigo**; manter Work, revisar autoria versus owner delegado e sessão expirada | `application/lib/auth.ts`, `tests/workspace-context.test.ts`; CI #1152 |
| P0 | Publicação status cliente | Sequência snapshot → revogar links → emitir link continua em `mutations.ts` | Mensagens de erro genéricas, sem atomicidade | Criar RPC transaccional com lock por projecto + idempotência; validar dois pedidos concorrentes e falha injectada; sem migração de produção | Código das duas branches; **não corrigido por nenhuma** |
| P0 | Emissão diagnóstico | Work introduz aprovação explícita e transição atómica | Nenhuma correcção transaccional | **Preservar Work**; não substituir com fluxo antigo de PR #113 | `mutations.ts`, `operational-atomic.test.ts`; backend isolado |
| P0 | Objectivos/acções | Conversão de fábrica atómica; estrutura operacional ainda vulnerável a concorrência | Apenas análise | RPC idempotente para preparação operacional, testar dois pedidos simultâneos | Relatório Work circuito B: bloqueado |
| P0 | G3/documentos | Aprovação atómica e PDF/DOCX reais em ensaio | Apenas análise | Criar arquivo específico G3, remover termos fixos e aprovar conteúdo, garantir paridade Word/PDF | Relatório Work circuito C: falhou |
| P0 | Segurança e divulgação | RLS/limites de partilha no Work | Mensagens genéricas em publicação de status e diagnóstico | Avaliar **cherry-pick manual apenas das 6 substituições** de mensagens em `mutations.ts`; verificar se Work já cobre cada uma. Testar erros de DB de forma isolada. | PR #113: CI #1151 passou; teste é estático |
| P1 | Offline | `apply_offline_item_atomic`, fila, UUID, reenvio e browser smoke | Nenhuma implementação adicional | Não repetir testes já executados; só validar em dispositivo físico e tratar alterações novas | Relatório Work circuito F e `tests/offline-atomic.test.ts` |
| P1 | Gemini | Simulações de falha/retry/fallback | Nenhuma implementação | Testar chamada real com conta gratuita autorizada; sem inventar sucesso | Work circuito E bloqueado |
| P1 | Publicação externa | GIE360° portal, questionário, submissão e encaminhamento parciais reais | Nenhuma implementação | Completar ensaio encadeado de pré-visualização → aprovação → link → resposta → encaminhamento | Work circuito D bloqueado |
| P1 | Testes backend | CI, testes DB, integração browser, documentos e offline | `test-backend-publication-guards.mjs` estático | Integrar apenas assertions não existentes; melhorar para erros simulados sem repetir suite Work | CI #1151 e #1152 |
| P0 | Dependências e release | CI #1152 sucesso, isolada #64 falhou em 8 moderate | Sem alteração de dependências | Resolver gate moderate, repetir apenas gate afectado; NO-GO até aceite integral | GitHub Actions #64, #1152 |

## Plano mínimo de integração — SEM MERGE
1. Fixar SHA do Work para revisão e comparar `mutations.ts` por função, não substituir o ficheiro inteiro.
2. Portar apenas as mensagens de erro genéricas **não implementadas** e o teste complementar, após confirmar que não interfere com a autorização de Work.
3. Tratar atomicidade do status do cliente em patch próprio à parte, com RPC e rollback em DB descartável; não considerar esta funcionalidade concluída agora.
4. Preservar as correcções transaccionais G3/diagnóstico/offline e todos os testes de browser/DB do Work, sem duplicação.
5. Manter NO-GO até os bloqueios P0 terem evidências de execução; produção, QA do Work e PR #112 não foram modificados por esta reconciliação.

**Nenhuma integração/merge/deploy/migração foi executada.**
