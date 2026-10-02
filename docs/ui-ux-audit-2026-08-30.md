# Auditoria e evolução de UI/UX — Fisiofit

Data: 30 de agosto de 2026  
Escopo: portal autenticado, autenticação, site institucional e componentes transversais  
Referências: `context.md`, `README.md`, `ARCHITECTURE.md`, código de apresentação e critérios WCAG 2.2 AA

## Resumo executivo antes da implementação

O produto já possui uma base visual coerente, estados assíncronos, navegação responsiva, formulários semânticos e separação adequada entre apresentação e infraestrutura. A evolução deve consolidar essa base, não substituí-la. Os principais riscos restantes são sistêmicos: textos operacionais herdados entre 6,5 e 11 px; tokens compartilhados insuficientes para semântica, foco e tipografia; alguns estados técnicos ainda expostos em inglês; dialogs com padrões diferentes de foco e descarte; combobox global sem navegação completa por teclado; e empty states genéricos em cadastros.

As mudanças propostas não alteram contratos, API, banco, permissões, cálculos, rotas ou significado dos dados.

## Matriz de cobertura

| Área | Página/fluxo | Perfil(is) | Componentes críticos | Estados observados | Breakpoints | Problemas/decisão | Prioridade | Status |
|---|---|---|---|---|---|---|---|---|
| Autenticação | Login e recuperação | Todos | formulário, recuperação, mensagens | carregando, erro, sucesso, sessão ativa | 360–1440, zoom 200% | Base sólida; manter microcopy e foco, elevar tokens compartilhados | Média | Auditado; onda 1 |
| Autenticação | Definição de senha | Convidado | formulário, link inválido | carregando, erro, sucesso | 360–1440 | Sem mudança funcional; consolidar apresentação dos estados | Média | Auditado; onda 1 |
| Autenticação | Onboarding | Admin inicial | formulário de clínica | erro, envio ocupado | 360–1440 | Sem stepper necessário pelo tamanho atual | Baixa | Auditado; preservar |
| Autenticação | Sessão expirada / acesso negado | Todos | página de estado, repetição, saída | validação, indisponível, sem vínculo | 360–1440 | Microcopy acionável já presente | Baixa | Auditado; preservar |
| Portal global | Shell e navegação desktop | Todos por permissão | sidebar, grupos, perfil, unidade | ativo, recolhido, ocupado | 768–1440, zoom 200% | Ícones tipográficos ambíguos; foco/tamanho devem ser uniformes | Alta | Auditada; ondas 1–2 |
| Portal global | Navegação móvel | Todos por permissão | barra inferior, menu “Mais” | aberto, ativo, fechado | 360, 390, 768 | Menu não declara dialog nem contém/retorna foco de modo consistente | Alta | Auditada; onda 2 |
| Portal global | Busca de pacientes | Perfis com pacientes | combobox e resultados | mínimo de caracteres, vazio, resultados | 360–1440 | `aria-expanded`/popup inconsistentes; sem setas, Escape ou opção ativa | Alta | Auditada; onda 2 |
| Portal | Painel | Todos autorizados | agenda do dia, métricas, alerta | loading, vazio, dados, erro global | 360–1440 | Status do atendimento aparece em inglês; ações devem respeitar permissão visível | Alta | Auditado; ondas 2–3 |
| Portal | Agenda | Admin, gestor, recepção, profissional | calendário mensal/mobile, filtros, dialogs, turmas | loading, vazio, conflito, read-only, sucesso, erro | 360–1440 | Boa evolução recente; preservar alterações e consolidar labels/foco | Alta | Auditada; ondas 3–4 |
| Portal | Chamada diária | Admin, gestor, recepção, profissional | filtros, presença/falta, reposições | loading, vazio, ocupado, read-only | 360–1440 | Alvos móveis adequados; textos secundários ainda pequenos | Média | Auditada; ondas 1 e 4 |
| Portal | Pacientes | Admin, gestor, recepção | busca, tabela, cadastro, detalhe, responsáveis | loading, vazio, erro, sucesso, read-only | 360–1440 | Dialog de detalhe/edição usa padrão próprio; empty state genérico | Alta | Auditada; ondas 3–4 |
| Portal | Matrículas e planos | Admin, gestor, recepção, financeiro | filtros, cards mobile, drawers, pagamento | loading, vazio, erro, contexto da agenda, ocupado | 360–1440 | Densidade melhorada; proteger formulários contra descarte | Alta | Auditada; ondas 3–4 |
| Portal | Prontuários e anexos | Admin, gestor, profissional | seletor, formulário clínico, anexos, lista | loading, vazio, erro, sucesso, read-only | 360–1440 | Tipografia clínica herdada de 8–10 px é inadequada | Crítica | Auditada; ondas 1 e 4 |
| Portal | Financeiro | Admin, gestor, financeiro | métricas, lançamentos, comissões, fechamento | loading, vazio, erro, sucesso | 360–1440 | Estados/bases técnicos em inglês e confirmação nativa inconsistente | Alta | Auditado; ondas 3–4 |
| Portal | Relatórios | Admin, gestor, financeiro | filtros, gráfico, tabela, CSV/impressão | carregando, erro, dados | 360–1440 | Mensagem de erro usa estilo de autenticação; gráfico exige descrição textual | Média | Auditado; onda 5 |
| Portal | Importações | Admin, gestor | upload, preview, histórico, rollback | parsing, validação, erro, sucesso, vazio | 360–1440 | “Rollback” e status internos não são microcopy pt-BR | Alta | Auditada; onda 5 |
| Portal | Usuários | Admin; gestor leitura | convite, permissões, edição, senha, exclusão | loading, vazio, protegido, read-only, erro | 360–1440 | Papel/status técnicos em inglês; dialogs próprios | Alta | Auditada; onda 5 |
| Portal | Configurações | Admin, gestor | tabs, CRUD, dialogs compartilhados | loading, vazio, erro, sucesso, read-only | 360–1440 | Tabs são semânticas; dialogs de edição precisam foco/descarte consistente | Alta | Auditada; ondas 3 e 5 |
| Portal | Privacidade e auditoria | Admin, gestor | solicitações, incidentes, auditoria | loading, vazio, erro, read-only | 360–1440 | Empty states precisam contexto por tabela | Média | Auditada; onda 5 |
| Portal | Meu perfil | Todos | avatar, dados, saída | ocupado, erro/sucesso do avatar | 360–1440 | Upload precisa manter feedback perceptível; base adequada | Média | Auditado; onda 5 |
| Site | Início | Visitante | hero, serviços, CTA, imagens | conteúdo, carregamento de imagem | 360–1440 | Estrutura e CTA claros; preservar identidade | Baixa | Auditada; onda 6 |
| Site | Sobre, serviços e unidades | Visitante | heros, cards, listas, mapas/links | conteúdo | 360–1440 | Boa hierarquia; validar apenas reflow/foco | Baixa | Auditadas; onda 6 |
| Site | Contato | Visitante | formulário e envio ao WhatsApp | preenchimento, validação | 360–1440 | Labels e controles adequados; manter dados no erro | Média | Auditada; onda 6 |
| Site | Links | Visitante | lista de links, retorno | conteúdo | 360–1440 | Ícone isolado possui nome acessível | Baixa | Auditada; preservar |
| Site | Privacidade e cookies | Visitante | conteúdo legal, consentimento | primeira visita, preferências, storage bloqueado | 360–1440 | Consentimento equilibrado e dialog acessível; preservar | Média | Auditada; onda 6 |
| Site | 404 | Visitante | orientação e retorno | rota inexistente | 360–1440 | Mensagem e próxima ação presentes | Baixa | Auditada; preservar |
| Site global | Header e navegação móvel | Visitante | navegação, CTA, menu | aberto, ativo, fechado | 360–1440 | Escape existe; falta retorno/foco inicial e bloqueio de rolagem | Média | Auditada; onda 6 |
| Site global | Footer e SEO | Visitante | contatos, legais, metadata | conteúdo | 360–1440 | Metadados por rota e links legais presentes | Baixa | Auditado; preservar |

