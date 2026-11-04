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

## Defeito 2 — Renovação do link do diagnóstico (correcção preparada; migração pendente)

**Defeito comprovado:** a rotina anterior revogava pedidos `active/opened` antes de gravar o novo; uma falha intermédia podia deixar o cliente sem acesso.

**Solução mínima:** função `issue_client_diagnostic_request_atomic` em `supabase/migrations/20261104123000_atomic_client_diagnostic_renewal.sql`, **apenas versionada; não aplicada ao Supabase em produção**. Usa `SECURITY INVOKER`, o RLS existente, controlo explícito do utilizador e delegação administrativa já prevista na política, bloqueio `FOR UPDATE` do caso e revogação + inserção na mesma transacção. Um erro da inserção causa rollback e preserva o link anterior.

**Compatibilidade preservada:** versões `executive-v3` e `executive-v3-gie360`, nomes e organizações opcionais, contexto do cliente, validade de 7 dias e estados `submitted/analyzing/reviewed` intocados. O registo de revisão humana, a triagem e o encaminhamento GIE360° continuam independentes; nenhuma aprovação é inferida ou simulada.

**Gate obrigatório antes da publicação única:** aplicar a migração no alvo autorizado antes do código que invoca a nova função, confirmar RLS/permissões, executar ensaio isolado de sucesso, falha transaccional e duas renovações concorrentes. Se não for possível criar ambiente isolado, **não declarar a operação aprovada nem activar a nova rotina em produção**.

## CI e custos

O CI antigo exigia referências directas às duas tabelas no `mutations.ts`, contrariando a nova publicação transaccional. O gate foi adaptado para procurar a função transaccional existente; os testes adicionais protegem a ausência de revogação separada. Todas as alterações permanecem no PR #126 em rascunho, sem merges, novos deployments ou escritas na base operacional.

## Fora do âmbito

- Recriar Word, PDF, pitch, Master Mind ou Guia Comercial já aprovados.
- Reabrir GIE360°, Gemini, Android, RLS, pagamentos ou outras áreas sem defeito real reproduzido.
- Mudar status ou encerrar registos pendentes sem provas e decisão humana.

## Gate do único deploy

Consolidar apenas o código final aprovado; não activar builds/preview automáticos; verificar commit, alvo e ambiente antes de uma única publicação autorizada, seguida de uma única validação humana focalizada.
