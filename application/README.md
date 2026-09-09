# Project Command Center — Application

Next.js application for the Project Command Center.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Required runtime variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
BRAVE_SEARCH_API_KEY
NEXT_PUBLIC_SITE_URL
```

The database schema and RLS policies are managed from the repository root under
`../supabase/migrations`.

For deployment instructions see `../docs/12_DEPLOYMENT.md`.