## Padrões atuais do design system

- Marca: azul, azul escuro, aqua, mint, navy, superfícies claras e borda azul-acinzentada.
- Portal: tokens injetados de `@fisiofit/design-system`, CSS base legado e camada de evolução em `portal-enhancements.css`.
- Site: os mesmos tokens alimentam Tailwind; primitives reutilizáveis para CTA, hero, seções e formulários.
- Formulários: primitives React com label persistente, dica/erro associado, validação no blur/envio e mensagens pt-BR.
- Feedback: `ModuleState`, skeletons, mensagens sistêmicas, toasts e `aria-busy` local.
- Responsividade: sidebar desktop/tablet, navegação inferior no celular e listas/cards alternativos em fluxos densos.

## Diagnóstico priorizado

| Evidência | Impacto | Severidade | Alcance | Solução | Risco / validação |
|---|---|---|---|---|---|
| `index.css` e regras clínicas mantêm dezenas de textos entre 6,5 e 11 px | leitura clínica/operacional lenta, especialmente em zoom e telas densas | Crítica | Sistêmico | tokens tipográficos e piso legível em componentes críticos | Médio; conferir overflow e breakpoints |
| `packages/design-system` expõe quase somente cores de marca | estados, foco, perigo e texto secundário divergem entre apps | Alta | Sistêmico | ampliar tokens semânticos e aplicá-los com compatibilidade | Baixo; typecheck e contraste |
| Busca global em `FisiofitApp` não implementa interação completa de combobox | teclado e leitor de tela não conseguem percorrer resultados previsivelmente | Alta | Compartilhado | popup persistente quando aberto, opção ativa, setas, Enter, Escape e mensagem vazia | Baixo; teste unitário e teclado |
| Menu “Mais” móvel não é dialog e não contém foco | foco pode alcançar conteúdo encoberto | Alta | Global portal | semântica dialog, foco inicial, trap, Escape, retorno e bloqueio de scroll | Médio; teclado/mobile |
| `DrawerForm` fecha ao clicar fora mesmo após preenchimento | perda acidental de trabalho | Alta | Compartilhado | rastrear alterações e confirmar descarte; manter bloqueio durante envio | Médio; criação em todos os módulos |
| Dialog de edição compartilhado não contém foco nem restaura gatilho | navegação por teclado inconsistente | Alta | Compartilhado | foco inicial, trap, retorno, bloqueio de scroll e proteção contra descarte | Médio; CRUD de configurações/pacientes |
| Dashboard, usuários, financeiro e importações exibem valores internos em inglês | linguagem inconsistente e menor compreensão | Alta | Compartilhado | mapeamento único de status/papel/tipo para pt-BR | Baixo; snapshots/testes puros |
| Empty states genéricos repetem “Nenhum registro cadastrado” | não explicam filtro, permissão ou próxima ação | Média | Compartilhado | permitir mensagem contextual por tabela sem inventar funcionalidade | Baixo; inspeção textual |
| Menu móvel do site fecha por Escape, mas não gerencia foco/scroll | contexto de teclado pode se perder | Média | Global site | retorno de foco, foco inicial e bloqueio de rolagem | Baixo; teclado/mobile |

