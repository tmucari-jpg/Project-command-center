# PCC — Relatório de prontidão operacional

Data: 2 de Novembro de 2026. Parecer: **NO-GO**. Produção, dados operacionais, domínios e deployments não foram alterados. Não foi efectuado merge em main. Este parecer não é uma aprovação humana de lançamento.

A consolidação recupera funcionalidades que estavam fora da branch QA indicada e corrige falhas comprovadas em aprovações, emissão de links e sincronização. Os testes locais passam; os seis circuitos operacionais completos ainda não estão aprovados. A Carta G3 é uma minuta, sem arquivo próprio nesta rota. Faltam ambiente Supabase isolado, autenticação real, Gemini real e validação física mobile/offline.

## Versões verificadas

| Referência | Versão observada | Evidência |
| --- | --- | --- |
| main | d794bdad7cba02dcb93a4095480af2ca36af7ec0 | Comparação GitHub e deployment por alias |
| QA indicada | 9778b800e50ba7b37313e05fbb357f69413b99ca | 34 commits à frente de main, sem commits em falta de main |
| Trabalho funcional recuperado | recovery/gie360-20261028, commit 491251f | Histórico Git e árvore recuperada |
| Produção efectivamente associada ao alias | dpl_AB1cRHZU1wuAu8j7QHzA8J2fxwhY, main d794bdad… | evidence/production_alias.json; alias project-command-center-seven-xi.vercel.app |
| Consolidação proposta | consolidation/pcc-operacional-20261102 | PR em rascunho; sem publicação automática nesta branch |
| Código submetido aos testes | SHA256 b0d6e23fe651e8e21b202d1e8c5d72fd3b4545ab393f5a4127a4d7bc1d295e56 | evidence/source-binding.json, hashes de 359 ficheiros |

A branch QA continha gates documentais e correcções de validade de tokens, mas não continha o trabalho funcional da recovery: DOCX/PDF, portal GIE360°, Gemini e acções derivadas. A integração preserva ambos os históricos. O único conflito textual foi no snapshot comercial; foram preservados o logótipo incorporado da QA e o conteúdo GIE360° da recovery.

## Condições de execução

Foi usada uma cópia local isolada, sem ficheiros de ambiente de produção. PGlite executou SQL real com tabelas e identidades de ensaio; não representa GoTrue/Auth, PostgREST nem Storage do Supabase. Os testes de rotas com mocks estão identificados como tal. Respostas Gemini simuladas não são respostas reais do fornecedor.

O projecto Supabase PCC disponível só apresenta a branch main. O outro projecto activo pertence a outro produto e não foi reutilizado. Não foi criada uma branch Supabase com custo horário. Não foram copiadas chaves de produção, aplicadas migrações remotas ou escritos dados de ensaio na base operacional.

A tentativa do smoke integrado parou antes de qualquer ligação: falta NEXT_PUBLIC_SUPABASE_URL local. Não há Docker nem backend Supabase local disponível. O download de Chromium pelo Playwright falhou com arquivo truncado; não foi executado browser E2E nem ensaio físico. A disponibilidade de ferramentas não foi tratada como falha funcional da aplicação.

## Circuitos completos

| Circuito | Estado final | Motivo |
| --- | --- | --- |
| A Login → permissões → dados | **BLOQUEADO** | Sem Supabase/Auth isolado e utilizadores reais de ensaio; testes locais de fronteira de identidade e RLS passaram |
| B Diagnóstico → projecto → objectivos → acções | **BLOQUEADO** | Conversão SQL e geração recuperadas; falta execução completa por UI/Auth. Persistem escritas separadas e deduplicação vulnerável à concorrência na preparação operacional |
| C Diagnóstico validado → G3 → DOCX/PDF → arquivo → download | **FALHOU** | A rota produz uma minuta com campos contratuais fixos pendentes e não arquiva a carta; o circuito oficial pedido está incompleto |
| D GIE360° → questionário → revisão → aprovação → link → respostas → encaminhamento | **BLOQUEADO** | Emissão e aprovação agora atómicas e SQL do portal testado; falta ensaio encadeado com identidade e dados persistidos no Supabase isolado |
| E Gemini → resposta real → falha → recuperação | **BLOQUEADO** | Probe real bloqueada por chave/modelo/confirmação de plano gratuito e tratamento de dados ausentes neste ambiente; recuperação simulada passou |
| F Offline → criar → fechar/reabrir → sincronizar → confirmar no Supabase | **BLOQUEADO** | SQL transaccional passou; persistência IndexedDB em browser, reabertura física e confirmação Supabase não executadas |

## Registo detalhado dos ensaios

Os UUIDs indicados abaixo são constantes de testes isolados. Não são identificadores de operações realizadas na produção ou num Supabase de ensaio. Aprovações declaradas em fixtures exercitam transições; não substituem decisões humanas.

