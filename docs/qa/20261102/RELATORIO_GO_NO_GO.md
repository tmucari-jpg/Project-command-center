# PCC — Relatório GO/NO-GO de lançamento

**Parecer: NO-GO.** Data: 2 de Novembro de 2026. PR em rascunho: https://github.com/tmucari-jpg/Project-command-center/pull/112 . Branch: `consolidation/pcc-operacional-20261102`.

Foram integradas as funcionalidades existentes da recovery e corrigidas as transacções de aprovação G3, emissão de links e sincronização. Há agora provas reais de Auth, RLS, Storage, geração/download de documentos, GIE360° e persistência offline num browser de ensaio. O PCC ainda não satisfaz a aceitação integral: faltam arquivo oficial específico de G3, atomicidade da preparação operacional e da gravação da baseline, circuito externo completo de partilha, resposta real do Gemini e validação física mobile. O gate de segurança do ensaio continua a falhar com oito vulnerabilidades moderadas.

A produção não foi alterada. Não houve merge em main, promoção de deployment, migração remota, escrita de ensaio em produção ou criação de serviços pagos.

## Versão e isolamento

- main e produção: `d794bdad7cba02dcb93a4095480af2ca36af7ec0`; alias `project-command-center-seven-xi.vercel.app`, deployment `dpl_AB1cRHZU1wuAu8j7QHzA8J2fxwhY`.
- QA indicada: `9778b800e50ba7b37313e05fbb357f69413b99ca`, 34 commits à frente de main. Não continha o trabalho funcional da recovery.
- Funcionalidades recuperadas de `recovery/gie360-20261028`: `491251fa56e319ee60939e5175fec828a3727883`. A primeira consolidação corresponde à árvore `444cbc6f9714d32eacd2ebc8f64c7a3bbbc49555`, confirmada igual à árvore local.
- Prova de integração recolhida: run 64, https://github.com/tmucari-jpg/Project-command-center/actions/runs/41416543119 ; head `8386f66a0cc06e0aedc47535483a1f11b877bb52`, commit de merge temporário testado `d1a9047d59e268de6d650bd7e22ebc61a86daa2a`.
- Alteração posterior limitada à reposição dos bloqueios de publicação das branches de auditoria: head `8386f66a0cc06e0aedc47535483a1f11b877bb52`. Execução final deste head registada na adenda de CI.
- O workflow criou Supabase/Auth/Storage descartáveis, com credenciais efémeras limitadas a `http://localhost:54321`. Depois executou `supabase stop --no-backup`. Os scripts recusam destinos que não sejam loopback. Nenhuma base de outro produto foi reutilizada.
- A configuração Vercel bloqueia publicação automática da branch consolidada, das branches `pcc-validation/**` e das branches de auditoria anteriormente protegidas.

Os UUIDs abaixo pertencem exclusivamente ao backend descartável. Depois da destruição desse backend, a prova persistente é composta pelo código dos testes, resultados do workflow, ficheiros descarregados e respectivos hashes; os registos não ficam consultáveis numa base de produção.

## Resultado dos seis circuitos

| Circuito | Estado de aceitação | Resultado real |
| --- | --- | --- |
| A Login → permissões → dados | **APROVADO no ambiente isolado** | Sessões reais e login no browser; acesso autorizado, isolamento entre utilizadores e fronteira PCC/GIE360° passaram. Expiração/refresh exaustivos não foram incluídos neste circuito. |
| B Diagnóstico → projecto → objectivos → acções | **BLOQUEADO** | Conversão SQL com rollback e repetição testada; não há ensaio encadeado completo. Preparação operacional ainda usa escritas separadas e deduplicação anterior ao INSERT, vulnerável à concorrência. |
| C Diagnóstico validado → G3 → DOCX/PDF → arquivo → download | **FALHOU** | Minuta G3 gerada e descarregada com Auth real, formatos e campos verificados. A rota G3 não arquiva a carta e contém termos contratuais fixos pendentes. O arquivo genérico passou, mas não comprova arquivo oficial de G3. |
| D GIE360° → questionário → aprovação → link → respostas → encaminhamento | **BLOQUEADO para o circuito completo** | Portal e browser gestor/cliente passaram; submissão e encaminhamento reais passaram. Emissão de link com aprovação atómica passou em SQL isolado. Falta o ensaio único de pré-visualização interna, emissão do link público, resposta e encaminhamento pelo PCC. |
| E Gemini → resposta real → falha → recuperação | **BLOQUEADO** | Retries, falhas, quota e fallback simulados passaram. Nenhuma resposta real foi obtida: o ensaio não tem chave/modelo Gemini configurados nem flags de utilização gratuita activadas. |
| F Offline → criar → fechar/reabrir → sincronizar → confirmar | **APROVADO no browser de ensaio; BLOQUEADO para aceite mobile integral** | Criação sem rede, fecho/reabertura da página, preservação do UUID, sync, recibo Supabase, fila vazia e ausência de duplicados passaram. Não equivale a fechar o processo do browser/app ou instalar e reabrir num dispositivo físico. |

