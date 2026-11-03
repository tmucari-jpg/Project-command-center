# PCC — Registo transversal de QA e critérios de aceitação
**Referência:** Outubro 2026  
**Branch de ensaio:** `qa/integracao-g3-gie360-gemini-mobile-20261030`  
**Estado geral:** NÃO ACEITE — não publicar

## Regras obrigatórias
- Uma acção executada não é, por si só, um entregável concluído.
- Registar, para cada ensaio: release SHA, data, actor, caso/ID, dados de entrada autorizados, resposta real, ficheiro/link descarregável, QA e aprovação humana quando exigida.
- Nunca atribuir aprovação interna ou externa automaticamente; usar dados de ensaio sem expor clientes.
- Documentos devem usar o logótipo original e o template oficial: verde profundo, marfim, dourado, hierarquia, tabelas e rodapé/paginação. Word e PDF devem mostrar o mesmo conteúdo e versão.
- A `main` e o deploy de produção não são alterados por esta branch.

## Matriz de testes — cada célula requer prova
| ID | Frente | Teste de aceitação | Estado inicial verificado |
|---|---|---|---|
| G3-01 | Compromisso | Diagnóstico validado → baseline G3 em rascunho → aprovação interna explícita → aprovação externa explícita, quando aplicável; nenhuma aprovação presumida | 0 baselines no Supabase |
| DOC-01 | Documentos | Gerar Word+PDF pelo PCC; abrir/descarregar; comparar campos, perguntas obrigatórias, logótipo oficial, numeração e versão; verificar registos persistentes | 2 artefactos históricos; teste novo pendente |
| ACT-01 | Acções | Objectivos aprovados → acções automáticas reais e deduplicadas, com responsáveis e vínculo aos entregáveis | Pendente de teste |
| GIE-01 | GIE360° | Organizar questionário por necessidade → pré-visualização e aprovação interna → link individual → autorização de partilha → submissão → encaminhamento → auditoria | 0 avaliações, 0 submissões, 0 aprovações externas |
| AI-01 | Gemini | Pedido real via PCC e BotIA, resposta útil auditável, timeout/erros tratados sem estados verdes falsos | Último teste falhou por timeout |
| MOB-01 | Android/PWA | Instalação física, ícone, autenticação, navegação, download, desconexão, edição offline e sincronização sem perda de dados | Parcial; offline não testado |
| SEC-01 | Segurança/QA | Permissões e RLS, acesso por cliente, recuperação, smoke CI e release imutável | Parcial |
| REL-01 | Publicação | Requer todos os critérios críticos aprovados por responsável humano; uma única publicação definitiva | BLOQUEADO por regra de processo; bloqueio técnico ainda por comprovar |

## Evidências a registar
Para cada ID: `status = not_tested | failed | partial | passed`; causa e próxima acção; links/IDs das provas; SHA testado; identificação de quem validou e quando. Não transformar ausência de evidência em `passed`.

## Ordem de execução
Trabalhar as sete frentes em paralelo na branch de ensaio, isolar alterações, executar `npm ci`, `npm run typecheck`, `npm test`, `npm run lint`, `npm run build` e os checks de identidade/documentação aplicáveis. Só propor merge depois de QA e revisão; não executar deploy nesta fase.