### A — Identidade e dados

- Rota/função: loginAction em app/auth/actions.ts; isGIE360Client/resolveWorkspaceUser; SQL do portal GIE360°.
- Dados: owner/manager 10000000-0000-4000-8000-000000000001, cliente …0002, terceiro …0003; tabelas locais criadas pelos testes.
- Esperado: cliente GIE360° não herda o PCC; outro cliente não lê nem escreve dados da empresa; indisponibilidade da tabela de identidade bloqueia o acesso.
- Real: testes locais de fronteira, leitura cruzada, escrita proibida e identidade indisponível passaram. Corrigida a regra que tratava tabela de identidade ausente como ausência de associação GIE360°.
- Evidência: tests/pcc-access.test.ts, tests/gie360-database.test.ts, tests/gie360-import-rls.test.ts, evidence/vitest-results.json.
- Estado: **APROVADO apenas no âmbito local testado**. Login real, refresh/expiração de sessão e leitura via Supabase: **BLOQUEADO**.
- Necessário: backend isolado e dois utilizadores reais; confirmar 401 sem sessão, bloqueio de cliente interno, acesso autorizado e negação entre empresas via UI e REST.

### B — Conversão e acções

- Rota/função: convert_factory_case_atomic; ensureProjectOperationalStructure; prepareProjectOperationalStructure; criação de projecto.
- Dados: caso local 20000000-0000-4000-8000-000000000001, decisão de ensaio explícita, validação viable; projecto Gestor de Vendas em fixtures de autonomia, sem medições inventadas.
- Esperado: falha ao ligar caso/projecto reverte projecto e decisão; repetir conversão mantém um só projecto; objectivo e entregáveis geram trabalho rastreável.
- Real: SQL de conversão reverteu a criação com falha injectada, negou risco bloqueante e repetiu sem duplicar projecto. Código de geração de acções recuperado da recovery. O teste de conversão não cobre toda a preparação operacional nem cliques simultâneos.
- Evidência: tests/factory-atomic.test.ts, tests/action-autonomy.test.ts, tests/project-autonomy.test.ts; evidence/vitest-results.json.
- Estado: rollback e idempotência de conversão **APROVADOS localmente**; circuito integral **BLOQUEADO**.
- Correcção ainda necessária: tornar criação/ligação de objectivo, entregável, acções e métrica uma operação transaccional e serializada. A comparação de títulos antes de INSERT não garante ausência de duplicados sob concorrência. Não declarar este defeito resolvido.

### C — G3 e documentos

- Rota/função: approve_commitment_atomic, approveCommitmentInternally, validateCommitmentByClient; GET /api/projects/[id]/commitment-draft?format=docx|pdf; finalize_generated_deliverable; download genérico de artefactos.
- Dados: projecto 20000000-0000-4000-8000-000000000001, baseline 30000000-0000-4000-8000-000000000001, Empresa QA Sintética, âmbito Diagnóstico sintético, custo Sem custo adicional.
- Esperado: negar geração antes da aprovação interna; gerar formatos nativos coerentes; aprovações e auditoria não ficam parciais; carta oficial persistida e descarregável a partir do arquivo autorizado.
- Real: 409 para rascunho sem aprovação e 401 sem sessão nos testes de rota; fixture com aprovação interna gerou DOCX ZIP nativo e PDF, ambos legíveis. Seis campos de ensaio coincidem nos dois. Inspecção visual de uma página de cada formato realizada. Teste com falha na auditoria reverteu aprovação e estado do projecto.
- Limitação factual: as leituras da rota G3 foram substituídas por fixtures; não houve sessão real nem download HTTP autenticado em servidor. A rota commitment-draft faz render e devolve bytes, mas não grava arquivo. Partes, preço/pagamentos, cronograma e termos jurídicos são textos fixos pendentes. Estes ficheiros não são prova de carta oficial concluída.
- Evidência: tests/commitment-document.test.ts, tests/commitment-draft-route.test.ts, tests/operational-atomic.test.ts; evidence/documents/Carta_G3_ENSAIO_SINTETICO.docx e .pdf; document-content-verification.json. O arquivo genérico tem testes próprios tests/artifact-archive.test.ts, sem comprovar que G3 o usa.
- Estado: formatos/render e rollback **APROVADOS no âmbito local**; Carta oficial com arquivo **FALHOU**.
- Correcção necessária: ligar G3 a snapshot imutável da baseline e termos efectivamente aprovados, arquivo persistente dos dois formatos com hashes e download autorizado. Não preencher termos em falta por inferência. saveCommitmentBaseline ainda tem duas escritas; agora acusa falha no projecto, mas ainda requer atomicidade para rollback integral.

### D — GIE360° e partilha

