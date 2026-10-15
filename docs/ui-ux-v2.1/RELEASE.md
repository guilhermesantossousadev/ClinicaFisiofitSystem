# Fisiofit UI/UX V2.1 — entrega integrada

**Status de aceite integral: BLOCKED.** A implementação frontend está concluída e tem homologação própria de interface. A regressão operacional autenticada não foi encerrada: houve HTTP 401 em `/me` tanto na V2 quanto na candidata, e uma tentativa HTTP isolada posterior não conseguiu iniciar o Storage local. Não há evidência de causa atribuível ao refinamento; também não há fundamento para declarar esses problemas resolvidos.

Branch: `feat/ui-ux-v2.1-20261015`. Worktree: `/private/tmp/fisiofit-ui-ux-v2.1-20261015`. Commit final: HEAD dessa branch, criado exclusivamente para esta entrega. Base confirmada, limpa antes do início: `a0fef799cc8556e8458622da55a019f2611f5b05` em `feat/ui-ux-v2-20261015`.

## O que foi entregue

- [Auditoria e problemas resolvidos](AUDIT.md): avaliação por famílias, gravidade, decisões e fontes. Mantidos os IDs das 615 superfícies do inventário original em [coverage.json](coverage.json), sem confundir avaliação herdada com execução individual.
- [Design System V2.1](DESIGN_SYSTEM.md): controles de 44/40px, borda acessível, estados de botão, alinhamento financeiro, contexto de ações, atributos acessíveis, seleção e foco.
- Seleção explícita de paciente com ajuda de estado, teclado, Escape por camada, reset e rejeição de respostas atrasadas. Nenhuma busca nova depois de selecionar o paciente.
- Validação no momento adequado, mensagens específicas, sumário navegável, correção sem perder valores e limpeza de erros ao reiniciar.
- Confirmações com nome da consequência e variante destrutiva. Foco inicial em Voltar. Edições financeiras e troca de plano protegem alterações não salvas.
- Filtros aplicados e contagem visíveis no controle mensal; clareza entre texto digitado e busca aplicada em pacientes.
- Relatório anual consulta o ano explicitamente, mantém o ano ao trocar unidade, oculta resultados do escopo anterior e ignora respostas antigas.
- Datas brasileiras na prévia da troca, status e formas de pagamento traduzidos no histórico, ações de agenda mais claras e cancelamento correto da primeira etapa de retificação.
- [Galeria comparativa](REVIEW.html) local com V2 e V2.1, busca por tela/largura e imagens originais. Não há publicação dessa galeria na internet.
- [Avaliação das 12 jornadas](JOURNEYS.md), distinguindo inspeção, interação sintética e persistência real local.

## Evidências e reprodução

A evidência final da interface fica em [homologation.json](evidence/homologation.json), [visual-summary.json](evidence/visual-summary.json), [resultado V2](evidence/before/result.json) e [resultado V2.1](evidence/after/result.json). O runner recusa reaproveitamento visual quando o hash do frontend mudou.

Entrada local:

```sh
npm run homologate:ui-v21
```

Ela executa typecheck, lint, lint do Design System, build, Vitest e Node nessa ordem, seguido de Chrome temporário, axe, responsividade, teclado, estados de formulário, filtros, foco, prévia e envio único. O teste Node de empacotamento depende do build; por isso o build é obrigatório antes dos testes.

Para refazer também a base, use uma worktree limpa desse SHA, com dependências instaladas:

```sh
FISIOFIT_V21_BASELINE_ROOT=/private/tmp/fisiofit-ui-ux-v2-20261015 npm run homologate:ui-v21
```

As capturas usam 1440, 1280, 768 e 390 CSS px. Testes adicionais ampliam o texto a 200% em 720 CSS px e emulam reduced-motion. O relatório diferencia qualidade da UI e aceite integral. O comando termina com código de falha enquanto o status integral for BLOCKED, mesmo quando as verificações da interface passam. Nenhum modo publica ou sincroniza.