## Plano por ondas e critérios de aceite

### Onda 1 — Fundação

Arquivos: design system e CSS global do portal.  
Consolidação: tokens semânticos, tipografia operacional, foco, redução de movimento, disabled/busy.  
Preservado: marca, layout, breakpoints, regras e dados.  
Aceite: textos críticos legíveis, foco 3:1, nenhum controle essencial abaixo de 44 px em toque e sem regressão de build.

### Onda 2 — Navegação e estrutura global

Arquivos: `FisiofitApp.tsx`, header do site e estilos relacionados.  
Consolidação: combobox acessível e menus móveis previsíveis.  
Preservado: itens por papel, unidade ativa e destinos.  
Aceite: operação integral por teclado, foco contido/retornado, Escape seguro e sem scroll do fundo.

### Onda 3 — Componentes compartilhados

Arquivos: `OperationalShared.tsx`, primitives e CSS.  
Consolidação: dialogs, descarte, status traduzidos, empty states.  
Preservado: submit handlers e contratos.  
Aceite: formulários preenchidos não fecham silenciosamente; dialogs restauram foco; estados não expõem códigos internos conhecidos.

### Ondas 4–6 — Fluxos e superfícies

Arquivos: módulos operacionais, autenticação e páginas públicas somente quando a correção não puder ser feita na camada compartilhada.  
Preservado: todos os fluxos, papéis, cálculos e endpoints.  
Aceite: matriz atualizada por página, estados críticos documentados e regressões automatizadas ausentes.

