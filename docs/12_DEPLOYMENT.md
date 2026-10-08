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
- Conta Brevo configurada como SMTP do Supabase Auth

## 3. Variáveis de ambiente

Criar `application/.env.local` apenas no computador local:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
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

A lista executável e actual encontra-se em `/supabase/migrations` e deve ser tratada como a referência operacional. Não manter uma lista manual fechada neste documento, porque o projecto já possui fases e migrations posteriores às quatro migrations iniciais.

Antes de deployment:
- confirmar que as migrations versionadas no repositório correspondem ao ambiente Supabase;
- executar dry-run quando aplicável;
- rever qualquer alteração destrutiva;
- confirmar backup/rollback antes de alterações de risco.

As migrations de hardening e fases posteriores incluem controlos de ownership/RLS, execução, auditoria, componentes agentic/intelligence, offline/private AI, segurança/escala, Project Factory e automação. A presença de uma migration não substitui os respectivos testes de aceitação.

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

## 7. Brevo

Configure o SMTP do Brevo no Supabase Auth para envio de confirmação de conta e recuperação de palavra-passe. As credenciais ficam exclusivamente no Supabase.

## 8. Vercel

1. Importar o repositório GitHub na Vercel.
2. Em **Root Directory**, seleccionar `application`.
3. Framework Preset: Next.js.
4. Adicionar as variáveis:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
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
- acesso não autenticado;
- responsive/mobile.

## 10. Estado actual e validação

Este documento não deve ser usado como inventário estático de funcionalidades implementadas. O projecto evolui por migrations e commits versionados e já recebeu fases posteriores à entrega inicial.

Para determinar o estado real:
1. consultar o código e as migrations actuais;
2. consultar `docs/09_ACCEPTANCE_TESTS.md`;
3. consultar `docs/10_PRODUCTION_CHECKLIST.md`;
4. consultar o Security Gate mais recente;
5. exigir evidência de teste antes de marcar qualquer capacidade como PASS.

No fecho actual, funcionalidades que dependem de ambiente externo ou runtime físico/local permanecem pendentes até existir evidência real, mesmo que a fundação técnica esteja implementada.
