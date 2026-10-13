# PCC — Backup, Recuperação e Continuidade

**Estado:** OFICIAL / CURRENT  
**Data:** 2026-10-13

## 1. Objectivo

Garantir recuperação de dados e configuração após erro humano, falha de migration, corrupção ou incidente.

## 2. Backup lógico

Usar o runbook e script existentes para criar backup lógico Supabase fora da produção.

Conteúdo esperado:
- roles;
- schema;
- data;
- checksums;
- manifest.

Nunca guardar connection strings no backup.

## 3. Frequência

Obrigatório antes de:
- migrations destrutivas;
- alterações de ownership/RLS de alto risco;
- operações massivas;
- releases estruturais relevantes.

Recomendado:
- backup periódico fora do ambiente de produção.

## 4. Verificação

Um backup só é válido quando:
- ficheiros existem;
- não estão vazios;
- checksum existe;
- dump é legível;
- localização é off-production;
- timestamp e release estão registados.

## 5. Recuperação

1. criar/seleccionar ambiente seguro;
2. restaurar roles/schema/data conforme tooling suportado;
3. reconfigurar Auth/Storage/SMTP;
4. reaplicar migrations;
5. validar RLS;
6. validar aplicação;
7. validar persistência;
8. só depois trocar produção.

## 6. Continuidade

Código:
- GitHub.

Deploy:
- Vercel.

Dados:
- Supabase + backup lógico.

Segredos:
- gestores de ambiente; nunca GitHub.

Documentação:
- `/docs`.

## 7. RTO/RPO

Enquanto não houver SLA empresarial formal:
- RTO e RPO devem ser tratados como best-effort;
- alterações críticas exigem backup imediatamente anterior;
- upgrade de plano pode ser necessário para garantias superiores.
