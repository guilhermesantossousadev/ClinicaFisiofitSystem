# Release integrado de estabilização — Fisiofit

Candidato na branch `release/estabilizacao-geral-20261015`, worktree `/private/tmp/fisiofit-estabilizacao-geral-20261015`. A identidade final é o resultado de `git rev-parse HEAD` nessa branch. Base aprovada preservada: `72cd07de72c4d2bdb9c23b581b1a7926ae093503`.

**Candidato homologado em ambiente isolado; publicação e aprovação operacional de produção pendentes.** Não houve deploy, push, alterações em pacientes reais ou backfill remoto. O checkout operacional sujo não foi usado como base nem alterado.

## Resultado e autoridade operacional

24 achados históricos revalidados, 21 corrigidos e 3 já resolvidos na base; detalhes individuais em [ESTAB-001-024.md](ESTAB-001-024.md). Mais 7 integrações atuais foram verificadas e corrigidas na mesma matriz: total de 31 itens, 28 corrigidos e 3 já resolvidos. Ajustes intermediários do próprio desenvolvimento não entram na contagem.

Agenda, roster e chamada passam a ler Class de forma uniforme. Endpoints com nomes legados são adaptadores; novas escritas explícitas usam ponte transacional, sem reprocessamento em massa. Agenda bloqueia conflitos reais e mantém capacidade informativa (RN-006). Permanência usa vigência e versão; remarcação pontual conserva a origem da recorrência e muda a data exibida. O financeiro aprovado continua com snapshots, termos por competência e matrícula sucessora.

Chamada inclui notas, revisão otimista e histórico; créditos usam as tabelas existentes e só são consumidos com presença. Política indefinida encaminha para revisão; não há prazo de reposição inventado. Feriado não gera crédito. Afastamento lista aulas afetadas para substituição explícita. Prontuários descartam respostas antigas ao trocar paciente; anexos usam JWT e URL temporária, com o módulo clínico exigido também pelo Storage. Usuários e profissionais atualizam associações em uma transação. Conteúdo clínico não entra em notificações ou logs de erro.

## Homologação executável e limites

Entrada única, exclusivamente local: `DENO_DIR=/private/tmp/fisiofit-hotfix-deno-final-20261014 node scripts/homologate-stabilization.mjs`.

Pré-requisitos: dependências instaladas (`npm ci`), Docker ativo com o stack sintético `secfinfinalb14`, Deno 2.9.7 (alternativa via `DENO_BIN`) e Google Chrome em `/Applications`. O runner recusa outro stack ou clínicas fora da identidade sintética esperada; não usa credenciais de produção. Cria banco descartável, reproduz migrations do repositório, inicia REST/API/Storage isolados e usa contas Auth temporárias locais. Nenhuma tabela clínica da instância original é clonada. `--sql-only`, `--http-only` e `--no-browser` servem para diagnóstico dentro da mesma entrada.

Resultados realmente executados na bateria final: **367 assertions SQL/RLS (86 novas), 66 Vitest, 34 Node, 11 Deno, 44 requisições HTTP e 10 verificações UI**, todos aprovados. Typecheck, lint, Deno check, build, regressão financeira e diff-check também aprovados. A regressão financeira repetiu suas 53 assertions SQL; elas não foram somadas novamente ao total. Preservação de dados existentes e reconciliação guardada têm evidências próprias.

Evidências consolidadas em `evidence/acceptance.json`, `evidence/browser-result.json`, `evidence/http-result.json` e logs selecionados. J-01–J-06 têm assertions de estado efetivo no PostgreSQL; chamadas e pagamentos incluem concorrência HTTP, não somente mocks. O navegador realiza login, busca além de 100 pacientes, chamada persistida, troca de pacientes com resposta atrasada, nova evolução, logout e leitura financeira segregada. As dez verificações de UI não representam cobertura visual de todos os formulários.

Serviços externos (Notion, WhatsApp/e-mail), envio real de convites, recuperação de senha por e-mail e abertura em visualizador externo do arquivo clínico não foram homologados contra provedores reais. Importações mantêm o processamento por linha e relatório de falhas existentes; não se promete atomicidade global de todo arquivo. Relatórios e comissões não receberam simulação operacional completa. Não há afirmação de PASS para esses itens. O Graphify foi atualizado por AST; o parser SQL opcional não está instalado, portanto os testes PostgreSQL são a evidência do banco.

## Produção: divergência identificada, sem mutação

