# Refinamento V2.1 — achados e decisões

Base exata: `a0fef799cc8556e8458622da55a019f2611f5b05`, worktree V2 limpa antes da criação. Branch: `feat/ui-ux-v2.1-20261015`; worktree: `/private/tmp/fisiofit-ui-ux-v2.1-20261015`.

O inventário de [615 superfícies](../ui-ux-v2/surfaces.json), o tratamento da V2 e a galeria existente foram reaproveitados. Não foi refeito um catálogo de páginas. A matriz `coverage.json` conserva os IDs originais; sua cobertura é por família de componente e jornada, não uma alegação de 615 execuções individuais.

Gravidade: alta = risco de seleção/dados ou perda de trabalho; média = feedback, acesso ou eficiência operacional prejudicados; baixa = consistência e leitura. A prioridade é avaliação técnica contextual, não resultado de pesquisa com a equipe da clínica.

| Achado na V2 | Gravidade | Refinamento implementado | Evidência |
|---|---|---|---|
| Paciente digitado já recebia `aria-invalid`, antes de escolher uma opção | Alta | Ajuda neutra distingue digitação de seleção; validação permanece no blur/envio | `Typed patient name…`, `Enter without an active result…` |
| Resultados podiam permanecer ao reduzir a consulta para um caractere; loading podia ficar ativo após cancelar efeito | Alta | Limpa opções e loading em consultas curtas; invalida respostas antigas | `Shortening a query…`, `Delayed results…` |
| Escolher um paciente iniciava uma nova busca pelo nome selecionado | Média | Não busca novamente quando existe seleção; mantém ID explícito e feedback da escolha | `Keyboard selection…` e inspeção do efeito |
| Escape de um combobox dentro de modal podia fechar o modal inteiro | Alta | Primeiro Escape fecha a lista; segundo segue o fechamento protegido | `First Escape closes patient options…` |
| Form reset não sincronizava o estado React do seletor e os erros adicionados pelo enhancer | Alta | Reset limpa seleção e erros, preservando o contrato dos campos e os valores default | `Reopening a discarded form…`, fluxo de criação sintética |
| A prioridade de foco declarada era ignorada pela ordem de um seletor CSS composto | Média | Procura `data-initial-focus` antes do botão de fechar; confirmações começam em Voltar | `Inactivation confirmation…` |
| Confirmações de descarte, exclusão, assinatura e correção usavam “Confirmar ação” | Alta | Opções explícitas no host existente, com labels do efeito e variante destrutiva | Capturas de descarte; chamadas de `confirmAction` |
| Correção de cobrança, condição contratual e troca de plano permitiam fechar sem proteger edição | Alta | Hook reutilizável de alterações não salvas; Voltar preserva texto, Escape e Cancelar seguem a mesma regra | `Cancelling financial discard…`, `Plan preview changes…` |
| Falhas de ajustes financeiros eram comunicadas no modal e no aviso da página | Média | Erro persistente junto aos valores em edição; removido aviso duplicado nesses fluxos | Inspeção dos catch e formulário de ajuste |
| Nova cobrança guardava erro em estado sem exibi-lo na confirmação | Alta | Erro visível na própria confirmação, valores preservados e limpeza ao reabrir | Inspeção de `charge-confirmation-content` |
| Validação customizada podia usar mensagem nativa genérica; campos vazios eram marcados no primeiro Tab | Média | Mensagem específica de `customError`; sem erro de campo vazio intocado; correção limpa erro sem reenviar | Testes de e-mail, blur, sumário e reabertura |
| Primitivos podiam descartar `aria-invalid` e descrições fornecidos por consumidores | Média | Preserva e combina os atributos fornecidos em TextField, SelectField, CheckboxField e TextareaField | Vitest de contratos acessíveis |
| Bordas dos inputs eram pouco contrastantes em superfície branca | Média | Token de borda usa o neutro secundário existente; contraste verificado | Vitest de contraste + capturas |
| Colunas monetárias tinham alinhamento à esquerda | Média | Coluna com alinhamento explícito e números tabulares, aplicado pelos adapters compartilhados | Tabelas financeiras e Vitest |
| Ações de linha ficavam maiores que o necessário e sem contexto para tecnologias assistivas | Baixa | 40px em tabelas, 44px nos controles regulares; grupo de ações identifica o registro | CSS e DataTable |
| Busca em pacientes tinha diferença entre texto digitado e busca aplicada pouco evidente | Média | Indica a necessidade de Buscar e mostra o filtro efetivamente aplicado | Captura de pacientes e `FilterSummary` |
| Controle mensal só oferecia limpar filtros no estado vazio | Média | Contagem anunciada, busca/status ativos visíveis e limpar sempre disponível quando aplicável | `Active financial filters…`, `Clear filters…` |
| Ano do relatório disparava consulta a cada edição parcial, aceitava respostas atrasadas e não atualizava a troca de unidade | Alta | Ano aplicado explicitamente; resultado vinculado ao escopo ano/unidade, consulta refeita ao trocar unidade e resultado anterior oculto durante atualização | `Changing unit…`, `Annual report request…`, inspeção de versionamento |
| Cancelar a primeira pergunta de retificação ainda abria a próxima | Média | Cancelamento encerra o fluxo; feedback de assinatura/retificação após resposta da API | Inspeção de `rectify`/`sign` |
| Histórico de cobranças e recebimentos exibia códigos de status e meio de pagamento em inglês | Média | Labels brasileiros no histórico, preservando os códigos enviados à API | Capturas de histórico e fontes |
| Ações de agenda usavam Salvar/Confirmar sem a consequência | Baixa | Registrar presença, Corrigir presença, Confirmar agendamento e Adicionar paciente | Capturas e fontes |

