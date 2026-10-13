# PCC — Gestão de Mudanças

**Estado:** OFICIAL / CURRENT  
**Data:** 2026-10-13

## 1. Classes de mudança

### Baixo risco
- copy;
- estilos;
- labels;
- documentação;
- testes;
- índices não destrutivos.

Pode avançar automaticamente quando validado.

### Médio risco
- regras de negócio;
- hierarquias;
- automações;
- novas migrations não destrutivas;
- autorização não crítica.

Exige CI e validação funcional.

### Alto risco
- Auth;
- RLS;
- secrets;
- domains;
- pagamentos;
- permissões;
- deletes/migrations destrutivas;
- rollback de produção.

Exige validação explícita, backup e rollback.

## 2. Fluxo

1. definir mudança;
2. avaliar risco;
3. implementar mínimo necessário;
4. testar;
5. CI;
6. rever segurança;
7. consolidar;
8. deploy único;
9. smoke;
10. documentar.

## 3. Regra de consolidação

Evitar múltiplos deploys quando várias alterações podem ser consolidadas com segurança.

## 4. Evidência

Cada release deve poder ser ligada a:
- commit;
- CI;
- deployment;
- migrations;
- smoke;
- release record.
