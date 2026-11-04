# PCC — Matriz de fecho único, sem retrabalho (04/11/2026)

## Decisão de execução

**Um deploy final apenas**, após preparação, aprovação do diferencial, migração compatível com a produção e decisão explícita. Não alterar as funcionalidades, respostas, documentos ou contratos já aprovados. Não gerar projectos/clientes ou aprovações fictícios. Não publicar previews Vercel. Não integrar PRs antigos em bloco.

**Referências:** principal Vercel `9c8896fd`; `main` `3ec0c846` (percurso GIE360° já aprovado na CI); branch de consolidação `work/pcc-pendencias-consolidadas-20261104` / PR #126 em rascunho.

## Matriz de pendências

| ID | Prioridade | Situação comprovada | Acção estritamente necessária | Prova de fecho |
|---|---|---|---|---|
| T01 | P0 | A publicação de status cliente fazia três operações não-atómicas | Reutilizar RPC **já existente** `publish_project_client_status_atomic` (código no PR #126) | Assinatura e ACL verificadas + teste de concorrência e falha controlada em base isolada + CI |
| T02 | P0 | A renovação do diagnóstico revogava antes de criar | Aplicar a migração de `issue_client_diagnostic_request_atomic` **em release controlado** e activar cliente do PR #126; manter `executive-v3` e `executive-v3-gie360` e RLS | Ensaios isolados de sucesso, rollback em falha e duas renovações simultâneas; confirmar que estados já submetidos ficam intactos |
| T03 | P0 | `main` contém a correcção GIE360°; domínio principal ainda no commit anterior | Reunir a correcção existente na única publicação final, sem a reimplementar | Domínio principal informa o SHA final e mostra área de projecto, não o hub da organização |
| T04 | P0 humano | Existem 0 organizações e 0 projectos GIE360° na base operacional | Só proceder à transferência após resposta de diagnóstico revista, decisão humana e conta do cliente autorizada | Um único percurso real confirmado por gestor e cliente; sem projecto fictício |
| T05 | P0 humano | O diagnóstico Amsol está em análise, com informação por esclarecer; 0 revisões humanas registadas | Solicitar esclarecimentos e registar decisão humana no PCC | Revisão fundamentada e auditável; nenhum encaminhamento automático |
| D01 | P1 | 19 registos de entregáveis: 17 sem `artifact_url` e `artifact_reference`; não demonstram inexistência do original | Conciliar individualmente: existente aprovado / original recuperável / por executar. Não marcar como aceite antes de evidência | URL/versão/hash e aprovação real por cada entrega devida; para itens futuros, estado correcto e prazo |
| D02 | P1 | Arquivo `pcc_official_documents` vazio; Master Mind e Guia Comercial constam da Biblioteca ChatGPT | Importação controlada **dos ficheiros originais**, com nomes, versões e hash, sem recriação; confirmar a versão oficial quando há duplicados | Download autenticado, metadados e checksum no repositório PCC |
| D03 | P1 | Pitch P06 tem 2 PPTX originais armazenados e rota de download já publicada na versão principal | Validar uma só vez o acesso autenticado, sem gerar PPTX novo | Download real com integridade confirmada |
| Q01 | P1 | PRs antigos #107, #110, #112, #113 em rascunho, baseados em versões ultrapassadas | Reconciliar apenas diferenças relevantes e encerrar rascunhos **após revisão**, sem merge bruto | Lista explícita de diferenças únicas, incorporadas ou justificadamente não aplicáveis |
| V01 | P0 custos | Dois projectos Vercel foram ligados ao mesmo repositório | Manter previews/builds automáticos ignorados; apenas **project-command-center** recebe a publicação final autorizada | Um único deployment novo no alvo principal, sem rebuild secundário |
| V02 | P0 aceite | Regra do utilizador: uma única validação humana final | Verificar somente mudanças e percurso GIE360° + download P06 + link diagnóstico + acompanhamento | Aceitação real registada por gestor, com evidência e discrepâncias delimitadas |

## Ordem técnica do fecho final

1. **Congelar diferencial** PR #126 (sem alterar o que já funcionava), CI verde e análise de segurança, esquema e permissões.
2. **Executar testes de transacção em base isolada**: emissão/renovação, rollback sob erro, concorrência, RLS e variantes de questionário. Não usar a base de produção como ambiente de ensaio.
3. **Reconciliar fontes dos documentos**: usar originais existentes e identificar explicitamente os que nunca foram aprovados ou produzidos. Não inventar arquivos, links nem evidências.
4. **Confirmar os dados humanos obrigatórios**: cliente, contrato, revisão do diagnóstico e autorização. Não efectuar aprovações pelo utilizador.
5. **Validar sequência da release**: aplicar a única migração aprovada e confirmar a função/ACL *antes* de disponibilizar o código que depende dela; se a migração falhar, não efectuar deploy.
6. **Autorizar uma única publicação** no projecto Vercel principal, com SHA fixo; produção secundária não recebe nova build.
7. **Uma validação humana integral**: critérios V02; registar o resultado. Só declarar projecto fechado se cada bloqueio de aceitação tiver prova.

## Não interpretar como conclusões

CI verde, Vercel READY, presença de registo em BD, botão visível e URL armazenado não demonstram, isoladamente, execução real, download correcto ou decisão comercial aprovada.

## Protecções

Não apagar nem substituir dados de cliente; não tocar nas versões de documentos aprovadas; não retroceder segurança Auth/GIE360, RLS, Gemini ou offline; não gerar ficheiros fictícios; não mesclar branches antigas só porque estão abertas. Uma falha isolada pode gerar correcção adicional na **mesma branch**, mas nunca deploy parcial.
