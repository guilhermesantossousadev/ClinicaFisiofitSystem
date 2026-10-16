# Jornadas e evidências V2.3

A galeria é gerada por `scripts/ui-v23/browser.mjs` e `scripts/homologate-ui-v23.mjs --report`. Fixtures verificam renderização e interação; a regressão operacional separada usa Auth, PostgreSQL/RLS e Storage locais reais. Nenhuma redução de tempo ou cliques foi estimada.

| Jornada | Melhoria observável | Evidência visual / de interação |
| --- | --- | --- |
| Paciente → matrícula → plano → cobrança → recebimento | A ficha abre matrículas já no contexto do paciente; controle mensal mantém período e filtros; detalhes financeiros levam ao módulo responsável | `patient-details`, `journey-patient-enrollment`, `enrollment-*`, `plan-*`, `charge-correction`; checks de retorno ao filtro |
| Agenda → turma → participante → paciente | Participantes oferecem ações autorizadas para ficha/matrículas/prontuário | `notification-occurrence` e código de integração mínimo da Agenda |
| Agenda → chamada → histórico | Chamada conserva dia/turma; filtro de pacientes sem marcar; histórico acessível sem sair da chamada | `attendance-roster`, `attendance-history`, `makeup-booking` |
| Paciente → prontuário → evoluções | Seleção contextual, leitura integral por seções, filtro de avaliações/evoluções/rascunhos/assinados; troca de paciente limpa registros anteriores | `clinical-history`, `clinical-read`, `clinical-form`, `clinical-other-patient`; check de resposta atrasada |
| Financeiro → cobrança → detalhes → filtros | Saldo, valor cobrado, recebimentos e cobertura juntos no detalhe; Escape e retorno entre módulos conservam filtros e foco | `finance-charge-details`, `finance-receipts`, `finance-movements`; checks de round trip |
| Notificação → registro relacionado | A notificação usa `occurrence_id` e abre a aula correta com retorno à origem | `notifications`, `notification-occurrence`; check de retorno |
| Relatório → mês → financeiro | Barras e valores acessíveis; detalhe mensal abre o mesmo mês no financeiro | `relatorios-*`, `report-month-details`; check de mês exato |
| Administração → acesso/cadastro | Coleções filtráveis, permissões cadastradas legíveis, consulta e edição distintas | `user-permissions`, `user-invite`, `settings-*`, `profile-*` |
| Importação → pré-validação → revisão | CSV/Notion separados; linhas problemáticas por número/motivo; confirmação independente antes de gravar | `import-review`, `import-confirmation`, `import-notion`, `import-history` |

Padrões herdados preservados: formulários com labels, validação e proteção de descarte; modais com Tab/Shift+Tab/Escape; API com idempotência; paginação de pacientes; contratos de preço e histórico de matrícula.

As listas retornadas pela API continuam condicionadas a RLS e ao escopo de unidade. A UI não calcula permissões adicionais nem substitui autorização do servidor. O usuário financeiro não recebe acesso ao prontuário; o profissional não solicita cobranças ou pagamentos.
