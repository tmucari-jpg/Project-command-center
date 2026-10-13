# PCC — Governação de Dados e RLS

**Estado:** OFICIAL / CURRENT  
**Data:** 2026-10-13

## 1. Ownership

Dados operacionais devem ser associados a `user_id` e protegidos por RLS.

O utilizador só pode consultar ou alterar registos que lhe pertencem, salvo funções administrativas explicitamente aprovadas.

## 2. Integridade relacional

Hierarquia principal:
- project → deliverable → action;
- action/deliverable/project → evidence;
- action/deliverable/project → blocker.

O servidor deve validar relações incompatíveis e inferir relações quando forem determinísticas.

## 3. Migrations

Migrations são a referência executável da base.

Antes de aplicar:
1. rever SQL;
2. identificar impacto;
3. confirmar backup quando houver risco;
4. executar via processo controlado;
5. revalidar advisors;
6. registar evidência.

## 4. Optimizações aplicadas em 2026-10-13

### Foreign keys
Foram adicionados 14 índices de suporte para foreign keys sem cobertura.

Migration documentada:
`20261013114000_add_missing_foreign_key_indexes.sql`

### RLS initplans
Foram optimizadas 85 policies para usar `(select auth.uid())`.

Migration documentada:
`20261013114500_optimize_rls_auth_uid_initplans.sql`

Resultado:
- avisos de unindexed foreign keys removidos;
- avisos `auth_rls_initplan` removidos.

## 5. Advisors

Executar regularmente:
- Security Advisor;
- Performance Advisor.

Não remover índices apenas porque aparecem como `unused_index` imediatamente após criação. É necessário histórico real de utilização antes de decidir remoção.

## 6. Dados sensíveis

Não armazenar em documentação pública:
- passwords;
- tokens;
- service role;
- chaves SMTP;
- connection strings;
- allowlist real de administradores;
- secrets de integrações.

## 7. Retenção e minimização

Guardar apenas dados necessários para:
- execução;
- auditoria;
- evidência;
- segurança;
- operação.

Dados obsoletos devem ser tratados segundo política operacional e requisitos legais aplicáveis.
