# Release candidato — Fisiofit UI/UX V2

**Fechamento operacional: BLOCKED.** A causa das nove falhas foi comprovada e corrigida exclusivamente no fixture. As execuções comparativas finais base/V2 passaram com a fonte local preservada da API v82. A causa do timeout clínico histórico e a origem de dois 401 observados em uma rodada da base ainda não foram comprovadas. Consulte `OPERATIONAL_CLOSURE.md` e `evidence/operational-closure/comparison.json`; não declarar a homologação integral encerrada.

Branch `feat/ui-ux-v2-20261015`, worktree `/private/tmp/fisiofit-ui-ux-v2-20261015`. O SHA final é o HEAD desta branch. O checkout operacional continua em `fix/estab-009-agenda-authorization` com suas alterações originais preservadas. Não houve publicação nem push.

## Base e preservação

O frontend publicado foi identificado em leitura no GitHub e no domínio: fonte `8e9adda7f9b0198ae181add88fd1548d970750c9`, artefato Hostinger `493d86286829d049de692f072f39e7daffb25ff3`. Assets e hashes estão em `evidence/published-baseline.json`. A relação com as branches locais está em `INVENTORY.md`.

A API v82 contém correções posteriores ao SHA do frontend, registradas no cutover anterior. **Este candidato é exclusivamente frontend. Não publicar a API do repositório desta branch, não executar Supabase CLI, migrations, SQL remoto ou reconciliação como parte deste release.** O workflow existente prepara somente `dist/`; preservar o backend v82, migrations 007/008 e operação normal. Os testes operacionais reproduzem o backend de referência do repositório em banco descartável; não afirmam novo deploy ou nova verificação autenticada da revisão v82.

## Entrega

- Inventário anterior: `INVENTORY.md` e `surfaces.json`, com 615 instâncias em 28 TSX; a estrutura final está em `surfaces-v2.json`, incluindo os novos componentes.
- Padrão V2: `DESIGN_SYSTEM.md`, tokens e componentes React no pacote existente; CSS organizado em cinco responsabilidades.
- Tratamento de todos os módulos, autenticação, perfil, notificações, fluxos internos de agenda/chamada, pacientes, matrículas/planos, financeiro, prontuários, relatórios, importações, usuários, configurações e privacidade.
- Tabelas compartilhadas semânticas, ordenação da página carregada, ações e estados consistentes. Formulários, drawers e diálogos com foco, loading, prevenção de repetição e mensagens claras. Dia/Semana na Agenda sobre a mesma projection existente.
- Achados estritamente frontend tratados separadamente em `FRONTEND_FINDINGS.md`.
- Galeria comparativa local em `REVIEW.html`; matriz em `COVERAGE.md` e `coverage.json`.

Não houve mudança no site público, regras de negócio, permissões, contratos, domínio, cliente HTTP, Supabase, dados reais ou Vault. O pacote de tokens continua compatível com o build do site.

## Homologação única

Pré-requisitos: Node >=20, `npm ci`, Chrome em `/Applications/Google Chrome.app`, Docker com o stack sintético `secfinfinalb14` já identificado pela suíte existente, Deno 2.9.7 no caminho documentado (ou `FISIOFIT_DENO_BIN`) e seu cache de dependências. A suíte recusa um stack diferente e confirma a identidade sintética antes de criar um banco descartável. Não apontar estes testes para produção.

```sh
npm run homologate:ui-v2
```

A entrada executa typecheck, lint do frontend e pacote, build, testes existentes e novos, extrai a base Git para comparação, captura os quatro tamanhos em Chrome temporário, audita com axe-core e verifica teclado/erros. Para reproduzir essas verificações da interface sem depender do estado da API local, use:

```sh
npm run homologate:ui-v2 -- --no-operational
```

`--visual-only` e `--no-baseline` são modos de diagnóstico. `--reuse-visual` só aceita evidências aprovadas cujo hash dos fontes da UI seja idêntico. Nenhum modo publica.

A regressão operacional teve uma execução aprovada e uma repetição com falhas, preservadas em `evidence/operational/`. A investigação diferencial posterior identificou uma falha temporal no fixture de reposição preexistente na base: as duas turmas terminavam ao meio-dia/13h e eram reservadas depois do encerramento. O ajuste preserva as 86 assertions e passou com a base e a V2. A investigação completa, a consideração das alterações posteriores da API v82, as execuções finais aprovadas e as pendências de causa não comprovada estão em `OPERATIONAL_CLOSURE.md`. A mensagem `RECONCILIATION_DRIFT_REVIEW_REQUIRED` é uma rejeição esperada do teste de segurança, seguida de PASS; não era falha de infraestrutura.

As fixtures visuais são mocks exclusivamente locais. Elas verificam renderização e interação; persistência, RLS, concorrência, pagamento e isolamento clínico têm evidência separada em `evidence/operational/`. O onboarding da base tem um redirecionamento prematuro conhecido, registrado como defeito anterior, sem falso PASS.

## Limites da evidência

A matriz diferencia tratamento das 615 instâncias, cobertura herdada de componentes, capturas específicas e testes de persistência. Não declara execução individual de cada ação condicional nem revisão humana individual de cada captura. Navegação e geometrias são verificadas nos quatro tamanhos; as imagens podem ser conferidas em resolução original. Os critérios automáticos do axe não constituem certificação WCAG completa. Testes manuais com leitor de tela e preferências reais da equipe continuam sendo homologação de uso, distinta do candidato técnico.

Envio real de recuperação/convite por e-mail, integrações reais do Notion e visualizador externo de anexos não foram acionados contra provedores de produção. O código desses mecanismos e seus contratos foi preservado. Nenhuma operação clínica ou financeira de teste foi realizada em produção.

## Publicação proposta, somente após autorização

1. Conferir o SHA final desta branch e a matriz/galeria; homologar com a clínica em ambiente de teste.
2. Autorizar o push da branch e o workflow `hostinger-build.yml` **desse SHA exato**. Não fazer merge de branches antigas e não publicar Supabase.
3. Conservar o artefato anterior `493d8628…`; conferir que a Hostinger serve os assets gerados pelo workflow autorizado.
4. Smoke de leitura por perfil: login, unidade, Agenda/Dia/Semana, Chamada/histórico, paciente, plano/cobrança, financeiro e prontuário autorizado. Não criar pagamentos ou registros clínicos fictícios na produção.
5. Se a UI apresentar problema, republicar somente o artefato anterior de frontend. Manter API v82 e banco intactos.

## Memória e autorização

Memória Obsidian consultada no início. O Vault já tinha alterações não sincronizadas e três commits locais. A restrição específica final desta tarefa proíbe modificá-lo sem nova autorização; portanto não foi feita gravação, commit ou sincronização do Vault. Os resultados e a continuidade ficam neste pacote de release. Nenhum commit/push foi feito no checkout operacional; o commit solicitado pertence exclusivamente à branch isolada.