### Onda 7 — Validação transversal

Executar typecheck, lint, build, testes, `git diff --check`, revisão estática de semântica e breakpoints. A inspeção visual automatizada fica marcada como bloqueada enquanto o conector do navegador local não inicializar; isso não será registrado como “aprovado”.

## Riscos e dependências

- Não há ambiente de homologação autenticado disponível; fluxos por papel não podem ser declarados homologados.
- O conector de inspeção visual local falhou ao inicializar nesta sessão; os servidores locais funcionam, mas screenshots/teclado reais não estão disponíveis por essa via.
- A ampliação tipográfica pode revelar contenções em tabelas densas; mudanças serão feitas por camadas e verificadas em build e CSS responsivo.
- Testes Supabase dependem de Docker/Podman e não são necessários enquanto nenhuma regra, migration ou API for alterada.

## Relatório final

### Resumo das melhorias

- O design system passou a fornecer tokens semânticos de foco, sucesso, aviso, perigo, informação, tipografia e tamanho mínimo de controle.
- A camada final do portal elevou a legibilidade dos campos e textos clínicos, consolidou foco visível, movimento reduzido, alto contraste e estados indisponíveis/ocupados.
- A busca global passou a implementar o padrão de combobox com popup coerente, resultado vazio, opção ativa, setas, Enter, Escape e retorno ao estado fechado.
- O menu móvel do portal passou a funcionar como dialog modal com contenção de foco, Escape, retorno ao gatilho e bloqueio de rolagem. O menu público também ganhou foco inicial, retorno por Escape e bloqueio de fundo.
- Drawers e dialogs críticos agora evitam descarte silencioso de formulários, bloqueiam fechamento durante salvamento, contêm foco e o devolvem ao ponto de origem.
- Estados, severidades, ações de auditoria, tipos e datas recorrentes foram centralizados em português brasileiro.
- Relatórios passaram a possuir loading/erro/repetição próprios, ações indisponíveis sem dados e semântica tabular com descrição textual.
- Empty states de pacientes, prontuários, financeiro, usuários, privacidade e importações passaram a explicar o contexto real.
- Foram adicionados testes unitários para a nova microcopy e formatação compartilhada.

### Matriz final de cobertura

