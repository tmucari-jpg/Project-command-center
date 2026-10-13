# PCC — Guia do Administrador

**Estado:** OFICIAL / CURRENT  
**Data:** 2026-10-13

## 1. Acesso

A Administração só aparece para utilizadores reconhecidos como admin.

Métodos aceites:
- role global `owner/admin`;
- allowlist server-side aprovada.

## 2. Responsabilidades

O administrador gere:
- segurança;
- serviços inteligentes;
- orquestração;
- biblioteca técnica;
- optimização;
- agentes e aprovações;
- estado técnico.

## 3. O que não deve fazer

- colocar secrets em campos normais;
- editar dados de produção por SQL sem necessidade;
- remover RLS;
- promover provider/serviço não validado;
- executar acções irreversíveis sem backup/rollback.

## 4. Administração de IA/serviços

A UI deve mostrar apenas capacidades efectivamente disponíveis.

Nunca apresentar:
- provider inexistente;
- runtime local não ligado;
- sincronização offline como concluída sem evidência.

## 5. Orquestração

As rotas determinam:
- agente;
- estratégia;
- política;
- aprovação quando aplicável.

Campos técnicos devem permanecer em área administrativa.

## 6. Auditoria

Após mudança relevante:
- CI;
- advisor Supabase;
- smoke test;
- release record.

## 7. Falha de acesso admin

Verificar:
1. sessão autenticada;
2. variável `PCC_ADMIN_EMAILS`;
3. role em `user_roles`;
4. deploy actual;
5. logs;
6. não contornar autorização via frontend.
