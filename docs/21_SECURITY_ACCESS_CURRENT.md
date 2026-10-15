# PCC — Segurança e Acessos

**Estado:** OFICIAL / CURRENT  
**Data:** 2026-10-14

## 1. Princípios

- menor privilégio;
- isolamento por utilizador para contas comuns;
- workspace operacional partilhado apenas entre administradores globais explicitamente autorizados;
- nenhum segredo no browser;
- nenhuma chave privilegiada em código público;
- operações críticas com aprovação explícita;
- segurança validada na base, não apenas na UI.

## 2. Autenticação

Supabase Auth é a camada de autenticação.

Fluxos obrigatórios:
- login;
- logout;
- recuperação de palavra-passe;
- callback de autenticação;
- sessão protegida.

Rotas privadas devem redireccionar utilizadores não autenticados para login.

## 3. Administração

O PCC suporta um workspace operacional partilhado entre administradores globais aprovados. A identidade autenticada continua separada da identidade canónica usada para consultar o workspace.

Áreas técnicas exigem:
- role global `owner` ou `admin`; ou
- identidade presente na allowlist server-side `PCC_ADMIN_EMAILS`.

A variável `PCC_ADMIN_EMAILS`:
- é sensível;
- está configurada no Vercel;
- não deve ser gravada no GitHub;
- deve conter apenas identidades administrativas aprovadas.

## 4. Áreas administrativas

Incluem:
- Administração
- Agentes
- Orquestração
- Biblioteca técnica
- Configuração de serviços inteligentes
- Segurança
- Optimização

Inteligência e Teste podem participar no fluxo operacional normal conforme o caso.

## 5. RLS

Todas as tabelas de dados do utilizador devem ser protegidas por RLS.

Padrão:
```sql
user_id = (select auth.uid())
```

As policies foram optimizadas para evitar reavaliação linha-a-linha de `auth.uid()`.

## 6. Funções de segurança

Funções revistas:
- `public.set_next_action(uuid)`
- `public.check_brave_search_rate_limit()`

Desde 2026-10-14 ambas executam como `SECURITY INVOKER`. A autorização depende de sessão autenticada e RLS, eliminando privilégio elevado desnecessário.

## 7. api_rate_limits

A tabela tem RLS activo com policies de leitura, inserção e actualização para o próprio utilizador autenticado. O acesso administrativo global é integrado nas policies consolidadas de RLS.

## 8. Password hardening

Leaked Password Protection foi activada em 2026-10-14 nas configurações de Email do Supabase Auth.

Manter igualmente:
- Auth;
- RLS;
- rotas protegidas;
- gestão segura de segredos;
- monitorização;
- logs e rollback.

## 9. Segurança antes de release

PASS mínimo:
- CI verde;
- Auth funcional;
- RLS validado;
- nenhuma exposição cross-user;
- segredos fora do código;
- rotas admin protegidas;
- backup válido antes de alterações de alto risco;
- smoke test pós-deploy.
