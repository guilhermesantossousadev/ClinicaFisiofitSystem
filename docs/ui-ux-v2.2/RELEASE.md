# Fisiofit UI/UX V2.2

**READY_FOR_REVIEW — revisão visual local, sem publicação ou merge.**

Branch: `feat/ui-ux-v2.2-20261015`. Worktree: `/private/tmp/fisiofit-ui-ux-v2.2-20261015`. Base exclusiva: `62936e604370170593e344a2cf466cf32efddc5a`, final da V2.1. O commit final é o HEAD desta branch. O checkout operacional original, as branches V2/V2.1 e produção foram preservados. Não houve fetch, pull, push ou deploy.

[Galeria comparativa](REVIEW.html) · [Matriz de aceite](ACCEPTANCE.md) · [Referências e decisões](REFERENCE_TRACEABILITY.md) · [Resultado verificável](evidence/acceptance.json)

## Calendário implementado

- Grade temporal com posicionamento por minuto e duração real, dia por profissionais e semana de segunda a sexta. A semana inclui automaticamente fins de semana com sessões; também é possível exibi-los explicitamente.
- Seleção de um ou vários profissionais, todos/nenhum, filtros reais de estado, tipo e sala, contagem, filtros aplicados e limpeza. Unidade utiliza o seletor autorizado já existente da V2.1.
- Anterior/próxima, Hoje, data direta, horário de Brasília, linha de agora e três níveis de zoom vertical. O intervalo visual expande para sessões válidas fora de 06h–21h; eventos que cruzam a meia-noite são segmentados por dia sem alterar os instantes.
- Sobreposições têm faixas horizontais distintas. Isso representa simultaneidade, sem classificar automaticamente um conflito. Validação de conflitos permanece no servidor.
- Dia por salas em modo de consulta, usando apenas relacionamentos existentes. Não há reserva exclusiva ou disponibilidade presumida.
- Painel lateral de ocorrência com resumo, participantes e Chamada. Inclui profissionais planejado/efetivo, unidade, sala, capacidade informativa e identificação da origem quando a ocorrência foi remarcada. Reposição e inclusão pontual vêm do roster Class.
- Chamada reutiliza handlers e endpoints homologados: abrir/selecionar não registra presença. Perfis sem edição podem consultar com controles de gravação ocultos. Correção, versão otimista e histórico existentes foram preservados.
- Foco contido no painel, retorno ao cartão por Escape/fechar e preservação de data, filtros e scroll. Confirmações e formulários existentes continuam com o Design System V2.1.
- No celular, lista cronológica legível e filtros recolhíveis. Tablet mantém a grade rolável. Ações existentes de criação, recorrência e exceção ficam próximas da Agenda sem ocupar sua área principal.

`OperationalCalendar`, `CalendarTimeGrid`, `CalendarEventCard`, `OccurrenceDetailsPanel` e `calendarModel` separam apresentação, geometria e contexto. Nenhuma biblioteca de calendário foi adicionada. Os módulos financeiro, pacientes e matrículas mantêm suas implementações aprovadas; a redução da perda de contexto concentra-se em Agenda → participantes → Chamada → mesma Agenda.

## Evidência executada

| Verificação final | Resultado |
|---|---|
| Typecheck, lint, lint do Design System e build completo | PASS; logs em `evidence/` |
| Vitest | 87 testes PASS, incluindo sete de tempo civil/overnight/sobreposição |
| Node | 34 testes PASS; assertions estruturais da Agenda adaptadas aos componentes extraídos, com escopo e ausência de acesso HTTP na apresentação verificados |
| Interface V2.1 | 28 novas capturas reais com as mesmas fixtures da candidata |
| Interface V2.2 | 39 capturas; 73 verificações PASS; zero violações axe detectadas nos estados capturados |
| Larguras | 1440, 1280, 768 e 390 CSS px; teste adicional de texto a 200% em 720 px e movimento reduzido |
| V2.1 operacional | 367 assertions SQL PASS; 44 requisições HTTP PASS; dez verificações de navegador PASS |
| V2.2 operacional | 367 assertions SQL PASS; 44 requisições HTTP PASS; vinte verificações de navegador PASS |
| API, migrations, fixtures SQL, definições/colunas do banco | Fingerprints comparativos iguais |
| Consulta operacional real | Fingerprint de memberships, participantes, presenças, revisões, appointments, matrículas, cobranças e pagamentos preservado |
| Geração legítima | Navegação para janela futura criou ocorrências; consulta subsequente idempotente; demais registros preservados |