| Superfície | Decisão final | Validação disponível |
|---|---|---|
| Login, recuperação, senha, onboarding e acesso negado | Preservada; fundação semântica consolidada | Typecheck, lint, build, testes |
| Shell e navegação desktop | Preservada; foco/tokens consolidados | Typecheck, lint, build |
| Navegação móvel do portal | Melhorada: dialog, trap, Escape, retorno e scroll lock | Typecheck, lint, revisão estática |
| Busca global | Melhorada: combobox completo e vazio anunciado | Typecheck, lint, revisão estática |
| Painel | Melhorado: status em pt-BR | Teste puro, build |
| Agenda e turmas | Preservada; herda tokens, foco e drawers seguros | 13 invariantes de plataforma, build |
| Chamada diária | Preservada; herda fundação de legibilidade e foco | Typecheck, build |
| Pacientes | Melhorada: vazio contextual, dialog e descarte seguro | Typecheck, lint, build |
| Matrículas, planos e pagamentos | Melhorada: dialog de plano com foco e descarte seguro | Testes puros existentes, build |
| Prontuários e anexos | Melhorada: tipografia clínica, status e vazios | Invariante clínica, build |
| Financeiro | Melhorado: estados, tipos e vazios em pt-BR | Typecheck, testes, build |
| Relatórios | Melhorado: loading/retry, semântica tabular e descrição | Typecheck, build |
| Importações | Melhorada: microcopy, datas, status e vazio | Typecheck, build |
| Usuários | Melhorada: perfis/status, foco e descarte seguro | Invariantes de segurança, build |
| Configurações | Melhorada via tabelas/dialogs compartilhados | Typecheck, lint, build |
| Privacidade e auditoria | Melhorada: status, severidade, datas e vazios | Invariantes de privacidade, build |
| Meu perfil | Preservado; herda foco e estados semânticos | Typecheck, build |
| Site: início, sobre, serviços, unidades, contato, links, legais e 404 | Preservado; navegação móvel melhorada | Typecheck, lint, build e HTTP local |
| Cookies e consentimento | Preservado sem dark patterns | Teste estrutural e build |

### Arquivos e componentes principais alterados

- `packages/design-system/src/index.ts`: tokens compartilhados.
- `apps/portal/src/presentation/styles/portal-enhancements.css`: fundação acessível, tipografia clínica e estilos de novos estados.
- `apps/portal/src/presentation/app/FisiofitApp.tsx`: busca e navegação móvel.
- `apps/portal/src/presentation/modules/OperationalShared.tsx`: dialogs, drawers, tabelas, datas e microcopy.
- Módulos locais de pacientes, matrículas, prontuários, financeiro, relatórios, importações, usuários e privacidade.
- `apps/site/src/presentation/components/Header.tsx`: comportamento do menu móvel.
- `apps/portal/src/presentation/modules/OperationalShared.test.ts`: regressões de microcopy e datas.

### Acessibilidade e responsividade

- Implementado: foco visível transversal, `prefers-reduced-motion`, `forced-colors`, controls de 44 px nos contextos críticos, dialogs com trap/retorno, combobox por teclado, mensagens e tabelas semânticas.
- Revisado estaticamente: breakpoints de 360, 390, 720/768, 1050/1024, 1366 e 1440, safe areas, cards móveis, tabelas roláveis e listas alternativas.
- Não homologado visualmente: screenshots, zoom real de 200%, leitor de tela e teclado em navegador. O conector local falhou ao inicializar antes da navegação; essa cobertura permanece pendente e não é declarada como aprovada.

### Validação técnica final

- `npm run typecheck`: passou.
- `npm run lint`: passou.
- `npm run build`: passou; site e portal montados em `dist/`.
- `npm test`: passou; 4 arquivos/23 testes Vitest e 13 testes de plataforma.
- `git diff --check`: passou.
- Rotas HTTP locais `/`, uma rota 404, `/sistema/?preview=1` e `/sistema/login`: responderam HTTP 200.
- Supabase/pgTAP: não executado, pois nenhuma migration, regra de negócio, API ou contrato foi alterado.

### Limitações remanescentes

- A busca global continua limitada aos até 100 pacientes carregados pelo portal, uma limitação funcional já documentada; corrigi-la exige paginação/busca de servidor e ficou fora desta mudança visual.
- A matriz autenticada por papel × unidade × recurso continua dependendo de ambiente de homologação e dados representativos.
- A inspeção visual e assistiva real precisa ser repetida quando o conector de navegador estiver disponível.
