# Referências e matriz de implementação V2.3

Base obrigatória: `f256de6369f98567fabaf9139658c6de8e4af517`. Branch de trabalho: `feat/ui-ux-v2.3-20261016`.

O ZIP fornecido foi lido: LEIA_PRIMEIRO, manifesto, adendo, galeria offline e fontes oficiais. Os nove PNGs originais foram inspecionados. SHA256 do pacote: `0369087f7d6ac6cd7f07f618d656b923c969f33f092a1d949894c5e13304847e`.

O manifesto e o adendo ainda mencionam `a7ced300`. Prevaleceu a autorização posterior: o release integrado `f256de6`. Git confirmou ancestralidade de V2.1/V2.2; o frontend entre `a7ced300` e `f256de6` não tem diferenças. A migration `202610150009_patient_returning_rls.sql` está na base e não foi editada.

## Compatibilidade dos nove estudos com a implementação

| Estudo original | Padrão aplicado | Fonte de dados e limite |
| --- | --- | --- |
| 01 Painel | Central de trabalho com tarefas disponíveis por perfil; indicadores e agenda existentes | `/dashboard` e permissões de navegação. Não foram criadas contagens de tarefas pendentes ou métricas clínicas. |
| 02 Pacientes | Ficha com resumo, vínculos/histórico e responsáveis/consentimentos; acesso aos módulos relacionados | Lista paginada, endpoints individuais existentes e timeline apenas admin/gestor. O endpoint não contém matrículas; elas são consultadas pelo módulo autorizado. |
| 03 Matrículas | Contexto do paciente, controle mensal, catálogo pesquisável, vigência e histórico; retorno aos filtros | Builders financeiros existentes preservados. Nenhuma mudança de cálculo, preço contratado ou geração de cobranças. |
| 04 Financeiro | Separação entre cobrança por vencimento, valor recebido nessas cobranças, saldo e pagamentos pela data efetiva | `/charges`, `/payments`, `/enrollments` somente quando permitido, `/financial-entries`. Exclui estornos e usa fuso da clínica para pagamentos; não soma saldo de cobranças ao resultado de competência. |
| 05 Prontuários | Identificação contextual, filtros por tipo/status, linha cronológica, leitura completa e anexos | Payload e metadados existentes, sem interpretação clínica nem novos campos de negócio. Assinatura, retificação e autorização continuam na API. |
| 06 Chamada | Filtros da turma, progresso a partir dos registros existentes, histórico de correções e navegação para a aula | Roster e attendance existentes. Crédito não é consumido na reserva. Sem duplicação das regras da Agenda. |
| 07 Relatórios | Exploração mensal de previsto/realizado, valores acessíveis e detalhe do mês | Somente os quatro indicadores do relatório anual existente. Nenhuma série semanal, taxa ou métrica nova. |
| 08 Usuários | Busca por nome/e-mail, filtros por papel/status, unidades e consulta de permissões cadastradas | `/users` e `/units`. Consulta explica que papel e unidade também restringem acesso; não presume permissões efetivas adicionais. |
| 09 Notificações | Estado de leitura visível, filtros, retry e abertura da ocorrência relacionada | `payload.occurrence_id` real da API. O estudo conceitual com avisos financeiros não foi adotado porque o contrato disponível é de notificações internas da Agenda. |

Administração complementada com busca e status por cadastro, descrição da função de cada seção, consulta sem edição; privacidade com áreas separadas e detalhes autorizados; importações com etapas CSV/Notion/histórico, revisão de `issues` e confirmação antes de gravar. Operações de importação são ocultadas de perfis somente de consulta.

## Fontes oficiais consultadas em 16/10/2026

As fontes foram abertas diretamente, além da leitura dos estudos originais. Os padrões foram adaptados à identidade V2.2, sem copiar identidade, código ou textos dos fornecedores.

- [Jane — patient dashboard](https://jane.app/guide/patient-profile-dashboard): contexto do paciente e informações por permissão.
- [Jane — chart template parts](https://jane.app/guide/chart-parts-for-creating-a-chart-template): leitura clínica em seções.
- [Jane — invoices](https://jane.app/guide/creating-an-invoice): separar documento cobrado e pagamento.
- [Cliniko — features](https://www.cliniko.com/features/): continuidade do registro e histórico clínico.
- [Airtable — record detail](https://support.airtable.com/articles/5805061650-airtable-interface-layout-record-detail): detalhe contextual sem perder a coleção.
- [Airtable — Interface Designer](https://support.airtable.com/articles/8078126534-getting-started-with-airtable-interface-designer): composição apropriada para lista, detalhe e formulário.
- [Linear — filters](https://linear.app/docs/filters) e [custom views](https://linear.app/docs/custom-views): filtros legíveis e continuidade da tarefa.
- [Shopify — index table](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/index-table) e [patterns](https://shopify.dev/docs/api/app-home/latest/patterns): coleções administrativas com ações e estados.
- [Stripe — dashboard search](https://docs.stripe.com/dashboard/search): busca e distinção de objetos financeiros.
- [Carbon — data table](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/specifications): hierarquia, ações e informação tabular.
- [GOV.UK — check answers](https://design-system.service.gov.uk/patterns/check-answers/), [error summary](https://design-system.service.gov.uk/components/error-summary/) e [confirmation](https://design-system.service.gov.uk/patterns/confirmation-pages/): revisão, erros acionáveis e confirmação de ações.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) e [ARIA APG](https://www.w3.org/WAI/ARIA/apg/): teclado, nomes acessíveis, dialogs, tabs, foco e reflow.
- [NN/g — usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/): estado visível, controle e recuperação de erros.

A inspiração Mindbody está no estudo 06 do pacote; o modelo operacional de presença e reposição segue os contratos canônicos da Fisiofit. Não foram inferidas regras externas.

## Decisões transversais

- Filtros são mantidos apenas em memória da sessão, segregados por usuário/unidade, sem novas gravações de busca ou dados clínicos em armazenamento do navegador.
- O retorno entre módulos conserva busca, período, status e seção quando a unidade permanece a mesma. A seleção de uma nova unidade reinicia esse contexto.
- Detalhes reutilizam a pilha de foco V2.1; a Agenda recebe apenas integração para abrir ocorrência e acessar registros de participante.
- Os testes automatizados de acessibilidade são evidência das superfícies capturadas. Não equivalem a certificação WCAG, teste com leitor de tela ou pesquisa com usuários da clínica.
- A skill UX orientou detalhes contextuais, organização clínica, filtros persistentes, microcopy e revisão de operações. A memória Obsidian permaneceu contextual; a instrução específica de adiar a gravação no Vault foi respeitada.
