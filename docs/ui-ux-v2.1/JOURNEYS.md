# Jornadas e limites da homologação V2.1

As evidências visuais usam fixtures locais e rede restrita a loopback. Elas validam interface e interação, sem demonstrar persistência, RLS ou concorrência. A regressão operacional separada usa banco descartável, Auth/RLS/Storage reais locais e fonte local preservada da API v82.

| Jornada solicitada | Avaliação e refinamento | Evidência da interface / limite |
|---|---|---|
| 1. Cadastrar paciente | Labels, obrigatório, blur/envio, sumário navegável, preservação e envio em andamento | Drawer nas quatro larguras; testes dirigidos de validação e criação sintética; persistência desta criação não é alegada pelo mock |
| 2. Localizar/editar paciente | Busca aplicada visível, contexto mantido ao fechar detalhes/edição, erro preservando campos | `patient-details`, `patient-edit`, ordenação e teste de edição inválida |
| 3. Criar matrícula/selecionar plano | Seletor de paciente explícito, Escape em camadas, plano/valor e unidade/turma dependentes preservados | `drawer-enrollment-*`; teste de combobox dentro do modal; contratos de matrícula preservados |
| 4. Trocar plano com impacto | Datas brasileiras, descarte protegido e prévia invalidada após mudar os campos | `dialog-plan-change-*`, `dialog-plan-preview-*`, teste de invalidação da prévia |
| 5. Consultar cobrança/recebimento | Valor contratado/cobrado/recebido continuam distintos; ajustes protegem edição e erros | `matriculas-*`, `dialog-corrigir-cobranca-*`, `dialog-editar-condicao-contratual-*`; operação persistida depende da suíte operacional |
| 6. Localizar turma/participantes | Navegação Dia/Semana e detalhes mantidos; ações identificam consequência | `agenda-*`, `agenda-day-*`, `occurrence-details`; nenhuma regra de ocupação alterada |
| 7. Adicionar/transferir paciente | Pesquisa/seleção refinadas no componente compartilhado; formulários e handlers de transferência preservados | Auditoria dos consumidores de PatientPicker e formulários da agenda; não há alegação de transferência persistida pela galeria |
| 8. Chamada/histórico | Labels de registrar/corrigir presença; justificativa e histórico preservados | `attendance-roster`, `attendance-correction-reason-*`, `chamada-diaria-*` |
| 9. Crédito/reservas de reposição | Componentes herdados, estados e escolhas disponíveis inspecionados; regras intactas | Galeria de chamada e inspeção de MakeupBookings; SQL inclui 86 assertions operacionais, não execução de cada reserva pela UI |
| 10. Prontuário/anexo | Seleção anunciada, resposta atrasada ignorada, cancelamento da retificação encerra o fluxo; abertura autorizada intacta | `records-selected`, `picker-selected-1440`, testes de atraso; bytes/autorização dependem do HTTP local |
| 11. Período/unidade | Contagem e limpar filtros no controle mensal; ano aplicado explicitamente; invalidação de resposta antiga | `financial-filters-390`, `filters-cleared-1440`, `relatorios-*`, código de versionamento do relatório |
| 12. Usuários/permissões | Formulários, required, checkbox, alvo e foco compartilhados; descarte e exclusão nomeados | `usuarios-*`, `drawer-convidar-colaboradora-*`; nenhum convite de produção nem alteração de permissões reais |

As 12 jornadas foram avaliadas; a tabela distingue inspeção, teste de interface e persistência. Não equivale a afirmar que cada operação condicional foi executada com backend real.

A suíte operacional manteve todas as assertions. Os dois testes comparativos SQL passaram em 367 assertions, mas o navegador recebeu 401 em `/me` tanto na base V2 quanto na candidata durante autenticação/validação de acesso. Essas rodadas continuam FAIL. Assim, o fechamento integral das jornadas autenticadas permanece bloqueado e a UI não recebe certificação WCAG integral.

Foram usados eventos reais de teclado via Chrome DevTools: Tab/Shift+Tab, setas, Home, Enter e Escape, com assertions de foco e estado, somados à inspeção visual das amostras. Não foi realizada sessão com VoiceOver/NVDA nem homologação com profissionais da clínica. O teste de ampliação combina texto de 200% em 720 CSS px com verificações de contenção; não substitui testes de todas as configurações de zoom de todos os navegadores.
