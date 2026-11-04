# PCC — Reconciliação factual de links e documentos (04/11/2026)

## Fonte e âmbito
Leitura **apenas de metadados** das tabelas `public.deliverables` e `public.generated_deliverable_artifacts` do PCC, confrontada com os originais oficiais já encontrados na Biblioteca. Nenhuma alteração aos dados ou ficheiros de produção. A Biblioteca existente apresenta referências ligadas aos entregáveis, agrupadas por projecto, sem duplicar os registos de execução.

## Evidência observada

| Grupo | Projecto | Quantidade | Evidência e tratamento |
|---|---|---:|---|
| Guia Comercial PCC | Marketing, Vendas e Lançamento do PCC | 1 | URL existente para domínio principal PCC e referência de release; **não validar download apenas com a URL**; original oficial existente noutra Biblioteca, a importar sem reconstrução |
| P06 · Pitch comercial | Marketing, Vendas e Lançamento do PCC | 1 | URL/referência já registadas e **dois** registos de artefacto gerado; validar acesso autenticado e integridade no teste humano final; não regenerar |
| Documentos/actividades sem URL no registo | Marketing, Vendas e Lançamento do PCC | 12 | Entre estes, **Master Mind** e **Plano Operacional** têm versões oficiais recuperadas da Biblioteca; associar ao entregável somente após importação/identificação do link seguro. Os demais exigem reconciliação documental individual ou manutenção do estado futuro |
| Entregáveis de projectos operacionais distintos | Briefing Diário, Gestor de Actividades, Gestor de Vendas, MAANA e RHENGU | 5 | Sem URL, mas **fora do lançamento PCC**; não converter automaticamente em documentos em falta nem preencher artefactos fictícios |

**Total:** 19 entregáveis; 2 com URL/referência; 17 sem URL/referência (12 no projecto de lançamento e 5 noutros projectos). `pcc_official_documents` estava vazio na consulta anterior, o que não prova inexistência dos PDFs originais.

## Destino das referências (regra aprovada)
- **Entregável:** permanece a fonte de verdade da execução, aceitação e respectivos links; `artifact_url` é ligação de entrega, `working_edit_url` é ligação *privada* de edição do gestor, sem duplicar ficheiros.
- **Biblioteca já existente (`/factory-library`):** índice documental por projecto, com links dos entregáveis. Mantém separada a biblioteca de conhecimento e activos reutilizáveis.
- **Cliente:** apenas snapshots e links explicitamente autorizados; nunca publicar `working_edit_url`.
- **Originais oficiais PCC e PCC × GIE360°:** modelos de saída e documentos já validados; preservar ficheiros e metadados, sem novas reconstruções.

## Acções remanescentes realmente exigidas
1. Verificar a ligação e acesso reais do Guia Comercial e dos dois artefactos P06 no PCC; links registados não equivalem a download validado.
2. Identificar e associar o Master Mind e o Master Plan originais, **sem substituir as versões oficiais nem confundir documento global com documento de cliente**. O Master Plan poderá pertencer ao repositório oficial e não exigir novo entregável.
3. Para os outros 10 itens sem URL no projecto de lançamento: distinguir trabalho já concluído mas não associado, entrega futura, ou entrega não aplicável. Não usar documentos genéricos para preencher lacunas.
4. Para os 5 projectos operacionais: manter pendência própria fora da decisão de release PCC, salvo evidência de dependência crítica.
5. Confirmar controlo de permissões do fornecedor de links externos. A UI e RLS do PCC não atribuem automaticamente direitos de edição num serviço externo.
6. Na única aceitação final, validar cliente autenticado, link de leitura, impossibilidade de editar documentos privados, download P06 e encaminhamento GIE360° **apenas com decisão humana real**.

## Estados nunca inferidos
A existência de PDFs na Biblioteca ChatGPT não significa que já tenham sido importados no PCC. A ausência de `artifact_url` não prova falta de documento. Os entregáveis com estado `pending` continuam pendentes até decisão/aceitação real. Não reabrir a validação dos modelos de saída, identidade visual nem documentos PCC/PCC × GIE360°.
