# Fechamento diferencial da homologação operacional

**Status: BLOCKED.** A divergência de reposições foi comprovada e corrigida no fixture. As execuções comparativas finais passaram. O timeout histórico de busca continua sem causa comprovada, portanto este documento não declara encerramento integral nem autorização de publicação. Não foi classificado como flakiness.

Referências: base `8e9adda7f9b0198ae181add88fd1548d970750c9`; candidato visual `029eee4e1c9fbe5b3b5b659e66ee085d94b0272b`; branch `feat/ui-ux-v2-20261015`. O commit de fechamento é o HEAD dessa branch. Todos os novos resultados estão em [operational-closure](evidence/operational-closure/comparison.json).

## 1. Causa das nove falhas

**Falha de fixture/runner preexistente na base, dependente do horário.** O fixture original cria reposições no dia atual às 11–12h e 12–13h. A função existente `manage_makeup_credit` rejeita uma reserva quando `target.end_at < now()`. Nas reproduções, já haviam passado os dois horários. A primeira reserva não ocorre e as demais verificações falham em cascata. A API faz a rejeição prevista; a UI nem participa dos testes SQL.

As execuções com o fixture original na base e na V2 produziram os mesmos nove números e mensagens. Os fontes originais do teste são idênticos: SHA-256 `e05d2ae84258482cea18f87571eef71c59dde070dd27adba7e5ec3938bd4a86a`.

ASSERTION | DESCRIÇÃO ORIGINAL | MOTIVO OBSERVADO
---|---|---
32 | J03 reserve credit atomically | Turma encerrada: `INVALID_OCCURRENCE_STATE_TRANSITION`.
33 | J03 reservation does not consume credit | Sem reserva, estado continua `eligible`.
34 | J03 retry reservation is idempotent | A reserva inicial nunca existiu; turma segue encerrada.
35 | J03 duplicate credit use rejected | Sem reserva prévia, ocorre rejeição por horário em vez de crédito indisponível.
36 | J03 record actual makeup presence | Reserva não criou o participante: `PATIENT_NOT_IN_OCCURRENCE_ROSTER`.
37 | J03 only confirmed presence consumes credit | Sem presença registrada, crédito permanece elegível.
38 | J03 consumed source cannot be silently rewritten | Crédito não foi consumido, logo a proteção de crédito consumido não é acionada.
43 | J03 returned credit can be booked again | A segunda turma também já terminou.
44 | J03 record no-show at makeup | Sem reserva/participante na segunda turma.

A prova negativa [expired-fixture-probe.json](evidence/operational-closure/expiry-proof-final/expired-fixture-probe.json) força somente os timestamps dos dois alvos sintéticos para o passado, dentro de transações descartadas. Reproduz exatamente essas nove falhas nas versões base e V2, independentemente do horário real. Não altera funções, privilégios ou relógio do banco e não apresenta as nove falhas esperadas como aprovação da suíte completa.

### Correção mínima

Somente o fixture SQL mudou: timezone da sessão alinhado a `America/Sao_Paulo`; duas turmas de reposição com término às `24:00`; substituição profissional conservando esse intervalo. Assim, as turmas continuam no dia permitido pela regra de presença e terminam depois de `now()` por toda a transação. `now()` e `current_date` são estáveis na transação, inclusive se a execução atravessar meia-noite.

As **86 assertions e seus nomes foram preservados**, incluindo idempotência, rejeição de duplicação, consumo apenas por presença, proteção de histórico, devolução e falta na reposição. Não houve alteração em API, migrations ou regras de negócio.

## 2. Timeout da busca clínica

**Classificação: causa ainda não comprovada.** O log histórico registra timeout genérico e nenhuma resposta HTTP com erro, mas não informa qual paciente, conteúdo do combobox ou consultas/respostas correspondentes. Não há evidência suficiente para atribuí-lo à UI, infraestrutura, API v82 ou runner.

A busca e a troca Alpha→Beta passaram na base e na V2 com o mesmo backend de referência. A V2 também passou com atraso artificial de 1.500 ms na listagem inicial, 300 ms na busca e CPU 4× mais lenta. A troca de paciente mantém o teste existente de resposta clínica Alpha atrasada em 1.000 ms: conteúdo antigo não aparece, e o rascunho é gravado no paciente Beta no banco real isolado.

Com a fonte local preservada do cutover v82, as duas execuções comparativas finais também passaram. Isso comprova o comportamento nesses cenários; não prova retroativamente a causa do timeout histórico.

O runner agora distingue o paciente no timeout e preserva screenshot, estado do combobox e caminhos/status da rede. Rejeita portas ocupadas, usa `--strictPort` e controla diretamente o processo Vite, com log de inicialização. São melhorias de observabilidade e controle do ambiente, **não uma alegação de causa confirmada**. O limite original de 30 segundos foi mantido.

## 3. Comparação sob condições iguais

Os fingerprints [base](evidence/operational-closure/v82-base-final/environment.json) e [V2](evidence/operational-closure/v82-v2-final/environment.json) comprovam igualdade de backend, migrations, fixtures, runner, versão PostgreSQL, definições das funções e colunas, e condições de CPU/rede. As execuções foram sequenciais no mesmo stack local sintético `secfinfinalb14`, em bancos descartáveis diferentes, reconstruídos pelas mesmas migrations e seeds. Identificadores aleatórios das contas de teste não são dados de produção.