Consultas agregadas `BEGIN READ ONLY` confirmaram migrations até `202610140007`, 64 turmas legadas ativas, 151 vínculos ativos e API v78. Workflow Hostinger [38676754667](https://github.com/guilhermesantossousadev/ClinicaFisiofitSystem/actions/runs/38676754667) concluiu a base financeira. Assets públicos `index-BQlYESyq.js` e `index-YGLJ4t1R.css` coincidem com a branch de artefatos desse commit (HTTP 200). Isso substitui o handoff anterior que ainda dizia publicação pendente.

Reconciliação revisada: 3 vínculos legados sem Class (2 pacientes válidos, 1 paciente excluído), 2 vínculos Class ainda vigentes após encerramento legado. Sem referências de turma inválidas ou duplicidade ativa de profile profissional. Nenhum identificador ou dado clínico foi coletado para esse relatório.

O script [reconcile-approved-four.sql](reconcile-approved-four.sql) é uma **ação de dados separada**, dependente de autorização específica: cria os 2 vínculos válidos apenas daqui para frente e encerra a vigência futura dos outros 2. Exige identidade do administrador responsável, fingerprint exato, contagens e referências revisadas; qualquer drift, conflito ou participante explícito pendente aborta a transação inteira. Reutiliza as mesmas constraints de conflito do fluxo operacional e audita a autoria real, sem selecionar um proprietário para impersonação. Foi ensaiado com duas inserções e dois encerramentos sintéticos, rejeição de fingerprint e preservação do paciente excluído.

O vínculo com paciente excluído permanece intacto e fora do roster operacional. Sua destinação requer revisão administrativa individual; o release não reativa nem apaga esse paciente. Se o preflight divergir ou o script abortar, interromper publicação e revisar o caso. Não substituir o fingerprint para forçar passagem.

## Banco, API e frontend

Somente `202610150008_operational_stabilization.sql` é nova. Não reaplicar a 007 nem branches antigas. Migrations anteriores estão presentes apenas como histórico e fixtures. A nova migration altera funções, grants, políticas, constraints e colunas incrementais; não faz backfill de registros existentes. O ensaio com dados financeiros preenchidos compara todos os valores originais de todas as tabelas públicas antes/depois e exige identidade.

Publicar em janela coordenada, com pausa breve de escritas durante banco/reconciliação/API. O novo banco revoga DML antigo que a API nova substitui por RPCs; evitar operar com API velha após aplicar o banco. Em falha dentro da transação SQL, há rollback integral. Em falha após commit, manter pausa de escritas e corrigir para frente; não remover colunas nem restaurar contadores financeiros por SQL avulso. O commit financeiro anterior continua disponível como referência, mas voltar só a API antiga não é contingência compatível com todos os novos grants. Conservar o pacote anterior de frontend até concluir o smoke.

## Comandos mínimos — executar somente após autorização final

Na worktree do candidato, conferir o commit aprovado com `git rev-parse HEAD`. Definir `FISIOFIT_DB_URL` por meio seguro e `FISIOFIT_OPERATOR_PROFILE_ID` com o UUID do administrador que assumirá a autoria dos quatro ajustes; não imprimir DSN/senha/token.

```sh
# Preflight somente leitura: confirmar que a revisão continua válida.
psql -X -v ON_ERROR_STOP=1 "$FISIOFIT_DB_URL" -f docs/stabilization/production-readonly.sql
psql -X -v ON_ERROR_STOP=1 "$FISIOFIT_DB_URL" -f docs/stabilization/reconciliation-readonly.sql
# Banco: exatamente a migration nova, registrada na mesma transação.
psql -X -v ON_ERROR_STOP=1 "$FISIOFIT_DB_URL" -f docs/stabilization/apply-pending-migration.sql
# Dados: somente os quatro ajustes explicitamente aprovados.
psql -X -v ON_ERROR_STOP=1 -v operator_profile_id="$FISIOFIT_OPERATOR_PROFILE_ID" "$FISIOFIT_DB_URL" -f docs/stabilization/reconcile-approved-four.sql
# API mantém autenticação própria por JWT no middleware.
npx supabase functions deploy api --project-ref eeltguuoxpfttjznugla --no-verify-jwt --use-api
# Frontend pelo workflow existente; não fazer merge de branches antigas.
git push origin HEAD:refs/heads/release/estabilizacao-geral-20261015
gh workflow run hostinger-build.yml --ref release/estabilizacao-geral-20261015
```

Esperar o workflow concluir e a Hostinger servir os mesmos assets. Nenhum comando acima foi executado nesta entrega, exceto as consultas somente leitura equivalentes. O runner local jamais publica.

## Conferência da clínica em até 15 minutos

Usar contas autorizadas; roteiro de produção abaixo é de leitura, sem lançar pagamentos de teste, assinar prontuários reais ou modificar agendas reais.

1. **0–2 min:** login administração/recepção; unidade ativa e paciente conhecido em cada unidade; conferir busca de paciente fora dos primeiros 100.
2. **2–5 min:** semana atual e próxima; turma/profissional/unidade, lista de pacientes e horários; conferir que duas turmas paralelas legítimas aparecem e que encerramentos não reaparecem.
3. **5–7 min:** fisioterapeuta responsável e substituta abrem apenas chamadas atribuídas; conferir presença, observações e histórico já existentes. Trocar unidade; agenda não autorizada deve permanecer indisponível.
4. **7–9 min:** abrir paciente A e trocar rapidamente para B em Prontuários; somente conteúdo de B; abrir anexo permitido. Recepção/financeiro não devem conseguir obter conteúdo clínico.
5. **9–12 min:** financeiro abre cobrança parcial conhecida, pagamentos correspondentes, saldo e competência. Conferir histórico de troca de plano e preço contratual; comparar outra unidade sem alterar registros.
6. **12–14 min:** verificar feriado/afastamento, aula remarcada, créditos/reservas existentes e notificações; confirmar datas e responsáveis. Não conceder créditos retroativos automaticamente.
7. **14–15 min:** logout/login de perfil restrito, conferir navegação e uma negação de acesso; registrar somente resultado/código, sem conteúdo clínico. Liberar operação após aceite da clínica; manter bloqueio se houver P0 ou P1 essencial reproduzido.
