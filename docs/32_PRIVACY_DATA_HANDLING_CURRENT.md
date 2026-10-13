# PCC — Privacidade e Tratamento de Dados

**Estado:** OFICIAL / CURRENT  
**Data:** 2026-10-13

## 1. Princípio

Recolher e processar apenas dados necessários para execução, segurança, evidência e operação.

## 2. Categorias

O PCC pode conter:
- dados de conta;
- dados de projectos;
- tarefas/acções;
- evidências;
- métricas;
- decisões;
- contactos comerciais inseridos pelo utilizador;
- logs de segurança/execução.

## 3. Acesso

Dados de utilizador são isolados por RLS.

Acesso administrativo deve ser limitado às identidades aprovadas.

## 4. Segredos

Secrets não pertencem às tabelas funcionais nem à documentação.

## 5. Serviços terceiros

Ao usar serviços externos:
- enviar apenas contexto necessário;
- evitar dados desnecessários;
- respeitar permissões e finalidade;
- registar integrações relevantes.

## 6. Evidências

Não carregar documentos sensíveis sem necessidade operacional.

## 7. Eliminação

Eliminações irreversíveis devem exigir intenção clara e, quando aplicável, backup.

## 8. Conformidade

Este documento é uma política técnica interna e não substitui aconselhamento jurídico nem uma política de privacidade pública formal quando o PCC for disponibilizado a terceiros.