## A — Login, permissões e dados

**Rota/funções:** `loginAction`, `/auth/login`, `resolveWorkspaceUser`, `isGIE360Client`; políticas de projectos e portal GIE360°.

**Dados de ensaio:** três utilizadores criados por administração no Auth local, emails aleatórios `@example.test`, passwords aleatórias de ensaio; empresas e projectos sintéticos. As credenciais não integram este pacote.

**Esperado:** login válido; leitura dos dados autorizados; outro utilizador não vê projectos nem objectos Storage; cliente GIE360° não cria projectos PCC nem entra no shell/assistente interno.

**Real:** onze verificações do backend passaram, incluindo os casos de autenticação, RLS e Storage; login real de gestor/cliente e navegação no browser passaram. A regra que tratava a ausência da tabela de identidade como ausência de associação GIE360° foi corrigida para falhar com acesso bloqueado.

**Evidência:** `integracao/validation-backend.json`, `integracao/validation-browser.json`, resultados do run 64; testes `pcc-access.test.ts`, `gie360-database.test.ts` e `gie360-import-rls.test.ts` no PR.

**Estado:** APROVADO neste âmbito. **Limite:** não constitui auditoria exaustiva de todas as políticas ou prova de refresh/expiração de sessão em dispositivo físico.

## B — Diagnóstico, projecto, objectivos e acções

**Rota/funções:** `convert_factory_case_atomic`, `ensureProjectOperationalStructure`, `prepareProjectOperationalStructure`; criação e ligação de objectivos/entregáveis/acções.

**Dados de ensaio:** caso SQL `20000000-0000-4000-8000-000000000001`, validação `viable`, decisão explícita de ensaio, risco bloqueante e falha injectada na ligação do caso. Fixtures de autonomia usam objectivo e critérios de conclusão existentes.

**Esperado:** falha intermédia não deixa projecto ou decisão parcial; repetição mantém um projecto; acções derivadas correspondem aos entregáveis e não se duplicam com pedidos simultâneos.

**Real:** rollback e idempotência da conversão passaram no Postgres isolado. O código de geração foi recuperado da recovery. Não foi executada a cadeia completa por UI, nem demonstrada a segurança sob concorrência da preparação operacional.

**Evidência:** `tests/factory-atomic.test.ts`, `tests/action-autonomy.test.ts`, `tests/project-autonomy.test.ts`, `vitest-results.json`.

**Estado:** BLOQUEADO para o circuito completo; defeito de atomicidade identificado na revisão. **Correcção necessária:** RPC que serialize e reúna preparação de objectivo, entregável, acções e métrica; definir idempotência por operação e testar dois pedidos concorrentes, sem eliminar trabalho manual existente.

## C — Compromisso G3 e documentos

**Rota/funções:** `approve_commitment_atomic`; `GET /api/projects/[id]/commitment-draft?format=pdf|docx`; `POST /api/deliverables/[id]/generate`; `GET /api/deliverables/artifacts/[id]/download`; `finalize_generated_deliverable`.

**Dados reais do ensaio descartável:**

| Registo | ID |
| --- | --- |
| projectId | `57ebe697-1b3f-4efa-926e-be0d724f8b8d` |
| deliverableId | `89b30965-c257-4cf7-8232-41cae093c9fc` |
| artifactVersion | `3ac9222f-af8b-466f-8ffc-1d6c424fc165` |
| baselineId | `2bf80b8f-e0ed-4a29-810b-19d09d4a9576` |
| offlineItemId | `0eb33e28-5bac-4239-ab8c-a0a085a4e96d` |

**Esperado:** 409 antes da aprovação interna, aprovação e evento atómicos, DOCX/PDF coerentes, arquivo persistente versionado e download autorizado. Nenhuma aprovação humana de produção pode ser presumida.

