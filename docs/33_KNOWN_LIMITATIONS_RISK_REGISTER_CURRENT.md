# PCC — Limitações Conhecidas e Registo de Risco

**Estado:** OFICIAL / CURRENT  
**Data:** 2026-10-14

## 1. Vercel deployment quota

**Estado:** temporário  
**Risco:** bloqueia novo deployment.  
**Mitigação:** aguardar reset; não criar deploys adicionais; task automática activa para avisar quando voltar a estar disponível.

## 2. Leaked Password Protection

**Estado:** resolvido em 2026-10-14.  
**Tratamento:** opção `Prevent use of leaked passwords` activada no Supabase Auth.  
**Monitorização:** confirmar persistência da configuração em futuras revisões de Auth/plano.

## 3. Funções com privilégio elevado

**Estado:** resolvido em 2026-10-14.  
**Funções:** `set_next_action`, `check_brave_search_rate_limit`.  
**Tratamento:** alteradas para `SECURITY INVOKER`; autorização passa por sessão e RLS.

## 4. api_rate_limits

**Estado:** tratado em 2026-10-14.  
**Tratamento:** RLS com policies de acesso do próprio utilizador e consolidação do acesso de administradores globais.

## 5. Modo offline

**Estado:** implementação funcional incluída para o próximo release; validação real pós-deploy ainda obrigatória.

Modelo:
- exige uma sessão online prévia no dispositivo;
- snapshot e fila são locais;
- sincronização ocorre ao recuperar rede;
- logout explícito limpa dados locais.

Não é permitido validar email/password Supabase do zero sem rede.

## 6. Local/private AI

**Estado:** runtime de IA local não reivindicado como produção completa sem runtime real validado.

## 7. Índices “unused”

Após criação, advisors podem marcar índices como não utilizados por falta de histórico.  
Não remover sem observação real e análise.

## 8. Próximo gate

A release corrente está em revalidação operacional. Depois do deployment corrente:
- smoke real;
- admin access;
- Factory;
- fluxo principal;
- mobile;
- release record.

Só então fechar Production Acceptance da nova versão.


## 9. Tooling npm / ESLint

**Runtime de produção:** corrigido. `npm audit --omit=dev` retorna 0 vulnerabilidades após a actualização para Next 16.4.0 e transitivos corrigidos.

**Tooling de desenvolvimento:** o audit completo pode continuar a reportar findings high em dependências transitivas de `eslint-config-next`/globbing. O fix automático disponível implica downgrade incompatível para Next 14.x e não foi aplicado.

**Disposition:** risco aceite apenas para tooling/build, não runtime. O CI passa a bloquear vulnerabilidades high/critical de dependências de produção com `npm audit --omit=dev --audit-level=high`. Rever os findings de desenvolvimento quando existir correcção upstream compatível.