## Famílias avaliadas

Botões: mantidas primary, secondary, quiet/ghost e danger no sistema existente; icon-only mantém nome acessível e alvo de 44px. Active, disabled e busy têm estado consistente. Ações destrutivas são identificadas pelo texto e pelo tratamento visual. Não foi criado split button onde não havia necessidade. Ações essenciais seguem visíveis.

Campos: labels persistentes e associados, hints e erros referenciados, required nativo, autocomplete existente, readonly distinguível e disabled coerente. Valores financeiros e datas continuam usando os parsers e contratos existentes; datas da prévia da troca passaram a ser exibidas em dia/mês/ano. Nenhuma máscara altera o valor persistido.

Seletores: paciente recebe pesquisa acessível e seleção explícita. Os conjuntos pequenos de unidades, categorias, planos e profissionais mantêm controles nativos; não há evidência de que substituir todos por widgets pesquisáveis melhoraria essas tarefas. IDs permitidos e escopo de unidade continuam sendo respeitados; mudar o escopo invalida a seleção do picker.

Tabelas: preservadas tabela semântica, ordenação da página atual, cabeçalhos, paginação real e rolagem horizontal identificada. Não foram inventadas paginação de servidor ou ações sem suporte. Tabelas especializadas mantêm sua estrutura de domínio. A quantidade de ações observada não justificou esconder ações essenciais em um novo menu contextual.

Diálogos: mantida a pilha de foco, inert, scroll contido, Escape e restauração. A confirmação de descarte é introduzida somente onde uma edição seria perdida. Não foram convertidos formulários em wizards.

Estados: preservados carregamento, erro/retry, vazio, permissão e sucesso após resposta. Mudanças específicas reforçam pending, seleção e erro persistente. Animações continuam discretas com reduced-motion. Não há sucesso otimista novo.

Navegação, painel, notificações, importações, privacidade, configurações, autenticação e perfil foram inspecionados pela galeria e pelos testes existentes; componentes corretos foram preservados. Nenhuma modificação de autenticação integra este refinamento.

## Fontes consultadas

As decisões aplicam princípios ao contexto da clínica, sem copiar componentes ou impor regras de e-commerce ao domínio clínico:

- [Nielsen Norman Group: heurísticas](https://www.nngroup.com/articles/ten-usability-heuristics/): estado visível, reconhecimento, consistência, prevenção e recuperação.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/): referência AA para contraste, teclado, foco, nomes, erros e tamanho de alvo. Alvo regular 44px e denso 40px; não se confunde a referência confortável de 44px com o mínimo de 24px e suas exceções em 2.5.8.
- [APG: combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) e [diálogo modal](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): foco no campo, opção ativa, Escape, foco contido e restauração.
- [GOV.UK: botões](https://design-system.service.gov.uk/components/button/) e [resumo de erros](https://design-system.service.gov.uk/components/error-summary/): consequência explícita e recuperação navegável.
- [Baymard: validação inline](https://baymard.com/research-articles/inline-form-validation): evitar erro prematuro e retirar a mensagem ao corrigir, adaptado aos formulários clínicos.
- [Carbon: tabelas](https://v10.carbondesignsystem.com/components/data-table/usage/): hierarquia, busca, ações, estrutura e escopo da ordenação.

Não se declara ganho de velocidade nem redução quantitativa de interações: não houve estudo cronometrado de usuários. As comparações demonstram estados mais claros e proteções específicas; descartar edição agora exige uma decisão adicional deliberada.
