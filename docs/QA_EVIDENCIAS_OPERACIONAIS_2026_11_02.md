# PCC — Verificação operacional, 2 Novembro 2026

## Ambiente e limites
- CI PR #110: execução [#1141](https://github.com/tmucari-jpg/Project-command-center/actions/runs/41073325444), conclusão **success** para o commit `7f5114fefb9f9ddf03ee42c68ef1f6f02e895153`.
- Vercel: deployment de pré-visualização READY observado, mas o último deployment retornado refere-se a um commit anterior (`47dceac593bd3040b4251a1d02dd2d0e9607eb81`). **READY não prova funcionamento do circuito nem corresponde necessariamente ao commit testado.**
- Supabase: projecto PCC activo e saudável; não foi identificado outro projecto PCC activo e isolado. **Não inserir compromissos/diagnósticos de ensaio na base operacional** sem isolamento e controlo de rollback.
- Teste SQL read-only realizado: `select count(*) from public.client_diagnostic_lookup(repeat('0',64));` devolveu **0 registos**. Este teste comprova rejeição daquele hash inválido; **não comprova** expiração, revogação, rate-limit, nem a migração do PR.
- A última execução `ai_provider` registada terminou **failed** por timeout 25.004 ms no fornecedor Gemini (29/10/2026).
- `project_commitment_baselines`, `gie360_assessments`, `gie360_submissions` e `pcc_external_share_approvals`: zero registos na consulta anterior. Não houve criação de dados artificiais.

## Bloqueios de aceite integral
1. Isolar ambiente de ensaio com credenciais e dados fictícios controlados, garantindo que os dados/clientes reais não são afectados.
2. Disponibilizar deploy preview do SHA a testar e executar login/autorização reais no ambiente isolado.
3. Aplicar e testar migração de tokens em ensaio; provar token expirado, revogado e activo.
4. Corrigir timeout do Gemini e obter texto de resposta real com ID de execução, latência e logs sem segredos.
5. Criar G3 de ensaio a partir de diagnóstico, gerar Word/PDF nativos com o logótipo oficial, validar downloads e aprovações humanas.
6. Submeter GIE360° personalizado e provar encaminhamento, autorização de partilha, acções automáticas e logs.
7. Testar PWA/offline num dispositivo físico, confirmar persistência, reconexão e ausência de duplicados.
8. Revalidar CI, segurança e evidências por revisor independente, sem autorizar deploy até aceitação.

**Critério:** não declarar produção pronta, nem fabricar respostas, documentos, aprovações ou IDs de execução. Este documento reporta verificações realizadas, não constitui aprovação.

## Verificação adicional — Preview e variáveis Vercel (02/11/2026)
- CI #1142: **success**, commit `8fdca501735e0cd49c9f8f06af1c8eb37596e2a1`.
- Deploy Preview `dpl_3eGw2KCbaxNgmACAc7EN5FyQjyc2`: **READY** e corresponde ao SHA acima; confirma compilação/deployment, não confirma autenticação ou operação funcional.
- Metadados das variáveis Vercel (sem descodificar segredos): `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` existem no target **production** e em três entradas Preview restritas às branches `recovery/gie360-20261028`, `feature/autonomous-action-drafts` e `audit/pcc-identity-operational-consistency`. Não aparece entrada Preview sem restrição nem específica para a branch QA actual.
- **Conclusão:** o Preview da branch actual não tem ligação Supabase independente confirmada. Não afirmar que está pronto para G3/GIE360° ou operações com escrita. Corrigir as variáveis no ambiente de ensaio isolado (sem copiar cegamente as credenciais de produção), verificar autenticação e fazer smoke antes de qualquer submissão.
- Nenhum dado ou configuração de produção foi alterado nesta verificação.

## Verificação de continuidade — 02/11/2026
- CI GitHub #1143: **success**, commit `a72087931650b14fadfba085f1f16125fba36158`.
- Metadata do Vercel filtrada pela branch `qa/integracao-g3-gie360-gemini-mobile-20261030`, sem desencriptar valores: **nenhuma variável específica devolvida**. Configuração adequada de Supabase Preview continua não comprovada; não executar escrita no Supabase operacional a partir desse Preview.
- Projectos Supabase disponíveis: `project-command-center` e `briefing-diario-` estão activos; `tmucari-jpg's Project` e `Maana-piloto` estão inactivos. Nenhum dos restantes foi validado como ambiente de ensaio PCC; não reutilizar base de outro produto.
- Consulta operacional sem escrita: `client_diagnostic_lookup` com hash nulo de referência (64 caracteres 0) devolveu **zero registos**. Este caso isolado **não prova** comportamento com tokens expirados nem acesso autorizado.
- `project_commitment_baselines` continua com **zero registos**.
- Próxima condição para testes com escrita: configurar **credenciais de base isolada para esta branch**, confirmar projecto/ref de destino e rollback; depois executar G3, GIE360° e geração de documentos num único ensaio encadeado.
- Nenhuma migração, publicação ou escrita em tabelas de negócio foi feita nesta verificação.
