# PCC — correcções em testes, 28/10/2026

Base: d794bdad; aplicação funcional de origem: 9df31f4a. Sem push ou publicação.

Implementação local:
- Política gratuita: inferência local; Groq complementar exige perfil enabled, cost_class free e PCC_GROQ_FREE_TIER=true. Chaves pagas não são seleccionadas. Limites gratuitos não são ilimitados. Sem credencial Groq configurada nesta sessão.
- Transporte único para health e geração, modelo obrigatório, resposta não vazia, URL normalizada e autenticação Groq. Falhas não alteram enabled automaticamente.
- Contexto canónico do workspace reutilizado nas rotas de assistência. Preenchimento local primeiro, sem substituir campos já preenchidos; tentativas de inicialização local recuperáveis.
- PNG derivados do logo oficial exacto; validação CRC, descodificação, dimensões, origem e paridade Android. Cache e URLs versionados.
- Moeda oficial MZN para novos registos. Zero observado preservado. Moedas diferentes exigem taxa, data e fonte; valores históricos não são relabelados. Etapas comerciais client/handoff e históricas won reconhecidas.
- Geração real DOCX/PDF, XLSX e PPTX com identidade PCC. Snapshot factual, arquivo privado, versões imutáveis, hash de integridade, evidência e download autenticado. QA/aceitação permanecem pendentes. Não cria websites ou aplicações fictícias para preencher os 18 entregáveis.

Activação no ambiente de testes:
1. Usar um backend isolado e aplicar a migração aditiva 20261028065323_generated_deliverable_artifacts.sql apenas nesse ambiente.
2. Configurar credenciais públicas desse backend e PCC_ARTIFACT_GENERATION_ENABLED=true nesse ambiente.
3. Abrir Entregáveis e gerar um rascunho num projecto de teste. Validar download, histórico e isolamento com duas contas.
4. Confirmar inferência WebGPU no dispositivo, instalação/actualização PWA e build/instalação Android.
5. Submeter diff e evidências para validação antes de qualquer publicação.

Verificação: testes unitários e integração SQL em PGlite com RLS, arquivo append-only, recuperação idempotente e bloqueio de entregável final. Build/typecheck, gates de ícones/UI e auditoria de dependências. Ficheiros de ensaio abertos/renderizados com LibreOffice; Word/PDF revistos visualmente. Estes testes não equivalem a uma sessão real de Supabase Auth/Storage ou instalação num telemóvel.

Pendências: aplicação da migração no backend de staging; smoke autenticado ponta a ponta; WebGPU no dispositivo; build/assinatura e instalação física Android; produção real e aceitação individual dos 18 entregáveis. A conversão de Factory para projecto com várias gravações continua a exigir tratamento transaccional separado identificado na auditoria inicial.
