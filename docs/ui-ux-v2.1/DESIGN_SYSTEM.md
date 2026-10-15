# Design System V2.1 — evolução da V2

A paleta, a tipografia, a navegação e a organização das páginas foram preservadas. Nenhuma dependência visual nova foi adicionada.

- Tokens novos: `--ff-control-compact` (40px) e `--ff-control-border` (mesmo neutro `#526477` já usado na V2). Controles regulares continuam em 44px.
- Button: type explícito com default seguro `button`, busyLabel opcional, prevenção de nova ativação durante busy e variante iconOnly; formulário que usa Button para enviar informa `type="submit"`. CSS existente também atende botões HTML dos módulos.
- DataTable: alinhamento de coluna explícito, números tabulares, caption, contagem anunciada e grupos de ações com nome do registro. Ordenação continua local à página carregada.
- FilterSummary: apresenta exclusivamente filtros realmente aplicados, contagem e limpeza do estado existente. Não implementa filtros fictícios nem altera consultas.
- FormPrimitives: preserva atributos acessíveis externos; associação entre label, hint, erro e controle permanece estável. FormAccessibility limpa erros/reset e distingue customError, blur e envio.
- PatientPicker: estados digitando, carregando, vazio, erro e selecionado distinguíveis; ID só é enviado após escolha explícita. Tratamento de resposta atrasada, consulta curta, escopo, teclado, Escape, blur e reset centralizado no componente existente.
- DecisionHost: recebe título, label da consequência e gravidade por opções, mantendo a Promise e o contrato dos handlers. O foco inicial explícito agora precede o botão de fechar.
- useUnsavedChanges: fechamento único e protegido para troca de plano, correção de cobrança e condição contratual; proteção já existente de outros drawers/edições permanece.

CSS foi alterado nos blocos responsáveis de `components.css`; `modules.css` recebeu somente o layout específico da consulta anual. Não foi criada uma folha cumulativa de overrides. Movimento reduzido continua respeitado. Não há alterações nos valores ou regras financeiras, nos contratos HTTP, no domínio, na infraestrutura, no backend ou no site público.
