# Fisiofit UI/UX V2.3 — entrega para revisão

**READY_FOR_REVIEW — revisão visual local, sem publicação.**

O status verificável está em [evidence/acceptance.json](evidence/acceptance.json). A [galeria comparativa](REVIEW.html) apresenta capturas reais da aplicação com dados sintéticos; não usa as maquetes do ZIP como evidência.

Branch: `feat/ui-ux-v2.3-20261016`.
Worktree: `/private/tmp/fisiofit-ui-ux-v2.3-20261016`.
Base exata: `f256de6369f98567fabaf9139658c6de8e4af517`.
Commit de entrega: HEAD desta branch, informado na resposta final.

## Base, proteção e escopo

`origin` foi conferido antes do fetch autorizado. Somente a referência `release/ui-v22-patient-rls-20261015` foi recuperada, sem tags. O SHA completo correspondeu ao exigido; `a7ced300` e a V2.1 `62936e6` são ancestrais. A diferença do release integrado contém cinco arquivos: migration/rollback de pacientes, teste SQL e documentação; o frontend é idêntico ao V2.2 aprovado.

O checkout operacional original e a branch V2.2 foram preservados. API v82, contratos, domínio, infraestrutura, schema, migrations e RLS não têm diferenças em relação à base. Não houve push, merge, deploy ou alteração em dados reais. A navegação legítima da Agenda que materializa ocorrências foi exercitada somente no banco sintético descartável.

## Módulos implementados

| Módulo | Entrega |
| --- | --- |
| Painel | Central de trabalho por módulos/perfil disponíveis, atalhos operacionais e indicadores existentes. |
| Pacientes | Ficha organizada em resumo, vínculos/histórico e responsáveis/consentimentos; fatos cadastrais e acesso contextual aos demais módulos. Busca e paginação preservadas. |
| Matrículas | Contexto explícito do paciente, retorno à busca/período/seção, continuidade entre controle mensal, matrícula, histórico e cobrança. |
| Planos | Catálogo com busca/disponibilidade, explicação de preço global versus contrato, proteção de descarte do formulário. Troca e prévia existentes preservadas. |
| Financeiro | Cobrado/recebido/saldo separados, filtros por período/situação/paciente, detalhe da cobrança com recebimentos e retorno aos filtros. Estornos excluídos e data de pagamento no fuso da clínica. Movimentos por competência continuam separados. |
| Prontuários | Contexto do paciente, linha cronológica, filtros de tipo/status/texto, leitura integral dos campos clínicos, anexos e formulários existentes. Respostas de paciente anterior continuam descartadas. |
| Chamada e reposições | Progresso da chamada, busca/filtro de participantes, histórico e ficha contextual, retorno à aula, filtro de créditos e orientação da reserva. Regras existentes preservadas. |
| Relatórios | Exploração mensal acessível de receitas previstas/realizadas, detalhe com despesas e resultado, abertura do mesmo mês no financeiro; tabela e exportações mantidas. |
| Usuários | Busca, filtros de papel/status, unidades visíveis, consulta contextual das permissões cadastradas. Controles de administração permanecem condicionados ao perfil. |
| Configurações | Busca/status por cadastro, explicação contextual de cada área, consulta separada de ações de edição em unidades, salas, serviços, profissionais e modelos. |
| Privacidade | Solicitações/incidentes/auditoria separados, busca e detalhes autorizados; incidentes continuam exclusivos da administração. |
| Notificações | Leitura visível, filtros mantidos, erro/retry e ligação real com a ocorrência. |
| Importações | CSV/Notion/histórico separados, etapas, revisão de linhas rejeitadas, confirmação de gravação e controles de consulta/edição. Corrigida a falha de clonagem de função no Worker do CSV, reproduzida e validada em Chrome. |

A Agenda recebeu apenas integração frontend: abrir ocorrência relacionada, acessar ficha/matrícula/prontuário de participante e conservar data/modo/ocorrência durante o retorno. Os componentes do calendário V2.2 e suas regras não foram redesenhados.

O contexto de navegação usa uma pilha de retorno em memória, segregada por sessão/unidade. Não foram adicionados dados clínicos ao armazenamento do navegador. A skill UX orientou o uso de detalhes contextuais, seções clínicas, filtros, microcopy e revisão de operações. As referências e limites estão na [matriz de rastreabilidade](REFERENCE_TRACEABILITY.md).