Typecheck, lint, lint do pacote, build, 80 testes Vitest e 34 testes Node foram aprovados na execução final. A comparação final contém 208 capturas da V2 e 213 da V2.1, com 270 verificações aprovadas e zero violações axe detectadas. Hash dos fontes UI verificados: `19ec04d58cf512fe0ffa9929a2329e3338a949404e3a3afdfb133b72ccbaf508`. Os resultados visuais finais e suas contagens devem ser lidos do JSON vinculado; a galeria não declara certificação WCAG integral. A inspeção visual incluiu formulário mobile, tabela financeira, prévia de plano, seletor selecionado e texto ampliado. Há assertions reais de Tab/Shift+Tab, setas, Home, Enter e Escape. Não houve sessão com leitor de tela nem homologação com a equipe da clínica.

## Comparação operacional e bloqueios

As rodadas [V2](evidence/operational/before/summary.json) e [candidata](evidence/operational/after/summary.json) conservaram todas as assertions. Cada uma passou nas **367 assertions SQL**, incluindo 86 da suíte operacional. A rejeição `RECONCILIATION_DRIFT_REVIEW_REQUIRED` é esperada pelo teste de segurança, que passou; não explica a falha do navegador.

Os [fingerprints comparativos](evidence/operational/comparison.json) confirmam igualdade da fonte de API, migrations, fixtures, runner, versão PostgreSQL, funções, colunas e condições configuradas. Backend de referência: fonte local preservada do cutover v82, digest `8b38c04f5ff62d48d953b40818e6a53fc88a59d723701dae68c90b2aaf7f5e97`. Isso não executa nem recertifica a API remota de produção.

| Execução desta tarefa | Resultado preservado |
|---|---|
| V2 original, comparação autenticada | SQL aprovado; FAIL no navegador: 401 em `/me`, timeout aguardando portal autenticado |
| Candidata durante implementação, comparação autenticada | SQL aprovado; FAIL no navegador: 401 em `/me`, timeout aguardando aula do painel |
| HTTP isolado posterior | FAIL de infraestrutura local: Storage não ficou pronto na porta 57432; não houve PASS HTTP dessa rodada |

Esses resultados são preservados, mesmo quando uma fase anterior passou. Os hashes dos fontes testados estão nos respectivos environment.json; ajustes frontend posteriores de foco, relatório e texto não devem ser apresentados como se tivessem passado nessa execução operacional anterior. A versão final tem evidência própria de UI; o fechamento autenticado final permanece pendente.

O timeout histórico da busca clínica e os dois 401 históricos da base continuam com causa não comprovada. Os novos 401 não demonstram que sejam o mesmo problema histórico. Nenhuma assertion foi excluída e nenhuma execução histórica foi reapresentada como PASS desta tarefa.

Também foram preservadas as correções de problemas encontrados durante o trabalho: prioridade de foco corrigida após assertion falhar; ordem build→Node corrigida após falta de dist; o contexto de um runner ampliado foi corrigido após uma execução em andamento carregar a versão anterior. A falha deste último runner está em [attempts](evidence/attempts/runner-context-failure.json). São ocorrências distintas dos bloqueios operacionais.

Próxima ação necessária: recuperar a disponibilidade estável do ambiente sintético e investigar o 401 com telemetria sanitizada de autenticação, mantendo o frontend final congelado. Depois repetir base e candidata sequencialmente, com a mesma fonte local v82, todos os guards e assertions. Essa investigação não autoriza alterar autenticação, API, produção ou contratos nesta entrega.

## Preservação e memória

Sem alterações em API, contratos HTTP, migrations, SQL, RLS, permissões, domínio, infraestrutura, autenticação, site público ou dados reais. Regras financeiras, de agenda e reposição permanecem intactas. Sem biblioteca nova, push, merge ou publicação. O checkout original e a worktree V2 permanecem preservados.

Graphify foi consultado antes das alterações e atualizado em modo AST. A ferramenta informou ausência opcional de `tree_sitter_sql`; não houve instalação nem alteração de SQL por esse motivo.

A skill Obsidian foi usada em leitura (`status` e `load`). A proibição específica desta tarefa de modificar ou sincronizar o Vault prevalece sobre a orientação genérica de gravar memória ao concluir. Não houve escrita, commit ou sincronização do Vault. Ele já apresentava mudanças locais e três commits não sincronizados antes desta tarefa. A continuidade desta entrega fica neste documento.
