# PCC — Protocolo Zero Retrabalho

## Objectivo

Transformar erros operacionais encontrados durante o fecho do Project Command Center em controlos permanentes, para que a mesma classe de problema não volte a consumir tempo.

## Regra principal

Um erro corrigido apenas manualmente é considerado **parcialmente corrigido**.

A correcção só está completa quando existe pelo menos um destes controlos:

- prevenção automática;
- detecção precoce;
- teste automatizado;
- mensagem de diagnóstico accionável;
- registo no runbook/checklist.

## Comando único do operador

Para smoke final e futuras regressões em Windows/PowerShell, usar apenas:

```powershell
cd D:\03_PROJECTS\Project-Command-Center
powershell -ExecutionPolicy Bypass -File .\scripts\RUN_PCC_SMOKE.ps1
```

O operador não deve executar `FULL_SMOKE_POWERSHELL.ps1` directamente em condições normais.

## Barreiras implementadas

### 1. Repositório desactualizado

Problema observado:
- o computador local podia continuar num commit anterior;
- um `git pull` durante o próprio smoke podia actualizar os ficheiros no disco;
- contudo, o PowerShell já tinha carregado a versão antiga do script em memória e continuava a executá-la.

Prevenção:
- o launcher consulta `git ls-remote origin refs/heads/main` para obter o SHA autoritativo;
- força a actualização de `origin/main`;
- confirma `local HEAD == origin/main == remote main`;
- só depois inicia um **novo processo PowerShell** que lê o smoke actualizado do disco;
- o próprio FULL_SMOKE também se relança se detectar que o commit mudou durante a sincronização.

Resultado:
- um script antigo não pode continuar silenciosamente depois de actualizar o repositório.

### 2. Alterações locais em .gitignore

Problema observado:
- uma alteração local em `.gitignore` interrompia o smoke antes de começar.

Prevenção:
- se a única alteração local for `.gitignore`, o launcher cria automaticamente um stash temporário;
- executa o smoke com working tree limpa;
- restaura `.gitignore` no fim;
- se houver qualquer outro ficheiro modificado, o processo pára para proteger trabalho real.

Resultado:
- elimina a intervenção manual repetitiva sem esconder alterações relevantes.

### 3. npm ci / ENOTEMPTY em Windows

Problema observado:
- Windows podia manter ficheiros de `node_modules` bloqueados;
- `npm ci` falhava com `ENOTEMPTY`;
- em alguns casos, o wrapper `npm` encerrava o PowerShell filho sem diagnóstico suficiente.

Prevenção:
- o smoke chama `npm.cmd` explicitamente;
- cada comando npm é executado como processo filho isolado;
- o ExitCode é capturado;
- em falha de `npm ci`, termina apenas processos `node.exe` associados ao repositório PCC;
- remove apenas `application\node_modules`;
- executa `npm cache verify`;
- faz uma única tentativa limpa adicional;
- se persistir, termina com erro claro.

Resultado:
- falhas de lock deixam de gerar ciclos de tentativa manual sem diagnóstico.

### 4. Remote tracking stale

Problema observado:
- confiar apenas no ref local `origin/main` pode ocultar uma referência desactualizada.

Prevenção:
- o SHA do GitHub remoto é obtido directamente com `git ls-remote`;
- o fetch usa o refspec explícito:
  `+refs/heads/main:refs/remotes/origin/main`;
- o processo compara os três SHAs antes de continuar.

Resultado:
- "Already up to date" só é aceite depois de validação contra o remoto autoritativo.

### 5. CI e sintaxe PowerShell

Prevenção:
- CI valida a sintaxe de:
  - `RUN_PCC_SMOKE.ps1`;
  - `FULL_SMOKE_POWERSHELL.ps1`;
- CI continua a executar instalação, UI standard, typecheck, testes, lint, audit e build.

Resultado:
- alterações nos scripts de operação não entram no main sem validação mínima automatizada.

## Regra de aprendizagem contínua

Sempre que o smoke encontrar um novo FAIL recorrível:

1. identificar a causa raiz;
2. corrigir o problema imediato;
3. perguntar: "como impedimos esta classe de erro de voltar?";
4. acrescentar prevenção/detecção ao código ou script;
5. acrescentar teste no CI quando possível;
6. actualizar este protocolo/checklist;
7. só então considerar a ocorrência encerrada.

## Critério Zero Retrabalho

Uma ocorrência pode ser marcada como aprendida quando:

- existe causa raiz conhecida;
- existe protecção permanente;
- existe diagnóstico claro caso volte a acontecer;
- existe evidência de CI/teste;
- o operador não precisa memorizar uma sequência manual especial.

## Limite

Nenhum sistema elimina 100% dos erros futuros.

O objectivo deste protocolo é eliminar **erros repetidos da mesma classe** e reduzir o custo de diagnóstico dos novos erros.