## Evidências

| Verificação | Resultado comprovado |
| --- | --- |
| Typecheck, lint, build completo | PASS, logs em `evidence/` |
| Vitest | 91 testes PASS, incluindo quatro novos testes de apresentação financeira |
| Node | 34 testes PASS |
| SQL | 410 assertions PASS, incluindo 43 da correção de pacientes e 86 de estabilização operacional |
| HTTP real local | 44 requisições PASS com Auth/RLS/Storage reais e dados sintéticos; pagamentos concorrentes idempotentes e bytes de anexo verificados |
| Navegador autenticado | Base e candidata: 10 verificações PASS cada; zero respostas API com falha na rodada final. Presença, evolução e quitação do saldo persistidas e conferidas no PostgreSQL. |
| Galeria da base | 118 capturas no frontend exato do release publicado, reconstruído localmente com as mesmas fixtures |
| Galeria candidata | 204 capturas e 222 verificações PASS; zero violações axe nos estados capturados |
| Capturas autenticadas adicionais | 6 da base e 6 da candidata, com backend real local, incorporadas à galeria como `authenticated-*` |
| Responsividade | 1440, 1280, 768 e 390px; verificação adicional de texto a 200% em 720px e movimento reduzido |
| Jornadas frontend | Retorno aninhado notificação/aula/ficha; paciente/matrícula/prontuário; cobrança/matrícula/filtros; relatório/mês/financeiro; CSV/revisão/confirmação |
| Galeria HTML | Filtros, imagens e contenção mobile PASS |
| Graphify | Atualização AST executada; parser SQL opcional ausente. Evidência de banco vem dos testes PostgreSQL, não do grafo. |

O resultado autenticado completo no navegador é registrado separadamente em `evidence/operational/browser-result.json`; `acceptance.json` agrega o status final. Tentativas com falhas permanecem em `evidence/attempts/`, sem serem apresentadas como PASS. A base publicada também passou no mesmo ambiente. Rodadas finais foram executadas sequencialmente; os timeouts anteriores permanecem documentados como intermitência local, sem alteração de autenticação/API no produto.

## Limites e pendências

- Não foi realizada operação pela equipe da clínica, sessão com VoiceOver/NVDA ou certificação WCAG completa. Axe e testes de teclado cobrem os estados registrados.
- O catálogo mantém os períodos e frequências já definidos no produto. Não há planos, relatórios, indicadores, políticas clínicas ou regras financeiras novos.
- O detalhe do paciente respeita o conteúdo real da timeline; matrículas são consultadas no módulo próprio, não presumidas pela ausência de um campo no endpoint.
- As primeiras rodadas operacionais tiveram falhas intermitentes do Auth local (timeouts e 401 consequentes). Um Auth descartável opcional foi adicionado apenas ao harness de testes. O status agregado depende da rodada final, sem reclassificar tentativas anteriores.
- O achado P3 dos três JPEGs públicos não foi reaberto como requisito.
- A gravação anterior do Vault segue pendente. Por instrução explícita, não foi repetida e não houve sincronização; continuidade em [HANDOFF_LOCAL.md](HANDOFF_LOCAL.md).

## Reprodução

```sh
npm ci
node scripts/homologate-ui-v23.mjs --checks
FISIOFIT_UI_ROOT=/private/tmp/fisiofit-ui-ux-v23-baseline-20261016 node scripts/ui-v23/browser.mjs before
node scripts/ui-v23/browser.mjs after
FISIOFIT_TEST_ISOLATED_AUTH=1 \
FISIOFIT_TEST_API_ROOT=/private/tmp/fisiofit-agenda-chamada-final-20261015 \
FISIOFIT_TEST_OUTPUT=/private/tmp/fisiofit-ui-v23-operational-validated-20261016 \
node scripts/homologate-stabilization.mjs --http-only
FISIOFIT_TEST_OUTPUT=/private/tmp/fisiofit-ui-v23-operational-validated-20261016 \
node scripts/homologate-ui-v23.mjs --report --graph
node scripts/ui-v23/review-gallery.mjs
```

Chrome e os serviços locais sintéticos identificados são necessários para a homologação. A fonte preservada da API v82 é uma dependência local da prova operacional; não deve ser substituída por um deploy. Os comandos acima não publicam, fazem merge/push ou sincronizam o Vault.