Os testes operacionais usam Auth, PostgreSQL/RLS e Storage reais **locais**, banco descartável reconstruído pelas migrations do repositório e perfis sintéticos. Incluem bytes efetivamente armazenados/baixados, chamada persistida, conflito de versão, pagamento concorrente idempotente, isolamento entre clínicas/unidades e fluxo financeiro preservado. Os vinte checks da candidata incluem dez adicionais do calendário, com recepção e profissional responsável autenticados, além da administração. Veja [HTTP](evidence/operational/after/http-result.json), [navegador](evidence/operational/after/browser-result.json) e [comparação](evidence/operational/comparison.json).

A galeria usa um servidor de fixtures local separado: ela comprova UI e interação, sem alegar persistência ou segurança pelo mock. A comparação fixa a data de estudo em 15/10/2026, usa os mesmos 31 registros sintéticos semanais e os mesmos viewports. O hash do frontend validado é `53976a8f55bf53d97bd7a0d48f9a4f765e01660c64231a699a5eb3642ee52200`.

## Bloqueios anteriores e tentativas preservadas

Os 401 em `/me` e a falha de inicialização do Storage da entrega V2.1 **não foram apagados nem reclassificados como PASS histórico**. A base exata passou agora, sem modificação de backend, autenticação ou configuração de produção. Isso distingue o bloqueio anterior de uma regressão necessária da V2.2; a causa exata histórica continua não comprovada, pois aquelas execuções não conservaram telemetria suficiente. Não se alega que os episódios antigos tenham a mesma causa.

Uma rodada adicional da candidata, ao alternar rapidamente contas no runner, terminou FAIL com sete 401 em recursos operacionais, embora as verificações de conteúdo e persistência passassem. A rodada final manteve a assertion que rejeita qualquer HTTP >=400 e passou depois de aguardar o fim das requisições antes de cada logout. Essa evidência é compatível com interleaving de requisições na troca de sessão do teste; não prova a origem dos antigos 401 em `/me`. Não houve alteração de autenticação para obter o PASS.

As tentativas em [attempts](evidence/attempts/) preservam: medição inicial incorreta de scroll antes de focar cartão fora da tela; serialização de DOM do runner; comparação de nome de unidade afetada por uppercase; estado textual de cartão compacto; papéis ARIA corrigidos; unidade inicialmente não selecionada no teste operacional; nome incorreto da tabela de revisões no primeiro fingerprint; e a rodada 401 da troca de contas. Falhas de assertions foram corrigidas, não removidas. O runner original de estabilização mantém todas as assertions; recebeu apenas um hook opcional de calendário e telemetria sanitizada de etapas.

A documentação herdada cita um digest de cutover v82 diferente do fingerprint efetivo desta base. Esta entrega usa exclusivamente o backend presente em `62936e6`, com igualdade byte a byte verificada e digest efetivo `4a45cc47bf4231f4ea21161e11d13a9bc03635ca7960cc9dea7084645475aac0`. Não foi consultada ou recertificada a API remota de produção.

## Limitações deliberadas

