# PCC — Segurança e Acessos

**Estado:** OFICIAL / CURRENT  
**Data:** 2026-10-13

## 1. Princípios

- menor privilégio;
- isolamento por utilizador;
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

## 6. SECURITY DEFINER

Funções revistas:
- `public.set_next_action(uuid)`
- `public.check_brave_search_rate_limit()`

Ambas:
- exigem utilizador autenticado;
- derivam identidade de `auth.uid()`;
- restringem a operação ao próprio utilizador;
- permanecem `SECURITY DEFINER` de forma intencional.

Não alterar apenas para silenciar o linter sem teste de regressão.

## 7. api_rate_limits

A tabela tem RLS activo e não possui policies directas de cliente.

Acesso esperado:
- exclusivamente através da função controlada de rate limiting.

## 8. Password hardening

Leaked Password Protection deve ser activada quando a configuração/plano Supabase o permitir.

Até lá:
- manter Auth;
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
