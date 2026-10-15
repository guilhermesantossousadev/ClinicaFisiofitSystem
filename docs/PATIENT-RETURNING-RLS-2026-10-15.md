# Cadastro de pacientes — correção isolada de RLS

Escopo: frontend aprovado `a7ced300cdec4a33b5b51cc258a0170bdb955175`, API publicada v82 preservada, banco sintético descartável. Nenhuma aplicação desta correção em produção está autorizada.

## Causa comprovada

`POST /patients` usa `.insert(...).select().single()`. O SQL efetivo do PostgREST, capturado em `pg_stat_statements` no banco descartável, contém `WITH pgrst_source AS (INSERT INTO public.patients (...) ... RETURNING public.patients.*) ...`.

A policy restritiva SELECT `patients_module_select` exigia `can_access_patient(id)`. Essa função consulta `patients` pelo ID. PostgreSQL transforma as políticas SELECT necessárias ao RETURNING em verificações da tupla proposta **antes** de inseri-la; a função ainda não encontra o paciente. Resultado original: SQLSTATE `42501`, policy `patients_module_select`, `ExecWithCheckOptions`, `execMain.c:2153`. INSERT simples seguido de SELECT funciona; INSERT RETURNING falha e não persiste paciente nem auditoria. Alterar apenas STABLE para VOLATILE também falhou na sonda e foi descartado.

Não falta matrícula, responsável ou outra relação obrigatória: o ramo administrativo existente já permite leitura pela unidade principal. O bloqueio acontece antes que essa leitura por ID possa encontrar a linha.

## Alteração

A migration `202610150009_patient_returning_rls.sql` altera somente a expressão da policy SELECT existente. Mantém `can_access_patient(id)` e acrescenta a avaliação direta do seu ramo administrativo: mesma clínica, paciente não excluído, permissão de leitura de pacientes, papel admin/manager/reception e unidade principal autorizada. Para linhas existentes, esse ramo já era permitido pela função; profissionais continuam sujeitos aos vínculos originais.

Policy continua RESTRICTIVE, para authenticated. INSERT e UPDATE WITH CHECK, grants, RLS, funções SECURITY DEFINER existentes, API, frontend e regras de negócio não mudam. Nenhuma migration histórica é editada. Não há service_role no acesso comum.

## Produção: diagnóstico somente leitura

Consultadas definições/metadados em transações READ ONLY, sem leitura de pacientes reais. A produção tem a mesma função STABLE e as mesmas policies anteriores, colunas, constraints, índices e trigger de pacientes; portanto a incompatibilidade estrutural também está presente. Não foi executado POST ou INSERT em produção; não se afirma incidente real observado.

Diferenças registradas: PostgreSQL17.6 x86_64 remoto versus aarch64 sintético; ACLs remotas incluem EXECUTE de service_role nos oito helpers comparados e de authenticated no helper interno `_effective_occurrence_patient_ids`, ausentes no replay. Esses grants não são necessários à criação comum: helpers públicos já permitem authenticated, e a chamada interna ocorre pelo proprietário postgres da função existente. Não foram acrescentados grants para o teste passar. Proprietários de funções/tabelas sintéticas foram alinhados a postgres, conferindo os grants de patients e os corpos dos helpers com os metadados remotos. Fora da nova expressão SELECT, as cinco policies relevantes coincidem.

## Validação

- Matriz pgTAP versionada: 43 assertions, com reprovação original, INSERT/RETURNING corrigidos, visibilidade anterior/posterior igual para oito perfis, administração/gestão/recepção, isolamento por organização/unidade, profissional atribuído e não atribuído, UPDATE WITH CHECK, soft delete, atomicidade de pacientes/auditoria e rollback.
- Duas rodadas previamente limitadas da suíte dirigida: 66/66 requisições em cada, API v82 baixada sem edição, identidades Auth reais e RLS ativa.
- Chrome real: 23 checks em cada rodada, sem respostas de API com erro; inclui formulário completo de paciente, persistência exata sem duplicidade, busca autorizada e viewport390px/1440px. Também preservados calendário futuro/geração legítima/roster, chamada, busca clínica, prontuário e recebimento financeiro.
- Matriz HTTP adicional: 43 verificações em cada rodada sobre criação/retorno/persistência/edição/responsável, negações por perfil/unidade/organização, dados clínicos e anexos protegidos, duplicidade e corpo inválido sem efeitos parciais. Fingerprint de dez tabelas de outros domínios preservado durante o cadastro.
- Validação adicional dirigida: 48 verificações HTTP, incluindo aplicação do rollback real, erro bruto PostgREST403/42501, ausência de paciente/auditoria parcial e reaplicação preservando os dados.
- Testes Node do contrato de pacientes: 6/6. Typecheck/lint/build/Vitest e runners visuais já aprovados não foram repetidos: nenhuma alteração frontend/API; o teste de integração é o relevante para esta migration.

Evidências locais completas em `/private/tmp/fisiofit-patient-fix-evidence/`, incluindo SQL efetivo, respostas sanitizadas, TAP, capturas, fingerprints e tentativas anteriores preservadas. Scripts auxiliares de diagnóstico ficam nesse pacote, fora do commit cirúrgico.

## Aplicação futura e rollback — proposta, não executada

1. Obter autorização específica para RLS de produção e, separadamente, para publicação frontend. Conferir SHA, definição atual da policy e histórico remoto antes de executar.
2. Aplicar somente a nova migration em transação com `lock_timeout`/`statement_timeout` definidos e janela operacional acordada. Não usar push genérico do banco ou redeploy da API. Registrar a versão pelo processo de migrations aprovado, sem falsificar histórico.
3. Conferir RLS, caráter restritivo, expressão, policies de escrita/grants e integridade das definições preservadas. Observar erros400/42501 de cadastro, latência e negações legítimas. Nenhum cadastro de teste remoto está autorizado nesta etapa.
4. Rollback explícito em `supabase/rollbacks/202610150009_patient_returning_rls.sql`: restaura a expressão anterior, sem apagar pacientes ou reverter dados clínicos. Isso também restaura o defeito conhecido; considerar esse custo antes de reverter. Manter histórico de aplicação/reversão auditável.
5. Frontend V2.2 e rollback do seu artefato continuam independentes, conforme runbook anterior. Uma publicação de frontend sozinha não corrige a incompatibilidade RLS remota.

Referências: [PostgreSQL17 CREATE POLICY](https://www.postgresql.org/docs/17/sql-createpolicy.html), [rewrite rowsecurity em17.6](https://github.com/postgres/postgres/blob/REL_17_6/src/backend/rewrite/rowsecurity.c#L258), [executor INSERT em17.6](https://github.com/postgres/postgres/blob/REL_17_6/src/backend/executor/nodeModifyTable.c#L932).
