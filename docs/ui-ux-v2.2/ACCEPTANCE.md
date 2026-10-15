# Matriz de aceite V2.2

Fontes: [UI](evidence/after/result.json), [SQL/HTTP](evidence/operational/after/summary.json), [navegador autenticado](evidence/operational/after/browser-result.json), [modelo temporal](../../apps/portal/src/presentation/calendar/calendarModel.test.ts). PASS significa somente o escopo descrito. Limitações e falhas anteriores permanecem no [relatório](RELEASE.md).

| # | Critério | Evidência final / alcance |
|---|---|---|
| 1 | Dia | PASS; três colunas, horas reais, capturas nas quatro larguras |
| 2 | Semana | PASS; segunda–sexta, navegação, expansão explícita de fim de semana |
| 3 | Datas | PASS; próxima/anterior, data direta, Hoje; modelo testa limite de ano e UTC |
| 4 | Unidade | PASS; troca esconde registros anteriores; API/RLS real preservada |
| 5 | Um profissional | PASS; somente a coluna escolhida |
| 6 | Vários profissionais | PASS; seleção múltipla e todas/nenhuma |
| 7 | Simultaneidade legítima | PASS; partição de intervalos, faixas distintas e SQL operacional |
| 8 | Conflitos reais | PASS no SQL operacional existente; frontend não redefine conflito |
| 9 | Recorrência | PASS; consulta futura real cria ocorrências normalmente |
| 10 | Remarcação | PASS; horário efetivo da projeção e data de origem no detalhe; SQL existente |
| 11 | Substituição | PASS; profissional efetivo recebe o bloco; indicador textual; SQL existente |
| 12 | Cancelamento | PASS; estado textual; Chamada cancelada em consulta; comandos existentes preservados |
| 13 | Painel lateral | PASS; foco contido, Escape, camada de detalhes |
| 14 | Participantes | PASS; mock controlado de três origens e roster real persistido de dois pacientes |
| 15 | Chamada | PASS; mesmo endpoint/handlers, conteúdo autorizado e fluxo existente de gravação |
| 16 | Retorno/contexto | PASS; data, foco e scroll após painel; nenhuma desmontagem ao abrir Chamada |
| 17 | Perfis | PASS; administração, recepção e profissional em Auth real; manager/read-only também na UI sintética |
| 18 | Isolamento | PASS; filtro de unidade na UI e negativas Auth/RLS/HTTP herdadas |
| 19 | Responsividade | PASS nos estados capturados a 1440/1280/768/390; texto 200% em 720 |
| 20 | Teclado | PASS; Tab/Shift+Tab, Escape e foco; cartões são botões nativos; sem leitor de tela nesta rodada |
| 21 | Consulta sem mutação inesperada | PASS; zero comandos operacionais nas consultas mock e fingerprint real antes/depois |
| 22 | Geração legítima preservada | PASS; janela futura cria ocorrências; nova consulta não duplica; não ativa modo read-only temporário |
| 23 | Financeiro e demais módulos | PASS na regressão existente de pagamentos, matrícula e prontuário/Storage, 87 Vitest e 34 Node; não equivale a ensaio manual de todos os módulos |

Sem alteração de API, schema, RLS, migrations, contratos ou regras. Sem capacidade bloqueante. Sem estados financeiros nos cartões. Sem reserva de sala, disponibilidade ou histórico fictícios.
