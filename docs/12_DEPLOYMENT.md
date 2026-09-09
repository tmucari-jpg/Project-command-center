# Project Command Center — Deployment

## 1. Estado da implementação

A aplicação real encontra-se em `/application`.

A documentação continua em `/docs` como fonte de verdade. As migrations executáveis
ficam em `/supabase/migrations`.

## 2. Pré-requisitos

- Node.js 24 ou superior
- npm
- Supabase CLI
- Projecto Supabase
- Conta Vercel
- Brave Search API key

## 3. Variáveis de ambiente

Criar `application/.env.local` apenas no computador local:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
BRAVE_SEARCH_API_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 4. Instalação local

```bash
cd application
npm install
npm run dev
```

A aplicação abre em `http://localhost:3000`.

## 5. Aplicar a base de dados

Na raiz do repositório:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

Migrations:

1. `202609090001_initial_schema.sql`
2. `202609090002_rls_policies.sql`
3. `202609090003_security_and_execution_hardening.sql`
4. `202609090004_relational_ownership_hardening.sql`

As migrations de hardening adicionam:
- rate limiting persistente;
- cálculo de duração;
- actualização automática de tempo real;
- uma única sessão de tempo aberta por utilizador;
- audit trail;
- índices de dashboard;
- validação de ownership nas relações entre tabelas;
- apenas uma Next Best Action explícita por utilizador.

## 6. Supabase Auth

No Supabase Dashboard, configurar os URLs permitidos.

Desenvolvimento:

- Site URL: `http://localhost:3000`
- Redirect URL: `http://localhost:3000/auth/callback`
- Redirect URL: `http://localhost:3000/auth/update-password`

Produção:

- Site URL: `https://SEU-DOMINIO`
- Redirect URL: `https://SEU-DOMINIO/auth/callback`
- Redirect URL: `https://SEU-DOMINIO/auth/update-password`

## 7. Brave Search

Criar a API key no Brave Search API Dashboard.

A chave é lida apenas por `/app/api/search/route.ts`.

O browser nunca recebe `BRAVE_SEARCH_API_KEY`.

O endpoint implementado:
`GET https://api.search.brave.com/res/v1/web/search`

O sistema:
- exige utilizador autenticado;
- valida a query;
- limita 20 pesquisas/minuto/utilizador;
- aplica timeout de 8 segundos;
- valida a resposta;
- apresenta URLs de origem;
- classifica o conteúdo como `untrusted_external_data`.

## 8. Vercel

1. Importar o repositório GitHub na Vercel.
2. Em **Root Directory**, seleccionar `application`.
3. Framework Preset: Next.js.
4. Adicionar as variáveis:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `BRAVE_SEARCH_API_KEY`
   - `NEXT_PUBLIC_SITE_URL`
5. Fazer Deploy.
6. Actualizar os redirect URLs do Supabase para o domínio Vercel.

## 9. Verificação antes de Production

Executar:

```bash
cd application
npm run typecheck
npm test
npm run lint
npm run build
```

Depois testar manualmente:
- signup/login/logout;
- recuperação de acesso;
- RLS com dois utilizadores;
- CRUD de objectivos/projectos/entregáveis/acções;
- timer;
- evidência;
- blockers;
- Brave Search;
- acesso não autenticado;
- responsive/mobile.

## 10. Limites desta entrega

Ainda não foram implementados:
- AI Copilot / comandos em linguagem natural;
- upload real para Supabase Storage;
- integração GitHub dentro da aplicação;
- webhooks avançados;
- notificações em tempo real.

Estes itens não são necessários para ligar a base de dados, Brave Search e Vercel, mas
devem permanecer como milestones posteriores.
