# PCC — Operações e Resposta a Incidentes

**Estado:** OFICIAL / CURRENT  
**Data:** 2026-10-13

## 1. Rotina operacional

Verificar periodicamente:
- disponibilidade da produção;
- erros de autenticação;
- CI;
- Vercel deployments/runtime;
- Supabase health;
- Security Advisor;
- jobs de automação falhados;
- eventos de segurança;
- capacidade de backup.

## 2. Severidade

### Crítico
- exposição cross-user;
- bypass de autenticação;
- segredo comprometido;
- perda/corrupção de dados;
- outage prolongado;
- migration destrutiva falhada.

### Alto
- admin inacessível;
- Factory bloqueada;
- falha persistente de escrita;
- Auth parcialmente indisponível.

### Normal
- copy/UI;
- performance não crítica;
- avisos sem impacto operacional.

## 3. Processo de incidente

1. parar novas alterações;
2. preservar evidência/logs;
3. identificar impacto;
4. proteger segredos/contas se necessário;
5. escolher rollback ou correcção;
6. validar Auth/RLS;
7. executar smoke test;
8. documentar causa;
9. documentar acção correctiva;
10. encerrar apenas com evidência.

## 4. Comunicação

O registo do incidente deve conter:
- data/hora;
- impacto;
- componente;
- causa;
- mitigação;
- resolução;
- follow-up.

Nunca incluir secrets no relatório.

## 5. Mudanças emergenciais

Podem ser aplicadas directamente apenas quando:
- minimizam risco;
- têm rollback claro;
- são estritamente necessárias.

Depois:
- CI;
- documentação;
- release record;
- revisão pós-incidente.
