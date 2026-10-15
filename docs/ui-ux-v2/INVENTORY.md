# Fisiofit UI/UX V2 — inventário anterior à implementação

Base frontend confirmada em 15/10/2026: `8e9adda7f9b0198ae181add88fd1548d970750c9`. Artefato Hostinger `493d86286829d049de692f072f39e7daffb25ff3`, assets públicos e hashes em `evidence/published-baseline.json`. O ancestral comum com o checkout operacional `a62246c` é o próprio `a62246c`; seguem `7f16868`, `72cd07d` e `8e9adda`. Main local e referências remotas antigas não são bases desta entrega. Nenhum fetch/pull foi executado.

A API publicada é uma linhagem distinta: revisão v82, bundle SHA256 `dbc51762026d636dad700ae105c876fdd44519d655dfa3122d6d0e1a3bc94e53`, correções pós-commit preservadas em `/private/tmp/fisiofit-agenda-chamada-final-20261015` e patch correspondente. Esta branch de UI não publica, substitui nem altera esse backend. As informações v82 são evidência do cutover anterior, não nova consulta autenticada nesta tarefa. O frontend público foi consultado novamente nesta sessão.

`surfaces.json` enumera cada ação, formulário, campo, tabela, diálogo, aba, estado, card e navegação em todos os TSX (inclui componentes não exportados). Gerado antes de modificar a UI; as linhas são da base. Não é uma declaração de homologação. Componentes repetidos são instâncias diferentes. Os estados condicionais continuam exigindo testes específicos.

| Área | Superfícies e fluxos incluídos |
|---|---|
| Shell | Sidebar expandida/reduzida, grupos por permissão, unidade ativa, pesquisa remota, resultado de busca, notificações e seus filtros, perfil/foto/logout, menu mobile, skip link |
| Painel | Loading/erro, quatro indicadores de fonte existente; agenda do dia e alertas existentes/justificadamente preservados |
| Agenda | Semanal, navegação por semana/data/unidade/profissional, horários/vagas, detalhes da aula, chamada da aula/histórico/notas, substituição/remarcação, cancelamento, participantes, adicionar/remover, vínculo recorrente/dias, edição/exclusão de turma, grade em lote, cadastro/edição/status/cancelamento de atendimento, feriados/afastamentos |
| Chamada | Unidade/dia/horário, anterior/hoje/seguinte, profissional, resumo, presença/falta, correção e justificativa, notas/histórico na aula, aula futura/cancelada, créditos e reserva/revisão/devolução/encerramento |
| Pacientes | Busca e paginação, cadastro com grupos, edição, ativação, detalhes, responsáveis, consentimentos, linha do tempo, dados de plano/turma |
| Matrículas | Abas, seleção de paciente/plano/turma, resumo contratual, cadastro, edição, renovação/histórico, cancelamento/rollback permitido, controle mensal e filtros, cobrança, recebimento, correção da cobrança/contrato, confirmação, catálogo por duração/frequência, criar/editar/inativar plano, troca e prévia de impacto |
| Financeiro | Competência, indicadores, movimentos e comissão, confirmação de exclusão/aprovação, tabelas e estados |
| Prontuários | Busca/autorização, seleção/clear e troca rápida de paciente, avaliação/evolução, modelo, assinatura/retificação, anexos/upload/download, loading/erro/empty |
| Relatórios | Ano, previsto/realizado, tabela anual, CSV e impressão/PDF |
| Importações | CSV/seleção/validação/prévia/importação, Notion/pré-validação/importação, histórico/reversão, progresso/erro |
| Usuários | Convite, perfil/unidades/permissões, edição, senha direta, reenvio de acesso, ativação/exclusão conforme perfil |
| Configurações | Unidades, salas, serviços, profissionais e vínculo Auth, modelos clínicos: abas, cadastro, edição, status, exclusão; política de reposições |
| Privacidade | Solicitação de titular, incidente, severidade, listagens, auditoria |
| Autenticação | Login, recuperação/enviado/cooldown/erro, link inválido, definição/confirmação de senha, onboarding, acesso sem vínculo, sessão/validação |
| Transversal | Labels/ajuda/erro, validação/diálogo, loading/disabled/duplo envio, foco/Tab/Escape/restauração, confirmação de risco, tabelas/ações/filtros, 1440/1280/768/390px, reduced motion |

## Arquitetura aprovada para implementação

Evoluir o pacote existente sem biblioteca visual nova. Tokens com namespace `--ff-*` e aliases compatíveis, tipografia de sistema sem dependência remota, escala operacional mínima de 12px (texto de trabalho 14–16px), controles 44px, cores neutras/azul/teal com contraste. CSS reestruturado em fundações, componentes, shell e módulos; remover as duas folhas cumulativas anteriores. Contratos/API/domínio/permissões preservados. Diálogos, avisos, abas e tabelas compartilham comportamento.

Referências de interação: [W3C Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) e [W3C Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/). A matriz de evidências só usa PASS com teste identificado; auditoria estática não substitui renderização nem homologação de backend.