- Rota/função: createClientDiagnosticRequest → issue_reviewed_diagnostic_atomic; GET /client-diagnostic/[token]; client_diagnostic_lookup/submit; gie360_save_assessment e encaminhamento ao caso original.
- Dados: destinatário sintético, Empresa QA, contexto de ensaio, hashes a/b/c de 64 caracteres, validade de sete dias; respostas sector Agricultura/Comércio, custos Não sei, resultado Organizar a gestão.
- Esperado: revisão explícita antes de emissão; falha ao arquivar aprovação preserva link anterior; tokens expirados/revogados não revelam questionário; resposta repetida não duplica submissão ou notificação; submissão permanece declarada.
- Real: testes SQL executaram rollback de emissão, manutenção do link anterior, rejeição sem revisão e por terceiro; validade temporal e negação com rate-limit simulado passaram. O teste de lookup usa implementação real e uma função de rate-limit controlada: não mede o contador real sob concorrência. SQL do portal validou conflito de revisão, submissão única, encaminhamento e rollback com falha de notificação.
- Evidência: tests/operational-atomic.test.ts, tests/diagnostic-expiry-database.test.ts, tests/diagnostic-link-validity.test.ts, tests/gie360-database.test.ts; evidence/vitest-results.json.
- Estado: casos SQL locais **APROVADOS**; circuito UI/Auth/link público/Supabase **BLOQUEADO**.
- Necessário: pré-visualização e aprovação feitas pelo responsável no ambiente isolado, submissão externa real, confirmação dos IDs de pedido/aprovação/resposta/caso e do contador real de rate-limit.

### E — Gemini

- Rota/função: requestAIText, generateAssistWithFallback; POST /api/ai/assist; scripts/test-gemini-live.ts.
- Dados: prompt sintético Responde apenas OK; cenário vendas 80+40 MZN, 10 leads, zero conversões e lucro ausente. Recuperação com HTTP 503, timeout, 429, 403 e conteúdo vazio simulados.
- Esperado: resposta real útil, dados em falta preservados, falha explícita, retry/fallback limitado a fornecedores gratuitos autorizados, sem reactivar perfis desactivados.
- Real: testes simulados de retries, API nativa, quota, timeout, endpoint hostil, custo e fallback passaram. Probe real não foi enviada por falta de configuração local. Uma primeira chamada por tsx encontrou IPC EPERM; a alternativa node --import tsx executou o probe e registou correctamente blocked.
- Evidência: tests/gemini-provider.test.ts, tests/ai-assist-router.test.ts, tests/ai-runtime.test.ts; evidence/gemini-live.json e gemini-live.log.
- Estado: recuperação simulada **APROVADA**; resposta real e recuperação encadeada **BLOQUEADAS**.
- Necessário: configurar chave por mecanismo seguro no ambiente isolado, modelo disponível e plano gratuito confirmado; executar resposta, indisponibilidade controlada e nova resposta. Não copiar chaves ou respostas fictícias para o relatório.

### F — Offline e sincronização

- Rota/função: POST /api/offline/sync → apply_offline_item_atomic; syncOfflineQueue; public/offline-app.js; GET /api/offline/bootstrap.
- Dados: ideia e acção sintéticas, projecto 30000000-0000-4000-8000-000000000001, operações 20000000-…0001 a …0005, alteração Próximo passo confirmado; recibo/auditoria com falha injectada.
- Esperado: negócio e recibo confirmados na mesma transacção; retry não duplica; colisão de conteúdo ou acesso cruzado falha; dados não confirmados continuam na fila; lotes respeitam o máximo de 100.
- Real: SQL real comprovou rollback de negócio/recibo e de intake/eventos, repetição sem duplicados, rejeição de conteúdo diferente e de outro utilizador, escrita de próximo passo e negação de proprietário/estado forjados. A rota valida dados e origem, usa whitelist e SECURITY INVOKER. Cliente e shell passaram a enviar lotes de 100 e a indicar pendências, sem mensagem falsa de conclusão.
- Evidência: tests/offline-atomic.test.ts; código de sync e shell; evidence/vitest-results.json. As alterações de IndexedDB/lotes/mensagem só têm typecheck/lint nesta sessão; não existe prova de browser para esses comportamentos.
- Estado: transacção SQL **APROVADA**; fechar/reabrir, persistência real, conflito entre dispositivos e confirmação Supabase **BLOQUEADOS**.
- Necessário: executar captura sem rede num dispositivo, fechar aplicação/processo, reabrir, restaurar rede, confirmar IDs na base de ensaio, repetir sync e verificar fila vazia e ausência de duplicados.

## Matriz de correcções e pendências

