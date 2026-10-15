# Rastreabilidade visual V2.2

O pacote obrigatório foi extraído nesta worktree e lido antes da implementação. O mosaico e os dez estudos autorais foram analisados; treze capturas externas foram obtidas para estudo local, sem inclusão no bundle ou redistribuição dessas imagens baixadas. O HTML original da galeria foi lido como arquivo: a política do navegador conectado bloqueia file://. A disponibilidade de cada imagem está em [reference-sources.json](evidence/reference-sources.json).

A implementação é original e conserva os tokens e componentes V2.1. Fontes primárias consultadas: [Jane](https://jane.app/guide/working-with-the-schedule), [preferências Jane](https://jane.app/guide/schedule-view-settings), [salas Jane](https://jane.app/guide/room-booking), [ícones Jane](https://jane.app/guide/icons-on-the-schedule), [lição Schedule](https://jane.app/guide/lesson-1-schedule), [Linear filtros](https://linear.app/docs/filters), [display](https://linear.app/docs/display-options), [busca](https://linear.app/docs/search), [Shopify](https://shopify.dev/docs/apps/design), [Stripe](https://docs.stripe.com/), [Notion](https://www.notion.com/help), [Cliniko](https://www.cliniko.com/features/), [Fresha](https://www.fresha.com/help-center/knowledge-base/calendar), [Mindbody](https://www.mindbodyonline.com/business/fitness/pilates-software), [NN/g](https://www.nngroup.com/articles/ten-usability-heuristics/), [WCAG 2.2](https://www.w3.org/TR/WCAG22/) e [APG](https://www.w3.org/WAI/ARIA/apg/).

| ID / produto | Padrão e adaptação Fisiofit | Componente | Captura / evidência | Verificação | Divergência / limite |
|---|---|---|---|---|---|
| R01 / Jane App | Grade temporal, dia/semana, duração e profissionais | CalendarTimeGrid / OperationalCalendar | week-1440, day-multiple-professionals-1440 | Geometria/UTC; modos e profissionais | Sem marca, assets ou disponibilidade presumida |
| R02 / Jane App | Profissionais à esquerda e detalhe contextual | OperationalCalendar / OccurrenceDetailsPanel | details-1440 | Roster e chamada sem mutação | Sem informação de cobrança no cartão |
| R03 / Fresha | Dia por responsável, adaptação mobile | CalendarTimeGrid / CalendarEventCard | day-multiple-professionals-390 | Colunas, lista cronológica | Paleta e controles V2.1 |
| R04 / Cliniko | Data direta e fluxo explícito de edição | OperationalCalendar / formulários V2.1 existentes | details-1440 | Data direta, retorno, Node | Sem criação por célula vazia |
| R05 / Cliniko | Semana operacional e seleção de pessoas | OperationalCalendar | week-1440, day-single-professional-1440 | Semana segunda–sexta e filtros | Referência visual lida; contratos vindos da API local |
| R06 / Zenamu | Turmas recorrentes e rótulos compactos | CalendarEventCard / calendarModel | week-1440 | Materialização real e idempotência | Sem agendamento público |
| R07 / Mindbody / Loop | Lista operacional de turmas e chamada | CalendarEventCard / chamada existente | attendance-390 | Roster e fluxo autenticado | Sem segunda regra de chamada |
| R08 / Linear | Filtros ativos visíveis e contagem | OperationalCalendar | day-single-professional-1440 | Estado, profissional e limpar | Sem tema escuro ou filtros não suportados |
| R09 / Linear | Filtros próximos à tarefa e recolhimento | OperationalCalendar | day-multiple-professionals-390 | Filtros e viewport | Sem busca genérica sem finalidade |
| R10 / Shopify Polaris | Preservação de tabelas/componentes aprovados | Design System V2.1 / formulários herdados | details-1440; galeria V2.1 herdada | 87 Vitest / 34 Node | Imagem remota indisponível (TLS); fonte oficial Shopify estudada; sem nova refatoração dessas tabelas |
| R11 / Shopify Polaris | Densidade com leitura e alinhamento consistente | CalendarEventCard / componentes V2.1 | week-1440 | Axe, texto mínimo e reflow | Imagem remota indisponível (TLS); manifesto e fonte oficial considerados |
| R12 / Shopify Engineering | Labels e validação herdados | FormPrimitives V2.1 / edição existente | details-1440 | Regressão de formulários existente | Não refeitos os controles V2.1 |
| R13 / Stripe | Separação entre operação clínica e financeiro | Cartões / financeiro preservado | operational/after/browser-finance-paid.png | Pagamento persistido e idempotência | Sem nova tela financeira; nenhuma presença inferida de pagamento |
| R14 / Stripe | Preservação de valores e estados financeiros claros | Financeiro V2.1 preservado | operational/after/browser-finance.png | Regressão financeira real | Imagem remota retornou 403; não se alega inspeção da imagem; padrão contextual do manifesto e fonte oficial Stripe |
| R15 / Notion | Detalhe lateral mantendo a agenda visível | OccurrenceDetailsPanel | details-1440, participants-1440 | Foco, data e scroll no retorno | Painel usa stack acessível V2.1 |
| R16 / Notion | Propriedades e seções contextuais | OccurrenceDetailsPanel / conteúdo existente | participants-1440, attendance-1440 | Roster, chamada e histórico existente | Sem endpoint inventado de histórico geral |

## Estudos offline

| Estudo | Decisão aplicada / preservada | Evidência |
|---|---|---|
| 01 Jane dia | Grade temporal e colunas efetivas | day-multiple-professionals |
| 02 Jane semana | Semana operacional, datas e scroll de grade | week |
| 03 Painel da turma | Resumo e roster em seções, mantendo contexto | details / participants |
| 04 Filtros | Seleção múltipla, estado, tipo, sala e limpar | day-single-professional |
| 05 Chamada | Mesmo fluxo existente em painel | attendance / Auth real |
| 06 Pacientes | Preservado o detalhe V2.1; sem refatoração adicional | 87 Vitest / regressão de paciente/prontuário |
| 07 Financeiro | Preservada separação cobrança/recebimento/saldo | HTTP + browser-finance-paid |
| 08 Responsiva | Lista cronológica e filtros recolhíveis | day-multiple-professionals-390 |
| 09 Formulários | Componentes finalizados V2.1 preservados | Node / typecheck / lint |
| 10 Preferências | Zoom, fim de semana e consulta por salas | rooms / assertions de zoom |

As capturas citadas estão na [galeria](REVIEW.html). Os nomes sem extensão correspondem aos PNGs em `evidence/after/`; os exemplos operacionais ficam em `evidence/operational/after/`. Não se afirma aplicação nova a todos os módulos: pacientes, matrículas e financeiro aproveitam a V2.1 e têm regressão proporcional. Nenhuma imagem é contrato de backend.
