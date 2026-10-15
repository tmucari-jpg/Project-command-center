# Project Command Center — Índice Oficial de Documentação

**Estado:** OFICIAL / CURRENT  
**Versão documental:** 2026.10  
**Última revisão:** 2026-10-14  
**Âmbito:** aplicação cloud PCC, Supabase, Vercel, GitHub CI, Brevo e operações associadas.

## 1. Regra de precedência

Em caso de conflito entre documentação antiga e estes documentos CURRENT, prevalece esta ordem:

1. este índice e os documentos CURRENT abaixo;
2. migrations executáveis em `/supabase/migrations`;
3. código da aplicação em `/application`;
4. documentação histórica existente em `/docs`.

A documentação histórica é mantida para rastreabilidade, mas não deve ser usada como fonte operacional quando existir um documento CURRENT equivalente.

## 2. Pacote documental oficial

- `20_TECHNICAL_ARCHITECTURE_CURRENT.md` — arquitectura técnica e componentes.
- `21_SECURITY_ACCESS_CURRENT.md` — segurança, autenticação, autorização e administração.
- `22_DATA_GOVERNANCE_RLS_CURRENT.md` — dados, ownership, RLS e migrations.
- `23_DEPLOYMENT_RELEASE_RUNBOOK_CURRENT.md` — deploy, release e rollback.
- `24_OPERATIONS_INCIDENT_RUNBOOK_CURRENT.md` — operação diária, monitorização e incidentes.
- `25_BACKUP_RECOVERY_CURRENT.md` — backup, recuperação e continuidade.
- `26_ADMINISTRATOR_GUIDE_CURRENT.md` — guia do administrador PCC.
- `27_USER_GUIDE_CURRENT.md` — guia operacional do utilizador.
- `28_FINAL_ACCEPTANCE_CHECKLIST_CURRENT.md` — checklist final de aceitação.
- `29_RELEASE_RECORD_TEMPLATE.md` — modelo oficial de registo de release.
- `30_CHANGE_MANAGEMENT_CURRENT.md` — controlo de mudanças.
- `31_ENVIRONMENT_SECRETS_REGISTER_CURRENT.md` — variáveis, segredos e ownership técnico.
- `32_PRIVACY_DATA_HANDLING_CURRENT.md` — tratamento e minimização de dados.
- `33_KNOWN_LIMITATIONS_RISK_REGISTER_CURRENT.md` — limitações e riscos aceites.
- `34_DOCUMENT_CONTROL_APPROVALS_CURRENT.md` — controlo documental e aprovações.
- `35_INTEGRATION_REGISTER_CURRENT.md` — registo oficial de integrações.
- `36_PRODUCTION_ACCEPTANCE_CERTIFICATE_TEMPLATE.md` — certificado formal de aceitação de produção.
- `37_FINAL_AUDIT_CURRENT.md` — auditoria final técnica e gate do último deploy.
- `38_RELEASE_RECORD_2026-10-13.md` — registo efectivo da release final.
- `39_PRODUCTION_ACCEPTANCE_CERTIFICATE_2026-10-13.md` — certificado efectivo de aceitação em produção.

## 3. Estado actual resumido

- CI mais recente validado: GitHub Actions #346 — PASS.
- Branch operacional: `main`.
- Ambiente de produção actual: Vercel.
- Deployment de produção actual: READY; validação operacional da release corrente em curso.
- Segurança de dados: RLS activo e optimizado; 85 avisos de initplan removidos.
- Índices: 14 índices de foreign keys adicionados.
- Administração: protegida por role `owner/admin` e allowlist server-side; owner e admin globais aprovados partilham o workspace operacional canónico.
- Allowlist real de administradores: configurada exclusivamente em variável sensível do Vercel; não documentar emails em ficheiros públicos.
- Leaked Password Protection: activada em 2026-10-14 no Supabase Auth.
- Funções `set_next_action` e `check_brave_search_rate_limit`: executam como `SECURITY INVOKER`; `api_rate_limits` possui RLS para acesso autenticado controlado.

- Estado operacional actual: REVALIDATION IN PROGRESS após alterações de administração partilhada e hardening; não considerar a release corrente aceite sem smoke autenticado.

## 4. Princípio documental

Uma capacidade só é considerada concluída quando existe evidência de:

**IMPLEMENTADA + TESTADA + SEGURA + PERSISTENTE + OPERACIONAL**
