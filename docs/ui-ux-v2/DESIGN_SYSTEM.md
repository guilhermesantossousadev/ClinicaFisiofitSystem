# Design System Fisiofit V2

O pacote existente foi evoluído. Nenhum framework visual foi introduzido. A marca do site público permanece estável; o portal usa tokens próprios, com aliases de transição para os nomes antigos.

| Fundação | Decisão |
|---|---|
| Superfícies | Branco `#fff`, canvas `#f5f7fa`, neutro `#f8fafc`; bordas `#dce3eb` |
| Texto | Principal `#203449`, forte `#132b40`, secundário `#526477` |
| Ação | Azul `#176b9c`, hover `#10567e`, fundo suave `#edf5fb` |
| Apoio | Teal `#16776d` / `#edf8f5`; sucesso, aviso e erro têm pares semânticos próprios |
| Tipografia | Fonte do sistema, sem download externo. Trabalho e labels 14px; campos de celular mantêm legibilidade; apoio mínimo 12px; corpo de texto 16px quando necessário; títulos 20/24/30px |
| Espaço | 4/8/12/16/20/24/32/40px; formulários em uma ou duas colunas conforme espaço real |
| Controles | Referência 44px; raio 8px; foco de 3px com offset; disabled preserva significado e estado |
| Cards | Raio 12px, borda sutil e sombra leve; títulos e métricas sem gradientes decorativos |
| Ícones | SVGs locais com traço consistente, 20px; ícones decorativos ocultos da árvore acessível |
| Movimento | 140ms para feedback visual; loading com texto e estado; reduced-motion respeitado |

Tokens em `packages/design-system/src/index.ts`. React em `@fisiofit/design-system/react`: `Icon`, `Button`, `Notice`, `EmptyState`, `Skeleton`, `Tabs`, `DataTable`, `useDialogFocus`. A entrada de tokens não importa React; isso preserva seu uso no Tailwind do site durante o build.

## Contratos de interação

**Campos:** `FormPrimitives` mantém IDs estáveis, label associado, required real, descrição e erro associados. O grupo de dias usa fieldset/legend e validação existente, sem `aria-required` inválido em group. Formulários preservam conteúdo ao falhar. O sumário de validação pode abrir sobre um drawer; somente o diálogo superior recebe foco.

**Diálogos:** uma pilha coordena foco inicial, Tab/Shift+Tab, Escape, restauração, bloqueio de scroll e `inert` fora da camada ativa. `DecisionHost` substitui todos os `window.confirm/prompt` do portal. Ações de descarte têm opção de voltar; decisões financeiras e clínicas explicam o efeito antes do envio. Justificativas continuam com as validações existentes.

**Feedback:** `Notice` distingue erro e sucesso por conteúdo, ícone, cor e role. Erros são assertivos e não exibem sucesso. Avisos persistem até descarte ou atualização de contexto, evitando perder uma falha importante. Falhas de busca aparecem como falhas, não como listas vazias. Notificações têm filtros reais, contagem de não lidas, fechamento por Escape e trava durante atualização.

**Tabelas:** `DataTable` usa table/thead/tbody/th/td, headers associados, região rolável identificada, total explícito, empty state, ações consistentes e ordenação real somente no conjunto carregado. Em listagens paginadas, o texto informa que a ordenação é da página atual. Datas usam o valor original para ordem cronológica. Não foram criadas paginação ou ordenação de servidor sem contrato. Tabelas especializadas de plano, histórico e relatório conservam sua estrutura de domínio e recebem a mesma tipografia, cores, ações e containers responsivos.

**Abas:** `Tabs` usa tablist/tab/tabpanel, IDs associados, roving tabindex, setas, Home/End. Navegação de matrículas conserva rotas e `aria-current`, pois representa páginas internas.

**Agenda:** Dia/Semana usa a projection já existente; trocar a visualização não cria dados, não altera o schedule, a janela de geração ou as regras de conflito. A lista mobile apresenta os mesmos itens do calendário. Detalhes, participantes, chamada, remarcação, substituição e cancelamento conservam seus contratos.

## Organização do CSS

`index.css` é somente o ponto de entrada: `foundations.css`, `components.css`, `shell.css`, `modules.css`, `auth.css`. As folhas cumulativas anteriores foram substituídas. Regras genéricas substituídas e seletores sem uso foram removidos; layouts específicos e estados de domínio foram migrados. A escala de texto e as cores centrais ficam no pacote; não introduzir tamanho operacional inferior a 12px nem novos overrides de `.btn`, `.modal-form`, `.form-field` em módulos.

Testes do pacote ficam no portal, consumidor React existente: `DesignSystem.test.tsx`, mais a suíte Chrome com axe-core. A auditoria automática e as amostras inspecionadas visualmente têm alcance registrado na matriz; não constituem certificação WCAG.
