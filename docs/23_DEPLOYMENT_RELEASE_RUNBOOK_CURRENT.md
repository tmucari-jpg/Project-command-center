# PCC — Deployment e Release Runbook

**Estado:** OFICIAL / CURRENT  
**Data:** 2026-10-13

## 1. Regra

Não fazer deploys intermédios desnecessários. Consolidar alterações e publicar uma única versão validada.

## 2. Gate pré-deploy

Obrigatório:
- branch `main` estável;
- CI verde;
- typecheck PASS;
- testes PASS;
- lint PASS;
- build PASS;
- migrations sincronizadas;
- variáveis de ambiente presentes;
- backup/rollback disponível para alterações de risco.

## 3. Ambiente Vercel

Projecto: Project Command Center.

Root Directory:
`application`

Variáveis mínimas:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `PCC_ADMIN_EMAILS` — sensível, server-side

Outras variáveis devem ser adicionadas apenas quando utilizadas.

## 4. Release actual pendente

O deploy consolidado está temporariamente bloqueado pelo limite diário de deployments do plano Vercel.

Não criar deploys de teste adicionais enquanto o limite não libertar.

Quando disponível:
1. confirmar `main` actual;
2. confirmar CI do último commit;
3. criar um único deployment target `production`;
4. esperar `READY`;
5. confirmar alias de produção;
6. executar smoke test;
7. preencher Release Record.

## 5. Smoke test pós-deploy

Validar:
- landing;
- login;
- recuperação de acesso;
- protecção de rotas privadas;
- acesso admin;
- Factory;
- criação/leitura das entidades principais;
- logout;
- responsividade.

## 6. Rollback

Código:
- promover deployment Vercel conhecido e estável correspondente a commit aprovado.

Base:
- restaurar backup lógico verificado;
- reaplicar migrations necessárias;
- revalidar RLS/Auth.

## 7. Critério de release

Release só é APPROVED quando:
- deployment READY;
- domínio correcto;
- smoke test PASS;
- segurança sem blocker novo;
- rollback conhecido;
- registo de release preenchido.
