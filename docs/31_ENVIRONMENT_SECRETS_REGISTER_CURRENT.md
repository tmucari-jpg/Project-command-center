# PCC — Registo de Ambiente e Segredos

**Estado:** OFICIAL / CURRENT  
**Data:** 2026-10-13

> Este documento regista NOMES e finalidade. Nunca registar valores secretos.

## 1. Vercel

### Públicas
- `NEXT_PUBLIC_SUPABASE_URL` — endpoint Supabase.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — chave publicável.
- `NEXT_PUBLIC_SITE_URL` — URL pública PCC.

### Server-side / sensíveis
- `PCC_ADMIN_EMAILS` — allowlist administrativa.

Outras variáveis devem ser registadas aqui quando forem adicionadas.

## 2. Supabase

Geridos fora do GitHub:
- project credentials;
- database connection strings;
- service role;
- SMTP credentials;
- Auth settings.

## 3. Brevo

Credenciais SMTP ficam no Supabase/Auth ou secret manager apropriado.

## 4. GitHub

Não guardar secrets em:
- commits;
- issues;
- README;
- documentação pública.

## 5. Rotação

Rotacionar imediatamente quando:
- houver suspeita de exposição;
- colaborador deixar de precisar acesso;
- token estiver comprometido;
- política interna exigir.

## 6. Proibição

Nunca partilhar:
- password;
- token;
- service role;
- connection string;
- SMTP password;
- conteúdo real da allowlist admin.