- Sem drag-and-drop, gravação por movimento visual, criação por célula vazia ou contrato novo. Os fluxos existentes de criação/edição continuam explícitos, com validação do servidor. Não foi comprovado um contrato completo de concorrência/preview para drag-and-drop.
- Espaço sem evento não significa disponibilidade. Capacidade permanece informativa (RN-006), inclusive acima da referência; sala não é recurso exclusivo.
- A projeção não oferece sinal confiável de todas as exceções, reposições ou remarcações. O painel mostra remarcação quando o detalhe fornece `exception_date`; a origem dos participantes vem do roster. Não há badge inventado no cartão nem endpoint de histórico geral de ocorrência simulado. O histórico de chamada existente é consultável.
- Não há transferência inventada no painel. Alterações permanentes e transferência de vínculo permanecem nos fluxos existentes de turma; edição pontual continua claramente separada.
- Não há preferências locais compartilhadas entre usuários: filtros e zoom vivem nesta sessão da Agenda. O retorno da Chamada integrada conserva o contexto. Sair para outro módulo e remontar a Agenda conserva o comportamento de navegação da V2.1.
- A grade semanal pode exigir scroll horizontal para manter leitura com muitos profissionais/sessões simultâneas. Todos os cartões são botões com nome acessível completo. No mobile a grade é substituída pela lista cronológica.
- Não houve teste com leitor de tela, operação real pela equipe clínica ou certificação WCAG integral. Nenhuma redução de tempo foi inferida por aparência.
- O navegador conectado bloqueou `file://` para a galeria do ZIP. Seu HTML/manifesto e os dez estudos offline foram inspecionados localmente. Treze imagens externas puderam ser lidas; R10/R11 falharam em TLS e R14 retornou 403. As fontes oficiais e os padrões herdados foram considerados; a limitação está na rastreabilidade. A galeria de entrega está disponível como arquivo local para o usuário.

## Ganhos verificáveis e limites da medição

| Tarefa a partir da Agenda | V2.1 | V2.2 | Evidência |
|---|---|---|---|
| Abrir Chamada de uma ocorrência | Cartão + Abrir chamada: 2 cliques | Cartão + Chamada/Abrir chamada: 2 cliques | Screenshots e requests de consulta |
| Voltar da Chamada à mesma Agenda | Voltar + fechar: 2 cliques | Voltar + fechar: 2 cliques; Escape em camadas também funciona | Assertions de foco, data e scroll |
| Consultar participantes | 1 clique, modal com roster no resumo | 2 cliques, painel com seção dedicada | Compromisso explícito de organização; sem alegar menos cliques |
| Comparar responsáveis no dia | Cartões empilhados no dia, sem seletor de profissionais | Colunas com seleção de um/vários profissionais | `day-multiple-professionals`, `day-single-professional` |
| Interpretar duração | Texto de início/fim | Texto e altura proporcional | Assertion: 50 min = 90 px no zoom 108 px/h |
| Abrir/fechar detalhes | Modal sobre a Agenda | Painel contextual, filtros e scroll preservados | Capturas `details`, `participants`, testes de retorno |

Contagens são sequências de interação do runner, não estudo de tempo ou produtividade de usuários reais. O painel adiciona uma seleção de seção para roster; o benefício demonstrado é organização e continuidade, sem promessa de velocidade.

## Reprodução e continuidade

```sh
npm ci
npm run homologate:ui-v22
# Inclui também o ambiente sintético local identificado pelos guards existentes:
npm run homologate:ui-v22 -- --operational
# Recalcula somente o relatório; recusa evidência de frontend desatualizada:
npm run homologate:ui-v22 -- --report-only
```

O runner requer Chrome, stack local `secfinfinalb14` e Deno para a etapa operacional; recusa outro stack e clínicas fora da identidade sintética. `FISIOFIT_V22_BASELINE_ROOT` permite indicar a worktree limpa do SHA exato V2.1. Nenhum comando publica ou sincroniza. Graphify foi consultado e atualizado por AST; a dependência opcional de parsing SQL está ausente, portanto os testes PostgreSQL são a evidência do banco.

Próxima ação: abrir `REVIEW.html`, revisar as capturas de dia/semana, filtros e participantes e aprovar visualmente a branch. A aprovação não executa merge ou deploy. A memória contextual é registrada separadamente pela skill autorizada, sem commit, pull ou push do Vault.
