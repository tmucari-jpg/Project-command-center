# Testes locais PCC

Requisitos: PowerShell 7, Node 24, Git e um motor Docker compatível em execução. Não é necessário contratar Supabase Pro. Verifique a licença do motor de contentores escolhido para a sua organização.

Na raiz desta cópia do projecto:

```powershell
pwsh -NoProfile -File ./scripts/TEST_PCC_LOCAL.ps1 -StartApp
```

O script cria uma rede com publicação limitada a loopback, arranca Supabase local com CLI fixado, aplica as migrations locais, verifica Auth, configura apenas as variáveis do processo e executa os checks. Não executa git pull, supabase link/db push/db reset, deploy nem cópia dos dados de produção. Não substitui o launcher oficial existente: esse launcher sincroniza main e não deve ser usado para validar esta cópia modificada.

Primeiro arranque requer internet para descarregar ferramentas/contentores. O script não instala Docker, não activa planos pagos e não configura credenciais de IA cloud. Ao terminar, restaura as variáveis do processo; os contentores locais permanecem disponíveis.

Checks automáticos não equivalem ao fecho: criar contas locais distintas e validar Auth/Storage, permissões, exportação e repetição de operações, falhas de rede, restauro, WebGPU e dispositivo Android. Não atribuir PASS a testes não executados. Não carregar dados pessoais de produção para este ambiente sem plano de saneamento.

Estado nesta sessão: o ambiente de execução não disponibiliza pwsh nem Docker/Podman; o script está preparado, mas não foi executado aqui. A instalação e execução no computador são necessárias para comprovar o stack completo.

## Diagnóstico por execução

O comando único grava `tmp/local-validation/PCC-validation-<data>-<id>.json`, mesmo se faltar um requisito. Cada check tem estado `passed`, `failed` ou `blocked`; `fullyValidated` permanece falso enquanto os testes autenticados, WebGPU, dispositivo e restauro não tiverem evidência própria. Não contém chaves de acesso.

O launcher recusa motores Docker remotos, redes existentes sem publicação limitada a loopback e ficheiros `.env`/`.env.local` de execução. Faça os testes numa cópia sem esses ficheiros para que o Next.js não carregue credenciais de produção quando uma variável do processo estiver vazia. Não elimina nem substitui os ficheiros recusados. Aplica migrations pendentes com `migration up --local`, sem reset. Se `-StartApp` for usado, o servidor fica em primeiro plano e pode ser terminado com Ctrl+C.
