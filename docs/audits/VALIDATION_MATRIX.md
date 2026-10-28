# PCC — matriz de validação e dependências

Estado: candidato local, não release final. Não existe evidência de funcionalidade integral.

| Frente | Evidência disponível | Gate ainda aberto |
|---|---|---|
| IA gratuita | Política gratuita, health real, fallback e testes simulados | Modelo no browser/WebGPU e estabilidade no dispositivo |
| Português/factualidade | Contrato factual e esquema de resposta; geração documental determinística | Avaliação de respostas reais em português contra casos rotulados |
| Backend isolado | Migrações e testes SQL isolados | Supabase local Auth/Storage completo com duas contas |
| Entregáveis | Exportadores e arquivo com testes de integridade/permissões | Gerar, abrir, validar conteúdo e aceitar cada entregável aplicável |
| Informação em falta | Alertas com causa e próxima acção | Confirmar seguimento/responsável com dados de teste |
| Conversão Factory | Função transaccional, rollback injectado, repetição | Smoke real e concorrência no backend local |
| Financeiro/MZN | Zero, câmbio documentado, períodos e proveniência | Definir períodos e contagens verificadas dos indicadores reais |
| Mobile | PNG íntegros e origem oficial | Instalação nova/actualização, APK e dispositivo físico |
| Continuidade | Código e migrações disponíveis | Backup de dados/Storage/Auth e restauro completo demonstrado |
| Produção | Preservada | Aprovação e gates anteriores cumpridos |

Ordem: requisitos locais → backend isolado e migrações → dados/contas de teste → fluxos autenticados → artefactos e factualidade → dispositivo → restauro → revisão/aprovação → publicação → backup final verificável.

O relatório do PowerShell deve mostrar falhas e bloqueios; um cenário não executado nunca conta como aprovado. O pacote de testes não é o backup final solicitado.
