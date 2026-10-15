# Financeiro e planos — release único

Base publicada: `7f16868b9e84d712c35e81ad41a07e4f097cebe4`.
Branch: `release/financeiro-planos-20261014`.
Worktree: `/private/tmp/fisiofit-financeiro-planos-20261014`.
O commit final e os hashes ficam no `release-manifest.json` gerado após o commit.

## Comportamento entregue

- Ajuste de cobrança aberta, parcial ou quitada compara o valor devido e o recebido que foram revisados. Confere a soma dos pagamentos ativos, impede valor inferior ao recebido e registra valor anterior/novo, recebimentos, situação, ator, request ID e justificativa. Não altera pagamentos, recibos ou lançamentos.
- Uma cobrança 26600/22000 pode ser ajustada explicitamente para 22000/22000/0, com situação paga. Sem pagamento permanece pendente/vencida. Não há quitação administrativa nem pagamento fictício.
- Cobranças existentes continuam como documentos financeiros até a correção explícita. A tela identifica divergência entre cobrança e condição contratual, exibindo recebido e saldo sempre.
- `enrollment_price_terms` preserva condições por vigência. A confirmação de uma condição histórica pode coexistir com uma condição futura diferente. Alterações com mesmo preço e revisão concorrente também são rejeitadas.
- Novas cobranças consultam o contrato da matrícula e a vigência; não adotam preços mutáveis de catálogo. Legados sem snapshot precisam de confirmação individual. Não há backfill de pacientes nem correção em massa.
- Gestão de Planos apresenta Mensal/Trimestral/Semestral × 1x/2x/3x, preços informados, quantidade de aulas e disponibilidade. Reaproveita registros por duração/frequência, bloqueia duplicação e preserva contratos/histórico ao editar preço global. Nenhum plano ou preço é semeado pela migration.
- Troca de plano exige prévia do servidor e token de concorrência. Fecha a vigência da matrícula anterior, cria sucessora com o preço escolhido e cancela com auditoria apenas cobranças futuras sem recebimento. Cria novas cobranças com preço e duração do plano. Pagamentos antigos e matrícula anterior permanecem.
- Cobranças parciais/pagas futuras, cobertura desconhecida e cobertura atravessada pela vigência bloqueiam a troca com causa explícita. O usuário pode escolher uma vigência após a cobertura ou solicitar revisão financeira. Não existe estorno automático.
- A troca não atualiza turmas, horários, sessões usadas ou vínculos da Agenda. O contrato sucessor começa sem desconto/adicional; a prévia informa isso expressamente.
- Recepção precisa visualizar e editar matrículas para ajustar cobrança/contrato ou trocar plano. Não recebe acesso a pagamentos, lançamentos, catálogo global ou estornos. RLS/RPCs mantêm clínica e unidade.
- A edição comum mantém sessões e situação; mudanças comerciais usam o fluxo com prévia, evitando reescrita silenciosa de cobranças.

## Diagnóstico somente leitura

No caso informado, a consulta confirmou cobrança persistida de 26600, pagamentos ativos de 22000, saldo 4600 e desconto/adicional zero. O catálogo atual também vale 26600; a cobrança inicial da matrícula era 22000. O fluxo antigo de geração usava catálogo quando não havia snapshot contratual válido para o período. Os dados são compatíveis com essa origem; não há auditoria suficiente para afirmar o preço do catálogo na data histórica da geração.

Também existe uma condição futura diferente registrada recentemente. Ela não foi alterada. A nova operação permite confirmar a condição histórica sem sobrescrevê-la. Identificadores e dados pessoais da consulta não foram incluídos neste relatório nem na memória.

O erro genérico foi localizado em `databaseResult`: exceções contratuais não estavam mapeadas. A API agora distingue cobrança futura incompatível, matrícula inativa, conflito de revisão, falta de permissão e demais impedimentos financeiros. SQL e HTTP reproduzem e validam esses motivos. O request exato da tentativa histórica não estava disponível; não foi atribuída a ele uma exceção presumida.

## Homologação

Comando único: `node scripts/homologate-financial-plans.mjs`.

Requer a stack local sintética `secfinfinalb14` previamente identificada, schema financeiro 001–007, Docker e Deno. O runner recusa outras identidades, clona somente schema para banco descartável, restaura as RPCs predecessoras, aplica a migration 007 completa e executa os testes SQL com rollback. As funções exatas da candidata são instaladas na stack HTTP sintética; somente as fixtures criadas pelo runner são removidas ao final. Não usa credenciais de produção.

Evidências: `/private/tmp/fisiofit-plans-homologation/summary.json`, logs por etapa e `http-result.json`. Resumo versionado: `FINANCIAL-PLANS-ACCEPTANCE.json`.

- Typecheck e lint do monorepositório.
- 29 testes direcionados de frontend, incluindo nove seleções ativas, ausência de preços inventados, condições por vigência e projeções financeiras.
- 11 testes Deno de autorização e mensagens financeiras.
- 53 verificações SQL de preço, vigência, recebimentos, auditoria, permissões, isolamento e troca transacional.
- 27 requisições HTTP autenticadas contra a composição da API candidata.
- Build e bateria JavaScript obrigatória do workflow: 66 Vitest e 34 Node.
- Navegador Chrome com fixtures de interface: ajuste parcial 266/220 → 220/220/0; catálogo em três colunas; seleção de novo plano; prévia da troca com histórico preservado. A fixture de interface foi removida e não integra o release.

O `deno check` global do composition root tem 13 diagnósticos anteriores em Agenda e outros handlers, já presentes na base publicada. Eles não foram corrigidos nesta entrega para preservar o escopo. Os módulos financeiros novos passam pelo typecheck Deno direcionado; os caminhos financeiros da composição são exercitados por HTTP real local. Isso não equivale a homologação em produção de todos os domínios.

## Preparação e publicação

Após commit e aceite: `node scripts/prepare-financial-plans-release.mjs` gera pacote com manifest, migration exata, backend do commit e build local de evidência. O frontend de produção será reconstruído no workflow usando as variáveis públicas de produção; o build local sem essas variáveis não deve substituir esse artefato.

Uma única autorização de publicação deve cobrir a seguinte sequência:

1. Conferir o commit exato do manifest e o projeto `eeltguuoxpfttjznugla`. Aplicar somente `financial-007.sql`, uma transação com preflight das seis versões financeiras, DDL/RPCs e registro da versão `202610140007`. Não executar `supabase db push`.
2. Publicar a Edge Function `api` do mesmo commit, preservando `verify_jwt=false`, validação de Bearer interna e secrets existentes. Exemplo: `supabase functions deploy api --project-ref eeltguuoxpfttjznugla --no-verify-jwt --use-api` na worktree exata.
3. Executar `hostinger-build.yml` na branch do release, conferindo o SHA exato. O workflow recompila com os secrets públicos e publica os artefatos na branch da Hostinger.
4. Conferir migration no histórico, health da API, hashes públicos e telas autorizadas. Correções de pacientes reais permanecem operações individuais revisadas na interface, após a publicação.

A migration não inclui DDL da Agenda. O checkout operacional e a worktree Agenda V2 não integram este pacote.

## Recuperação

Se o backend ou frontend falhar antes da liberação, interromper a sequência e republicar API/frontend da base. A migration é aditiva; não apagar histórico de condições nem reverter dados financeiros. Se já houver uso do novo fluxo, manter as proteções de contrato e recuperar por migration incremental revisada, pois a geração antiga não compreende o histórico de condições. Nenhum rollback automático de pagamentos ou pacientes está previsto.
