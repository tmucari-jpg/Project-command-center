# DEPLOY NOW — Project Command Center

Este ficheiro contém apenas a sequência necessária para colocar a implementação a funcionar.

## 1. Colocar este código no GitHub

Substitua/adicione no repositório `Project-command-center` os ficheiros deste pacote e faça commit.

A estrutura principal deverá conter:

```text
.github/
application/
docs/
supabase/
.gitignore
README.md
```

## 2. Instalar e validar a aplicação

No terminal:

```bash
cd application
npm install
npm run typecheck
npm test
npm run lint
npm run build
```

Se estes quatro comandos passarem, execute localmente:

```bash
npm run dev
```

## 3. Configurar variáveis locais

Copie:

```bash
cp .env.example .env.local
```

Preencha `application/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
BRAVE_SEARCH_API_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Nunca faça commit de `.env.local`.

## 4. Aplicar a base de dados no Supabase

Na raiz do repositório:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

O `--dry-run` deve ser revisto antes do `db push`.

## 5. Configurar Auth no Supabase

Para desenvolvimento:

```text
Site URL: http://localhost:3000
Redirect URL: http://localhost:3000/auth/callback
Redirect URL: http://localhost:3000/auth/update-password
```

Depois do deploy, acrescente os equivalentes `https://SEU-DOMINIO/...`.

## 6. Configurar Brave

Crie uma Brave Search API key e use-a somente em:

```text
BRAVE_SEARCH_API_KEY
```

A aplicação envia a chave ao Brave apenas a partir do backend.

## 7. Deploy na Vercel

Na Vercel:

1. **Add New → Project**
2. Importar o repositório GitHub `Project-command-center`
3. **Root Directory = `application`**
4. Framework = **Next.js**
5. Adicionar:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `BRAVE_SEARCH_API_KEY`
   - `NEXT_PUBLIC_SITE_URL`
6. Fazer **Deploy**

Depois de obter o domínio Vercel, defina `NEXT_PUBLIC_SITE_URL` para esse domínio e actualize
os URLs de Auth no Supabase.

## 8. Teste final antes de Production

Use pelo menos dois utilizadores diferentes e confirme:

- utilizador A não vê nem altera dados do utilizador B;
- signup/login/logout/password recovery;
- Objectives → Projects → Deliverables → Actions;
- Next Best Action;
- Focus timer e actualização de tempo;
- blockers, evidence, metrics e ideas;
- Brave Search autenticado;
- pesquisa inválida / rate limit;
- acesso a `/dashboard` sem login redirecciona para login;
- layout em telemóvel.

Só depois destes testes marque a Production Checklist como concluída.
