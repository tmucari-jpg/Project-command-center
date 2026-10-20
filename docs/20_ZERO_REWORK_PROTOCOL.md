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
pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\RUN_PCC_SMOKE.ps1
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


### 6. Mistura de PowerShell 7 e Windows PowerShell 5.1

Problema observado:
- o operador iniciava o processo em PowerShell 7;
- o launcher abria internamente `powershell.exe` (Windows PowerShell 5.1);
- no passo npm, o pipeline do processo antigo podia ser terminado sem um erro npm útil, produzindo apenas `The pipeline has been stopped`.

Prevenção:
- o launcher e o FULL_SMOKE exigem PowerShell 7+;
- relaunches usam o próprio `pwsh.exe` de `$PSHOME`;
- referências a `powershell.exe` nos scripts de smoke são bloqueadas pelo CI;
- cada comando npm tem agora uma sub-etapa identificada (4.1 a 4.7);
- cada comando npm grava stdout/stderr em logs próprios e apresenta heartbeat enquanto está em execução;
- em falha, o smoke mostra o ExitCode e o fim dos logs relevantes.

Resultado:
- eliminamos a camada Windows PowerShell 5.1 do smoke;
- deixa de existir o estado ambíguo "parou no 4/12" sem saber qual comando estava activo.


### 7. Concorrência e alterações em paralelo durante o smoke

Problema observado:
- executar correcções, merges, deploys ou múltiplos smokes em paralelo pode fazer o teste começar numa versão e terminar noutra;
- processos Node antigos ligados ao PCC podem manter ficheiros bloqueados ou portas ocupadas;
- um PASS obtido sobre uma release que mudou durante o teste não é evidência válida.

Prevenção:
- o launcher usa um mutex Windows local para permitir apenas um smoke PCC por máquina;
- um lock de diagnóstico é escrito em `D:\07_BACKUPS\PROJECT_COMMAND_CENTER_RUNTIME\pcc-smoke.lock.json`;
- antes do smoke, processos `node.exe` cujo CommandLine pertence ao repositório PCC são encerrados;
- o launcher fixa o SHA exacto da release e passa-o ao FULL_SMOKE;
- o FULL_SMOKE valida que `HEAD` e o `origin/main` autoritativo continuam iguais ao SHA bloqueado;
- a verificação é repetida antes/depois dos blocos críticos, incluindo pós-CI, antes dos dados autenticados e antes do PASS final;
- se o remoto mudar durante a validação, o smoke termina e exige nova execução sobre a nova release;
- o CI verifica que os guardrails de single-flight e release lock continuam presentes.

Disciplina operacional durante o fecho:
- não fazer merge para `main` enquanto um smoke final estiver em execução;
- não iniciar outro smoke em paralelo;
- se surgir uma falha: parar → corrigir em branch → CI → merge → iniciar novo smoke completo;
- qualquer trabalho paralelo que não altere o PCC pode continuar, mas não pode modificar o release em validação.

Resultado:
- cada smoke passa a validar uma única versão imutável;
- eliminamos resultados híbridos e bloqueios provocados por processos concorrentes.


### 8. node_modules descartável por release

Problema observado:
- mesmo sem processos Node concorrentes, o Windows podia devolver `The directory is not empty` e `TAR_ENTRY_ERROR ENOENT` durante `npm ci`;
- tentar apagar e reconstruir o mesmo `node_modules` mantinha o smoke dependente de uma árvore parcialmente alterada e de locks do sistema de ficheiros;
- isso criava retrabalho e podia produzir sintomas diferentes a cada repetição.

Prevenção:
- o Step 4 deixa de instalar dependências dentro de `D:\03_PROJECTS\Project-Command-Center\application`;
- o smoke cria um `git worktree --detach` temporário da release SHA congelada;
- copia apenas o `.env.local` necessário para a execução;
- executa `npm ci`, UI standard, typecheck, testes, lint, audit e build nessa área isolada;
- o runtime local do Step 5 utiliza o mesmo build que passou no Step 4;
- se o primeiro `npm ci` falhar, essa árvore parcial nunca é reparada nem reutilizada;
- é criada uma segunda worktree totalmente limpa para uma única nova tentativa;
- se duas worktrees independentes falharem, o problema deixa de ser classificado como stale `node_modules` e o smoke termina para diagnóstico da máquina/npm;
- worktrees temporárias são removidas no `finally`;
- CI bloqueia o retorno ao antigo mecanismo de apagar `node_modules` dentro da working copy.

Resultado:
- o repositório de trabalho do operador deixa de ser modificado pelo `npm ci`;
- locks antigos de `node_modules` deixam de contaminar a validação seguinte;
- cada validação de dependências começa numa árvore fisicamente nova e ligada ao mesmo SHA da release.


### 9. Runtime antigo na porta do smoke

Problema observado:
- um servidor Next iniciado por uma worktree temporária anterior podia continuar vivo na porta 3000;
- o runtime da execução nova podia falhar ao arrancar por porta ocupada;
- o smoke verificava apenas se `/auth/login` respondia e podia aceitar a resposta do servidor antigo;
- isto produzia resultados impossíveis de reconciliar com o código da release actual, como o mesmo HTTP 307 após sucessivas correcções.

Prevenção:
- o launcher termina processos Node ligados tanto ao repositório como a caminhos `PCC_SMOKE`;
- antes do Step 5, o smoke verifica explicitamente a porta configurada;
- se a porta pertencer a um runtime PCC antigo, termina a árvore desse processo;
- se pertencer a processo não relacionado, o smoke pára sem matar esse processo;
- depois de iniciar o runtime actual, o smoke verifica em cada ciclo de readiness que o processo recém-lançado continua vivo;
- um servidor antigo já não pode satisfazer silenciosamente a readiness probe de uma release nova.

Resultado:
- cada smoke HTTP passa a testar o runtime da própria release congelada, não apenas qualquer servidor que esteja a responder na mesma porta.
