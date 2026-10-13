# PCC — Controlo Documental e Aprovações

**Estado:** OFICIAL / CURRENT  
**Data:** 2026-10-13

## 1. Objectivo

Garantir que a documentação oficial do PCC é versionada, rastreável e aprovada.

## 2. Estados documentais

- DRAFT
- REVIEW
- APPROVED
- SUPERSEDED
- ARCHIVED

Os documentos CURRENT deste pacote são a referência operacional vigente.

## 3. Metadados mínimos

Cada documento oficial deve conter:
- título;
- estado;
- data;
- versão quando aplicável;
- âmbito;
- responsável/owner quando formalmente atribuído.

## 4. Aprovação

Mudanças de baixo risco documental podem ser aprovadas com CI/document review.

Mudanças que alterem:
- segurança;
- acesso;
- dados;
- retenção;
- responsabilidades;
- release gates;

devem ser revistas juntamente com o código/configuração correspondente.

## 5. Histórico

Documentos substituídos permanecem no repositório para rastreabilidade, mas devem ser marcados como históricos quando houver risco de confusão.

## 6. Regra de precedência

Consultar `00_OFFICIAL_DOCUMENTATION_INDEX.md`.
