# PCC — Registo Oficial de Integrações

**Estado:** OFICIAL / CURRENT  
**Data:** 2026-10-13

## 1. GitHub

Finalidade:
- source control;
- CI;
- histórico de mudanças.

Dados:
- código;
- documentação;
- migrations.

Não guardar:
- secrets;
- backups de produção;
- credenciais.

## 2. Vercel

Finalidade:
- build/deploy;
- hosting;
- runtime;
- variáveis de ambiente.

Dados/configuração:
- aplicação compilada;
- environment variables.

Segredos:
- `PCC_ADMIN_EMAILS` e outros server-side quando aplicável.

## 3. Supabase

Finalidade:
- Auth;
- PostgreSQL;
- RLS;
- Storage;
- funções/RPC.

Dados:
- dados operacionais PCC;
- logs/registos técnicos quando configurados.

## 4. Brevo

Finalidade:
- SMTP do Supabase Auth.

Regra:
- credenciais apenas em configuração segura.

## 5. n8n

Finalidade:
- execução de automações quando configurado.

Regra:
- jobs com aprovação quando exigida;
- payload mínimo necessário;
- callback controlado.

## 6. Serviços inteligentes

Qualquer provider/serviço deve:
- ser explicitamente configurado;
- ter estado operacional validado;
- respeitar minimização de dados;
- não ser apresentado como activo sem evidência.

## 7. Nova integração

Antes de activar:
1. finalidade;
2. dados enviados;
3. dados recebidos;
4. autenticação;
5. secrets;
6. risco;
7. rollback/desactivação;
8. documentação;
9. teste.
