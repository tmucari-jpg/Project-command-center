# Gemini no PCC e GIE360°

## Implementação

O adaptador de texto existente usa a API compatível com Chat Completions do Google em `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`. O servidor envia a chave por cabeçalho, nunca por URL ou pelo navegador. O modelo é obrigatório e configurável: não se assume que um nome de modelo continue disponível ou gratuito. O mesmo motor serve o PCC e o assistente GIE360°, com os respectivos contextos autorizados.

Uma migração aditiva admite `gemini` no catálogo. Não cria perfis, não activa fornecedores, não altera registos existentes. Registar no PCC como **Google Gemini / Nuvem / Gratuito**, com capacidade `chat`, modelo disponível e prioridade pretendida. Validar faz geração real; configuração, resposta HTTP 200 vazia ou listagem de modelos não comprovam funcionamento. Uma falha de quota mantém diagnóstico real e permite tentar outro fornecedor gratuito explicitamente autorizado. Se todos falharem, o trabalho manual continua; não se simula IA.

## Configuração protegida no ambiente de testes

Definir no servidor ou nos Secrets do ambiente de testes, sem partilhar a chave em chat, no repositório ou na linha de comandos:

- `GEMINI_API_KEY`: chave de um projecto Google AI Studio elegível para utilização gratuita.
- `GEMINI_MODEL`: identificador de um modelo actualmente disponível no plano desse projecto.
- `PCC_GEMINI_FREE_TIER=true`: só após verificar que o projecto permanece no plano gratuito sem facturação paga. Esta declaração local não verifica nem impõe o estado de facturação na Google.
- `PCC_GEMINI_DATA_PROCESSING_ACCEPTED=true`: só após verificar os termos aplicáveis e aprovar o envio do contexto autorizado. O plano gratuito pode usar conteúdo para melhorar produtos Google; aplicar a política da organização antes de enviar informação empresarial.

Os valores de exemplo mantêm os serviços desactivados. Apenas o servidor recebe as credenciais; não usar prefixo `NEXT_PUBLIC_`. Não existe promoção automática para um plano pago. A quota é por projecto e modelo, pode ser zero, e não constitui garantia de disponibilidade. Confirmar os limites no AI Studio e manter outro fornecedor autorizado ou inferência local compatível.

## Verificação

A execução integrada pode chamar `npx tsx scripts/test-gemini-live.ts` a partir de `application`. Por defeito gera `validation-gemini.json` com estado **blocked** e não envia pedidos. A opção `--live` autoriza a sonda com dados exclusivamente sintéticos e exige chave, modelo e as duas declarações. A opção adicional `--required` faz a execução falhar se o teste real estiver bloqueado.

A sonda realiza geração e verifica uma resposta em português com total sintético MZN 120, conversão observada de 0% e ausência de informação para lucro. Não lê dados do PCC, não guarda respostas nem credenciais no relatório. Uma passagem comprova apenas estes pedidos no instante da execução; não comprova todos os resultados, disponibilidade contínua, instalação PWA ou APK. Os indicadores oficiais continuam a ser calculados por funções determinísticas com proveniência.

Os testes unitários cobrem geração, normalização do endpoint, segredo e modelo ausentes, credenciais inválidas, quota, resposta vazia, destino não autorizado, rejeição de perfis pagos/desactivados, fallback e indisponibilidade total. São distintos de uma ligação real ao fornecedor.

## Fontes oficiais consultadas em 28/10/2026

- https://ai.google.dev/gemini-api/docs/openai
- https://ai.google.dev/gemini-api/docs/rate-limits
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/troubleshooting