Backend local preservado do cutover v82: digest dos fontes executáveis `8b38c04f5ff62d48d953b40818e6a53fc88a59d723701dae68c90b2aaf7f5e97`. O registro anterior de publicação v82 conserva o bundle `dbc51762026d636dad700ae105c876fdd44519d655dfa3122d6d0e1a3bc94e53`. O teste utiliza fontes locais, não executa a função publicada remotamente nem recertifica o schema real da produção.

A diferença posterior ao commit-base está em `agenda.ts`: tratamento do flag de smoke na geração/leitura de Agenda e Chamada. Nos testes o flag é explicitamente `false`, como no cutover. As funções SQL de crédito e o endpoint de busca de pacientes não mudam nessa comparação. A diferença de versão da API foi considerada e não explica as nove falhas.

RODADA | SQL | BUSCA/FLUXOS NO NAVEGADOR | RESULTADO
---|---|---|---
Fixture original, base | Mesmas nove falhas em 86 | Não executado nessa reprodução SQL | Falha preexistente reproduzida
Fixture original, V2 | Mesmas nove falhas em 86 | Não executado nessa reprodução SQL | Mesma falha
Fixture corrigido, UI-base, API de referência | 367/367 | 44 HTTP; 10 jornadas UI | PASS dessa rodada
V2, API de referência, normal | Diagnóstico runtime, sem suítes SQL | 44 HTTP; 10 jornadas UI | PASS desse diagnóstico
V2, API de referência, atrasos/CPU controlados | Diagnóstico runtime, sem suítes SQL | 44 HTTP; 10 jornadas UI | PASS desse diagnóstico
Base, fonte local v82, primeira rodada | 367/367 | As 10 jornadas concluíram; dois HTTP 401 detectados | FAIL no guard de rede
V2, fonte local v82, final | 367/367 + prova negativa | 44 HTTP; 10 jornadas UI; zero HTTP de erro | PASS dessa rodada
Base, fonte local v82, final | 367/367 + prova negativa | 44 HTTP; 10 jornadas UI; zero HTTP de erro | PASS dessa rodada

Uma rodada da base retornou 401 em `/dashboard` e `/units` em uma sequência que inclui logout e entrada com perfil financeiro. [Registro bruto](evidence/operational-closure/v82-base-first/browser-result.json). O log não contém timestamps suficientes para associar esses erros a uma etapa específica. É uma observação preexistente na base; sua origem não foi comprovada. A checagem de falhas de rede permaneceu ativa e essa rodada continua marcada FAIL, mesmo com a repetição final aprovada.

As jornadas verificam login real sintético, Agenda Class no painel, busca além dos primeiros 100 pacientes, Chamada persistida, descarte de resposta clínica antiga, rascunho no paciente correto, mobile, logout, isolamento financeiro/clínico e quitação por dois meios. Os 44 testes HTTP verificam também RLS entre clínicas, permissões, concorrência de chamada, histórico, idempotência de pagamento e bytes reais de anexo em Storage isolado.

## 4. Procedimento de reprodução

No worktree V2, com o stack sintético existente, Chrome e Deno locais:

```sh
DENO_BIN="$PWD/scripts/ui-v2/deno.sh" \
FISIOFIT_TEST_API_ROOT=/private/tmp/fisiofit-agenda-chamada-final-20261015 \
FISIOFIT_TEST_OUTPUT=/private/tmp/fisiofit-operational-review \
node scripts/homologate-stabilization.mjs --http-only --fixture-probe
```

Para a comparação, repetir o mesmo comando com `FISIOFIT_TEST_UI_ROOT` apontando para uma extração limpa do commit-base, com suas dependências instaladas, e outro `FISIOFIT_TEST_OUTPUT`. Os fingerprints precisam coincidir nos campos definidos em `comparison.json`. `--http-only` evita repetir typecheck/lint/build/testes já aprovados; mantém todas as suítes SQL e os testes HTTP/navegador. `--runtime-only` é exclusivamente diagnóstico e declara esse escopo no resultado.

## 5. Preservação e pendências

Nenhum arquivo de frontend ou Design System mudou neste fechamento. O digest da UI permanece `e4b34da1ab11b30317501a55b556bf545a8b1123b3490f1bd9771d8c6e49ad67`, igual às evidências aprovadas. As 394 capturas e 232 verificações anteriores foram preservadas; não foram repetidas. Typecheck, lint, build, 74 Vitest e 34 Node anteriores seguem como evidência do mesmo frontend. Os scripts novos/alterados passaram em `node --check` e o diff passou em `git diff --check`.

Não houve alteração de API, migrations, produção, checkout operacional ou Vault, nem push/publicação. Memória contextual consultada; o Vault continua com alterações prévias não sincronizadas e sem autorização específica de escrita nesta tarefa.

Pendências reais:

1. Causa do timeout clínico histórico ainda não comprovada, apesar das reproduções normais e sob atraso aprovadas.
2. Origem dos dois 401 observados em uma rodada da base ainda não comprovada; a repetição final passou. Não houve redução de verificações para obter PASS.

**BLOCKED para declarar a homologação integral encerrada.** Não há regressão da V2 demonstrada pelas comparações executadas. A branch e suas evidências estão preparadas para revisão técnica; este resultado não autoriza publicação e não abre uma nova estabilização geral.