**Real:** a minuta G3 recusou geração antes da aprovação interna e produziu dois ficheiros com sessão real depois da transição explícita de ensaio. Os formatos nativos, os campos de ensaio e a integridade dos ficheiros foram verificados. O arquivo genérico gerou Word/PDF, recusou acesso anónimo/cruzado, confirmou hashes em Storage privado e repetiu sem duplicar evidência. A minuta G3 continua sem esse arquivo próprio e apresenta partes, pagamentos, cronograma e termos jurídicos pendentes.

**Evidência:** `integracao/validation-backend.json`; `integracao/validation-artifacts/`; testes SQL de rollback em `operational-atomic.test.ts`; `native-files-verification.json`. Os documentos são minutas de ensaio, não cartas oficiais aceites. A Carta G3 de uma página foi renderizada e inspeccionada em PDF e Word. O DOCX genérico de duas páginas ainda requer ajuste visual da segunda página, cujo conteúdo fica demasiado próximo do cabeçalho; o teste de arquivo valida integridade e permissões, não aprova esse layout.

| Ficheiro efectivamente descarregado | Bytes | SHA256 |
| --- | --- | --- |
| Documento_Auth_Storage_ENSAIO.pdf | 35505 | `dd2caeb07cae0cab02c3f859d45f1053821a912da24243d9ceaa72f9cf2ef6a4` |
| Documento_Auth_Storage_ENSAIO.docx | 15623 | `dc38e5e59dd968059443938b5f12af02e68260e991e65bde636e510306f0dd33` |
| Carta_G3_Auth_ENSAIO_MINUTA.pdf | 28136 | `b4110d4c045691cb119511b23d40ae975c0a468311fae8e22a37c6353ce7dd45` |
| Carta_G3_Auth_ENSAIO_MINUTA.docx | 15635 | `8e53eb64de9d930cf2eda5b862293934fbbce8ed09d929a0a42e89f507590bbd` |

**Estado:** FALHOU o circuito oficial completo. **Correcções necessárias:** ligar a geração G3 a snapshot imutável da baseline e termos efectivamente aprovados, arquivar ambos os formatos e respectivos hashes e disponibilizar download autorizado. A gravação `saveCommitmentBaseline` também precisa de transacção única: o erro de actualização do projecto já não é ignorado, mas as duas escritas ainda não são revertidas em conjunto.

## D — GIE360°, aprovação e encaminhamento

**Rota/funções:** `/gie360`, `/gie360/login`, `gie360_save_assessment`, `gie360_provision`, `createClientDiagnosticRequest`, `issue_reviewed_diagnostic_atomic`, `/client-diagnostic/[token]`, `client_diagnostic_lookup/submit`.

**Dados:** empresas sintéticas; sector Comércio/Agricultura; custos declarados como “não sei”; módulos autorizados; UUID de idempotência e revisão de respostas; destinatário e organização de ensaio, hashes de token e validade de sete dias.

**Esperado:** cliente só acede à sua empresa; alteração concorrente de revisão é rejeitada; resposta e notificação são únicas; encaminhamento aponta ao caso original; nenhum link sem revisão explícita; falha da auditoria preserva o link anterior.

**Real:** Auth, RLS, configuração, gravação/reabertura do questionário, conflito de revisão, submissão, notificação e encaminhamento passaram no backend/browser. Importação, revisão e exportação também passaram. A emissão de link e a aprovação foram reunidas numa RPC, com rollback comprovado em PGlite. A consulta real SQL de tokens negou expirados/revogados; nesse teste o contador de rate-limit foi controlado, não medido sob concorrência real. Falta a cadeia externa inteira, com revisão humana de ensaio na interface e submissão por link.

**Evidência:** `integracao/validation-backend.json`, `integracao/validation-browser.json`; `operational-atomic.test.ts`, `diagnostic-expiry-database.test.ts`, `gie360-database.test.ts`.

**Estado:** BLOQUEADO para aceitação completa. **Necessário:** executar e registar pré-visualização, aprovação interna de ensaio, link público, submissão e destino com todos os IDs; testar o contador real de rate-limit.

## E — Gemini e recuperação

**Rota/funções:** `POST /api/ai/assist`, `requestAIText`, `generateAssistWithFallback`, `scripts/test-gemini-live.ts`.

