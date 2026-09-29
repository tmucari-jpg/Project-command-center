# Força agêntica — planeamento e execução

Esta primeira versão integra três papéis na aplicação:

- **Planeamento:** assinala projectos activos sem acções, prazos passados, projectos em espera e projectos sem movimento há 14 dias. Propõe uma acção apenas quando o campo `next_action` já contém um passo concreto.
- **Prioridades:** ordena acções abertas por prioridade e proximidade do prazo, exclui as bloqueadas e propõe a próxima acção.
- **Bloqueios:** mostra bloqueios abertos e o projecto associado. Não os encerra automaticamente.

Em **Força agêntica → Analisar agora**, os papéis lêem até 200 registos de cada tipo da conta autenticada. O relatório é guardado em `ai_interactions` e as propostas em `ai_commands`. O utilizador aprova ou rejeita cada proposta. Na aprovação, o servidor volta a consultar a acção ou o projecto, verifica o estado, o texto e os bloqueios, e só depois escreve em `actions` ou chama `set_next_action`. Propostas repetidas que ainda estejam pendentes não são novamente criadas.

As recomendações desta fase são produzidas por regras versionadas (`regras-v1`), não por um modelo generativo. Não há pesquisa externa, execução programada nem envio de mensagens. Não se deve apresentar a análise como uma IA generativa. A data de referência usa UTC; os prazos guardados continuam a ser os da aplicação.

## Activação

1. Aplicar a migration `20260929062805_agent_command_approvals.sql` ao projecto Supabase ligado à aplicação.
2. Publicar a aplicação com a nova página `/agents`.
3. Iniciar sessão, executar a análise, aprovar uma proposta e confirmar o efeito em **Acções** e **Dashboard**.

Para verificar a política na base de dados, usar duas contas: a primeira deve conseguir ler e actualizar somente as suas propostas; a segunda não deve conseguir ler nem actualizar propostas da primeira. A aplicação não usa chave `service_role`.

## Plano dos projectos

A página `/portfolio` contém o modelo de monetização e acções iniciais para Contra, Moz Task, Maana, Rhengo, Briefing Diário, Roadmap AI Operations, AM Solutions, App de IA, Easy Propriety, Nosso Ride e o projecto de articulação pública. A secção **Todos os projectos da conta** lê os projectos reais, inclusive os criados fora do catálogo, e mostra acções abertas, bloqueios e inactividade. O botão **Adicionar projectos e acções** cria apenas os projectos em falta e acrescenta acções cujos títulos ainda não existem no projecto. Para projectos fora do catálogo, acrescenta uma acção de definição de cliente, oferta e receita. Não altera o estado de projectos existentes. Pode ser repetido após uma falha parcial.

Maana, Rhengo e Moz Task ainda têm descrições de produto por validar. Os respectivos modelos de receita são hipóteses de teste, não preços aprovados. O plano da Contra segue a [lista de conclusão de perfil](https://help.contra.com/en/articles/9322381-onboarding-and-completing-your-profile) publicada pela plataforma; disponibilidade de pagamentos e custos devem ser confirmados no momento do cadastro.