| Componente | Problema | Correcção proposta ou realizada | Teste e resultado | Estado |
| --- | --- | --- | --- | --- |
| Composição da release | QA sem funcionalidades existentes na recovery | Integradas as duas linhas, preservando arquitectura | 202 testes locais passaram | APROVADO localmente |
| Identidade | Tabela GIE360° ausente permitia continuar como interno | Falha passa a bloquear acesso | pcc-access.test.ts | APROVADO localmente |
| Aprovação G3 | Aprovação, projecto e evento separados | RPC SECURITY INVOKER com locks e transacção | Falha na auditoria reverte tudo | APROVADO localmente |
| Link de diagnóstico | Revogação/criação/auditoria separadas | RPC atómica com revisão explícita | Link antigo preservado após falha | APROVADO localmente |
| Sync offline | Negócio gravado sem recibo; intake sem eventos | RPC por operação, recibo bloqueado, whitelist e RLS | Rollback, retry e acesso cruzado passaram | APROVADO localmente |
| Cliente offline | Mais de 100 entradas e falsa mensagem de conclusão | Lotes, retenção de entradas e mensagem de pendência | Build/typecheck/lint; browser indisponível | BLOQUEADO para aceite funcional |
| Projectos e acções | Preparação não atómica e concorrência na deduplicação | Requer RPC para preparação operacional completa | Ainda não executado | FALHOU na revisão de código |
| Baseline G3 | Save em duas escritas | Erro do projecto deixa de ser ignorado; rollback total pendente | Revisão de código | FALHOU na atomicidade integral |
| Carta oficial | Minuta com termos fixos pendentes, sem arquivo G3 | Requer termos aprovados + snapshot/arquivo/download | PDF/DOCX locais válidos, circuito oficial incompleto | FALHOU |
| Gemini | Sem configuração real isolada | Recuperação existente incorporada; falta probe real | Simulados passaram; live blocked | BLOQUEADO |
| Segurança Supabase | Avisos de funções privilegiadas e protecção de passwords | Revisão contextual; nenhuma alteração em produção | Advisors read-only; RLS activo nas oito tabelas consultadas | BLOQUEADO para aceite integral |
| Migrações | Produção tem histórico diferente do repositório | Reconciliar histórico/esquema antes de aplicar em ensaio | Só catálogo remoto lido | BLOQUEADO |

## Verificações técnicas e evidências

- 202 testes, zero falhas; 49 ficheiros de teste. O JSON do Vitest conta suites internas de forma diferente de ficheiros. Nenhum destes totais equivale a seis circuitos E2E aprovados.
- Typecheck: exit 0. Lint: exit 0, zero erros e cinco avisos de variáveis não utilizadas, registados no log.
- Build de produção local: exit 0; BUILD_ID HMjQyPiuwn4lR4IJWM8uR, manifest de prerender presente. Não é um deployment.
- UI standard e ícones: exit 0. Gate sintáctico: 12 cenários passaram; não verifica autenticidade das provas.
- npm audit de dependências de produção: exit 0 no limiar high; zero high/critical e oito moderate, sobretudo cadeia transitiva ExcelJS/archiver/minimatch. Não foi aplicada sugestão de downgrade sem validação.
- Advisors: quatro funções SECURITY DEFINER executáveis anonimamente e três por authenticated, mais aviso de protecção de palavras-passe comprometidas desactivada. As funções públicas de token podem ter exposição intencional; o aviso exige revisão do corpo e limites, não justifica revogação cega. Referências: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable e https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable .
- Catálogo consultado: RLS activo em projects, actions, project_commitment_baselines, gie360_assessments, gie360_submissions, pcc_external_share_approvals, generated_deliverable_artifacts e sync_queue. RLS activo não prova a correcção de todas as políticas.
- Inventário estático: 21 rotas/métodos HTTP em rotas-http.csv e 83 Server Actions em funcoes-servidor.csv. Os inventários não afirmam execução de cada entrada.

## Condições concretas para mudar o parecer

1. Corrigir atomicidade da preparação operacional e da gravação da baseline, e concluir o arquivo específico de G3 com os termos reais aprovados.
2. Disponibilizar backend Supabase isolado existente ou local, sem custos adicionais, com Auth/Storage e migrações reconciliadas; nenhum teste de escrita em produção.
3. Configurar o ambiente isolado e o Gemini gratuito pelo mecanismo seguro do ambiente. Não inserir segredos no PR, relatório ou conversa.
4. Executar A–F pelo PCC e guardar URLs, hashes, IDs de registos e versão exacta; executar casos negativos e repetir para ausência de duplicados.
5. Validar instalação, permissões, downloads, perda de ligação e reabertura num dispositivo físico.
6. Rever as provas e obter decisão humana explícita para a única publicação. Este PR em rascunho não autoriza merge nem lançamento.

**Decisão final desta execução: NO-GO.** Existem correcções implementadas e testes locais verificáveis, mas não existe prova de operação integral nem de Carta oficial completa.
