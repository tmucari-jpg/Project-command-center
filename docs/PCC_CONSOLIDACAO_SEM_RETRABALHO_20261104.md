# PCC — Consolidação mínima sem deploy (4 de Novembro de 2026)

## Regras de execução

- Nenhuma alteração à produção, aos dados dos clientes, às decisões já aprovadas ou aos documentos oficiais.
- Não repetir as aceitações anteriores. Validar apenas o diferencial de código.
- Não integrar os PRs #107, #110, #112 ou #113 em bloco.
- Um único deploy consolidado, após aceitação técnica e autorização.

## Defeito 1 — Publicação do acompanhamento do cliente (corrigido no código, por validar)

**Evidência:** a função `publishProjectClientStatus` em `application/app/(protected)/mutations.ts` emitia três operações independentes: snapshot, revogação dos links antigos e emissão do novo. Em falha intermediária, o link podia ficar revogado sem substituição.

**Correcção preparada:** chamada da função **já instalada** `public.publish_project_client_status_atomic`. A função usa bloqueio `FOR UPDATE`, valida o utilizador, incrementa a versão e insere novo snapshot e link numa transacção única, com rollback integral em caso de falha. Sem alterações ao esquema. Falha de publicação mostra mensagem genérica, sem exposição de SQL.

**Evidência necessária antes de aprovar:** CI e verificação isolada da assinatura RPC e das permissões. Nenhuma publicação real foi feita.

## Defeito 2 — Renovação do link do diagnóstico (confirmado, ainda sem correcção)

**Evidência:** `createClientDiagnosticRequest` revoga pedidos antigos antes de gravar o novo; uma falha no segundo passo pode invalidar prematuramente o link anterior.

**Função de base existente:** `issue_reviewed_diagnostic_atomic`. **Não reutilizar cegamente.** Requer `p_reviewed=true`, titular efectivo `auth.uid()`, `p_name`, `p_organization` não vazios, `p_content_sha256` válido, cria registo de autorização de partilha e emite exclusivamente a variante `executive-v3`. O fluxo actual permite também `executive-v3-gie360` e não exige todos estes campos.

**Decisão:** preservar os circuitos aprovados e projectar uma correcção transaccional de emissão que mantenha exactamente os dois formatos, a autorização humana e o comportamento dos clientes. Rever primeiro regras e RLS, depois testar a função em base isolada, antes de qualquer migração de produção. **Não considerar este ponto resolvido.**

## Fora do âmbito

- Recriar Word, PDF, pitch, Master Mind ou Guia Comercial já aprovados.
- Reabrir GIE360°, Gemini, Android, RLS, pagamentos ou outras áreas sem defeito real reproduzido.
- Mudar status ou encerrar registos pendentes sem provas e decisão humana.

## Gate do único deploy

Consolidar apenas o código final aprovado; não activar builds/preview automáticos; verificar commit, alvo e ambiente antes de uma única publicação autorizada, seguida de uma única validação humana focalizada.