**Dados:** prompt sintético “Responde apenas OK”; vendas 80+40 MZN, dez leads, zero conversões e lucro ausente; falhas simuladas 503, timeout, 429, 403 e resposta vazia.

**Esperado:** resposta real preserva factos e ausência de informação; falha explícita; recuperação limitada a fornecedores gratuitos autorizados; nenhum perfil desactivado é reactivado pelo fallback.

**Real:** os testes simulados passaram. O probe real registou `blocked`; não foi enviada uma chamada com chave/modelo de produção, nem foi inventado texto de resposta real.

**Evidência:** `integracao/validation-gemini.json`, `gemini-provider.test.ts`, `ai-assist-router.test.ts` e `ai-runtime.test.ts`.

**Estado:** BLOQUEADO. **Necessário:** chave e modelo do Gemini no ambiente de ensaio, com configuração do plano gratuito e tratamento de dados coerente com a autorização existente; executar resposta real, indisponibilidade controlada e nova resposta. Não inserir segredos em conversa, código, PR ou provas.

## F — Offline, reabertura e confirmação

**Rota/funções:** `/offline.html`, `offline-app.js`, `syncOfflineQueue`, `POST /api/offline/sync`, `apply_offline_item_atomic`, `GET /api/offline/bootstrap`.

**Dados:** projecto `608623af-ba9b-4a9c-890f-0b2cf0fa286b`; ideia offline `bb97998a-e02e-4387-95a2-87e7f51ae676`; título aleatório de ensaio; browser Chromium com viewport 390×844, sem rede durante a captura.

**Esperado:** guardar sem rede, fechar página, reabrir pelo Service Worker, preservar ID/conteúdo, restabelecer rede, confirmar um registo e recibo, esvaziar fila e não duplicar ao repetir.

**Real:** todos esses passos passaram. A base confirmou `synced`, 1 linha de ideia e 0 operações pendentes. O ensaio inicial falhou numa sondagem que podia criar uma IndexedDB vazia; o teste foi corrigido para apenas observar bases existentes. Esse resultado anterior não foi convertido em aprovação sem nova execução. O SQL também comprovou rollback entre entidade e recibo e entre intake e eventos, colisão de conteúdo e negação de proprietário/estado forjados.

**Evidência:** `integracao/validation-offline-browser.json`, segundo teste em `gie360-browser-smoke.spec.ts`, `offline-atomic.test.ts` e resultados do run 64.

**Estado:** APROVADO neste browser. **Limite para aceite integral:** o browser permaneceu em execução; o teste fechou/reabriu a página. Faltam instalação PWA, fecho do processo/app, reabertura e sync num telemóvel físico, além de conflitos entre dispositivos. APK é opcional, não requisito autónomo para lançar a PWA.

## Correcções implementadas e riscos remanescentes

| Componente | Correcção | Prova/resultado | Estado |
| --- | --- | --- | --- |
| Consolidação | QA e recovery integradas, sem reconstrução | Árvore exacta e 202 testes locais | APROVADO no âmbito testado |
| Identidade | Ausência/erro da consulta GIE360° bloqueia acesso | Testes locais e fronteiras reais de cliente | APROVADO |
| Aprovação G3 | Estado, projecto e evento na mesma transacção com locks | Falha injectada reverte tudo; RPC real executada | APROVADO no âmbito testado |
| Partilha | Emissão, revogação anterior e aprovação numa transacção | SQL com falha preserva link anterior | APROVADO localmente; cadeia UI pendente |
| Sync | Negócio e recibo por operação atómica, whitelist, RLS | SQL, API e browser confirmaram gravação única | APROVADO no âmbito testado |
| Fila offline | Lotes de 100; retenção de não confirmados e mensagem de pendência | Typecheck/lint; browser validou uma entrada | Parcial: teste de mais de 100 entradas e falhas parciais ainda pendente |
| G3 oficial | A minuta não é tomada como documento aceite | Download real e campos pendentes explicitados | FALHOU arquivo oficial completo |
| Paginação Word genérica | Saída original preservada como evidência | Segunda página necessita de ajuste no cabeçalho/espaçamento | FALHOU QA visual final |
| Projectos/acções | Geração existente recuperada | Preparação ainda sem transacção/serialização integral | BLOQUEADO; correcção por concluir |
| Gemini | Recuperação gratuita incorporada | Simulados passaram, live bloqueado | BLOQUEADO |
| Dependências | Gate moderate preservado | Oito moderate, zero high/critical na execução local | FALHOU o gate isolado |
| Mobile físico | Sem prova fabricada | Não executado | BLOQUEADO |

