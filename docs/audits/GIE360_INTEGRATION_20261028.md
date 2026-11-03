# PCC + GIE360° — candidato integrado, 28 Outubro 2026

Base: arquitectura consolidada GIE360° versão 1.4 fornecida pelo responsável. Este documento descreve implementação e limites; não constitui aprovação de lançamento. A produção e a main não são alteradas por este candidato.

## Funcionalidades incorporadas

| Fluxo | Resultado concreto | Verificação |
| --- | --- | --- |
| Produto e pacotes | Catálogo separado, quatro pacotes propostos sem preços fictícios; associação a caso PCC e conta de cliente confirmada | SQL, RLS e navegador no pipeline |
| Aprovação do âmbito | Gestor regista pacote, módulos, referência real do acordo e autorização de IA | RPC, auditoria, controlo de permissões |
| Cliente | Login e shell próprios, conta nunca remapeada para gestor PCC | RLS, proxy, APIs, testes cruzados |
| Questionário | 12 perguntas/3 etapas, guardar e retomar, revisão optimista, confirmação de envio, submissão única no mesmo caso e notificação | SQL real com rollback, HTTP e navegador |
| Informação em falta | Respostas vazias/não sei são alertas; conteúdo declarado permanece por validar | Testes de dados, SQL e interface |
| CSV/XLSX | Original privado/hash, normalização no servidor, totais MZN, câmbio documentado, duplicados, notas de crédito, lacunas e versões | Parser, RLS, HTTP, download e integridade |
| Revisão | Recebido/em revisão/aprovado/rejeitado; gestor reprocessa original e compara totais com referência contabilística; divergências impedem aprovação | SQL e HTTP; fonte contabilística declarada pelo revisor |
| IA | Motor existente com Gemini configurável, política gratuita explícita, chave só servidor, geração/erros/fallback, contexto de uma empresa e respostas com citações verificadas | Testes simulados; chamada real separada |
| Identidade | Logótipo GIE360° exacto fornecido, manifesto/ícones/SW próprios; PCC conserva marca e recursos | SHA, CRC e dimensão PNG, manifestos e caches |
| APK | Projecto Android separado, navegação confinada ao produto, build/assinatura/hash/versionamento por workflow | Testes Java; build/dispositivo pendentes de URL e assinatura |
| Comandos PCC revistos | Instalar PWA, copiar links, indicação de entregáveis sem evidência e distribuição APK verificada | Análise de código e testes; não equivale a testar todos os comandos PCC |

## Condições reais de execução

Migrações aditivas devem ser aplicadas primeiro apenas ao backend de testes. Configurar `NEXT_PUBLIC_SUPABASE_URL`, chave pública e `NEXT_PUBLIC_SITE_URL` para esse ambiente. `SUPABASE_SERVICE_ROLE_KEY` fica exclusivamente no servidor: a autorização normal por utilizador/empresa precede qualquer escrita privilegiada de importação ou acesso ao registo de fornecedores.

Gemini precisa de `GEMINI_API_KEY`, `GEMINI_MODEL`, perfil activado com custo gratuito, `PCC_GEMINI_FREE_TIER=true` e `PCC_GEMINI_DATA_PROCESSING_ACCEPTED=true`. Confirmar elegibilidade da conta, quotas e termos. Nenhuma destas declarações elimina quotas nem garante disponibilidade. Não enviar chaves pelo chat nem guardá-las no Git. A sonda real usa apenas dados sintéticos e, sem configuração, produz estado blocked.

`scripts/TEST_PCC_GITHUB.ps1` reúne a execução remota e as evidências sem Docker local. Requer PowerShell 7 e GitHub CLI autenticado com permissão Actions. Limita-se à branch `pcc-validation/october-2026` e verifica o commit e a tentativa antes de aceitar evidências. Não publica. Sucesso automatizado não significa aprovação completa: o relatório contém `fullyValidated=false` enquanto existirem verificações externas pendentes.

## Requisitos ainda abertos e bloqueantes conforme o âmbito

- Módulos empresariais operacionais completos de CRM, facturação/cobranças, contabilidade/fiscalidade, tesouraria, fornecedores/operações e estratégia/simulações: não são apresentados como activos apenas por existir catálogo ou âmbito aprovado.
- Links temporários de diagnóstico sob identidade GIE360°, renovação/revogação próprias, criação/recuperação de conta integralmente dentro da marca GIE360°.
- Todas as exportações comerciais previstas por pacote (PDF/Word/XLSX/ZIP do diagnóstico GIE360°) e proposta→tarefas com baseline imutável no âmbito GIE360°. O gerador PCC existente não prova estes novos fluxos de cliente.
- Conectores contabilísticos externos: a reconciliação actual compara período e totais documentados pelo revisor, não certifica o livro contabilístico, lucro, cobranças ou obrigações fiscais completas. XML não é suportado nesta versão e é recusado claramente.
- Validação especializada das regras fiscais de Moçambique, políticas de retenção/consentimento/direitos de acesso, condições comerciais e disponibilidade jurídica da marca/domínio.
- IA Gemini real com chave autorizada; WebGPU real; instalação PWA em Android/iOS; build e instalação APK com assinatura oficial, URL HTTPS do ambiente e correspondência de commit web/APK.
- Restauro completo incluindo base de dados, objectos privados Storage, configuração e procedimentos seguros para reintroduzir segredos. Um ZIP do código não é backup operacional completo.

Nenhum destes pontos deve ser convertido em estado verde por passar testes de código. O relatório do pipeline e a revisão de negócio devem determinar o próximo âmbito e a autorização final de publicação.