## Verificações técnicas e segurança

202 testes locais passaram em 49 ficheiros; typecheck, build, validação de ícones e padrão UI passaram. Lint teve zero erros e cinco avisos de variáveis não utilizadas. Build local produziu BUILD_ID `HMjQyPiuwn4lR4IJWM8uR` e manifest de prerender. A execução real do runner acrescentou onze verificações do backend e dois testes no browser, sem falhas funcionais no run 64.

O workflow run 64 terminou **failure** porque o gate `npm audit --audit-level=moderate` rejeitou oito vulnerabilidades moderadas na cadeia transitiva ExcelJS/archiver/minimatch. Não foi reduzido esse limiar nem aplicada uma alteração de versão maior sem validação. O CI geral, com limiar high, tem resultado próprio na adenda; não substitui o gate mais exigente do ensaio.

Foram restauradas as restrições de publicação das branches de auditoria. Verificações textuais de CI foram alinhadas com a nova RPC offline e com o questionário existente, preservando marca, validade, secções e revisão antes da submissão. Estas correcções não constituem aprovação funcional automática.

A leitura do catálogo remoto confirmou RLS activo nas oito tabelas críticas consultadas; isso não prova a correcção de todas as políticas. Advisors registaram funções SECURITY DEFINER acessíveis a anon/authenticated e protecção de palavras-passe comprometidas desactivada. As funções públicas de token exigem revisão contextual, não revogação cega. Referências: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable e https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable . Nenhum ajuste foi aplicado na produção.

O histórico de migrações de produção difere do repositório. As migrações novas arrancaram num Supabase descartável; antes de produção é necessário reconciliar histórico e esquema existentes, sem migrações destrutivas. A instalação limpa de ensaio não prova uma actualização segura da base operacional.

Inventários incluídos: 21 rotas/métodos HTTP e 83 Server Actions. Inventário estático não significa que cada entrada foi executada.

## Condições para GO

1. Concluir transacções da preparação operacional e gravação de baseline; testar concorrência e recuperação sem duplicados.
2. Concluir termos aprovados, snapshot, arquivo e download específicos de G3; os documentos de ensaio com termos pendentes não são prova de carta oficial concluída.
3. Executar o circuito externo completo GIE360° com revisão e aprovação de ensaio, registando os IDs de todas as etapas.
4. Obter resposta real do Gemini gratuito e provar falha/recuperação.
5. Validar instalação e fecho/reabertura da PWA num dispositivo físico; testar fila maior que 100 e falhas parciais.
6. Tratar as vulnerabilidades e avisos de segurança, reconciliar migrações e repetir os testes críticos sobre a versão exacta.
7. Rever as evidências e obter autorização humana explícita para a única publicação. Nenhuma aprovação humana de produção foi concedida por estes testes.

**Parecer final: NO-GO.** O progresso operacional está documentado, mas o lançamento integral ainda tem bloqueios técnicos e de aceitação.

## Adenda final de CI

- **CI geral 1152: SUCCESS**, https://github.com/tmucari-jpg/Project-command-center/actions/runs/41416543309 . Inclui gates textuais, PowerShell, typecheck, 202 testes, lint, audit no limiar high e build.
- **Validação isolada 64: FAILURE**, https://github.com/tmucari-jpg/Project-command-center/actions/runs/41416543119 . Supabase descartável, build, onze checks de backend e dois testes de browser passaram. O gate de dependências no limiar moderate falhou; isso não foi ocultado pela aprovação dos ensaios funcionais.
- Head testado: `8386f66a0cc06e0aedc47535483a1f11b877bb52`. Merge temporário de PR usado no ensaio: `d1a9047d59e268de6d650bd7e22ebc61a86daa2a`.
- Artefacto GitHub: `13127438214`, digest `sha256:d7bb0b794163e980eb7ed9aa403f2744cb6883b7b1f202514b88a0cc95c41e91`. Os quatro ficheiros extraídos foram comparados com os hashes registados pelo ensaio.
- A consulta final do alias de produção confirmou o mesmo deployment e SHA de main observados no início.
- A documentação final será registada separadamente, sem alteração ao código testado ou nova publicação. Não existe aprovação humana de produção.
