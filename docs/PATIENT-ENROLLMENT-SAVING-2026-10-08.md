# Cadastro e edição de pacientes e matrículas — 8 de outubro de 2026

Estado: publicado em produção; homologação autenticada de cadastro/edição com o perfil afetado permanece pendente.

## Problemas confirmados no código

- Edição de paciente misturava alterações cadastrais, plano e turma em requisições sucessivas; uma falha posterior deixava salvamento parcial.
- Campos opcionais apagados eram omitidos no PATCH e permaneciam no banco. Validações tinham mensagens genéricas e erros ficavam fora dos diálogos.
- Detalhes de pacientes podiam receber respostas de uma seleção anterior.
- Matrícula era inserida antes da validação do valor positivo; cobrança e vínculo de turma eram operações separadas.
- Deduplicação do portal reutilizava matrículas de outra unidade e estados não ativos.
- Edição de matrícula não atualizava a cobrança com a mudança de plano/período. O formulário preenchia uma data inferida como se fosse a data final persistida e excluía o plano atual inativo do seletor.

## Correção

Pacientes: POST e PATCH usam schema com mensagens em português. `null` apaga CPF, nascimento, telefone, e-mail e observações; campo ausente é preservado. Duplicidade de CPF tem mensagem específica. Edição cadastral deixa gestão de plano/turma para Matrículas/Agenda. Erros ficam visíveis dentro do formulário. Respostas antigas de detalhes são descartadas.

Matrículas: POST/PATCH usam `public.save_enrollment`. Criação salva matrícula, cobrança e turma opcional em uma transação PostgreSQL. Valor, datas, paciente, plano, unidade e acesso são verificados antes dos inserts. Repetição de criação com os mesmos parâmetros reutiliza matrícula ativa sem duplicar cobrança ou vínculo; parâmetros diferentes de uma matrícula ativa retornam conflito explícito. Há serialização de criação por clínica/paciente/unidade/plano e bloqueio da turma durante verificação de capacidade.

Edição: mudanças de plano/período recalculam a única cobrança não paga. Havendo pagamentos ou várias cobranças, a mudança comercial é recusada e nenhuma parte é gravada; sessões e situação podem ser editadas. Plano atual inativo pode ser mantido. Data final vazia vira `null`; o formulário usa a data final persistida e a data inicial corrente para validar o período.

RPC: papel, grants de visualização/edição do módulo, clínica e unidade são obrigatórios. Vínculo de turma exige também Agenda e papel compatível. Não expõe valores financeiros adicionais à recepção. `anon` não executa a RPC. Lista de campos permitidos impede alterações comerciais não suportadas via chamada direta.

## Validação

- `npm test`: 52 testes Vitest e 49 testes Node aprovados, incluindo seis novos testes executando schema e handlers reais de pacientes com dependências simuladas.
- `npm run typecheck`, `npm run lint`, `npm run build`: aprovados. Portal revalidado após o ajuste final do formulário.
- Todas as 37 migrations aplicadas em PostgreSQL WASM isolado, com Auth/Storage artificiais e bootstrap específico de produção omitido.
- pgTAP: 31 verificações novas de pacientes/matrículas aprovadas; a suíte cobre criação, edição, retry, rollback após falha da cobrança, permissões da recepção, vínculo de turma, ausência de acesso e consistência financeira. Suítes existentes: database 19, authorization 39, Agenda 267 aprovados.
- `git diff --check`: aprovado.
- `graphify update .`: executado; extração SQL indisponível por ausência de `tree_sitter_sql`.

## Publicação e limites

Aplicar `202610080001_patient_enrollment_saving.sql` antes de publicar a API; publicar depois o portal. A API depende da RPC e o portal passa a enviar `null` nos campos opcionais do paciente. Não publicar apenas o portal contra a API antiga. Publicação autorizada pelo usuário e concluída em 8 de outubro de 2026, conforme evidências abaixo.

Testes em PostgreSQL WASM não substituem homologação HTTP/browser com Supabase Auth real. Concorrência real e operação autenticada em produção não foram exercitadas. A integração de turmas usa o recurso legado `group_slots` já empregado pelo fluxo de matrículas. Decisões e trabalho local prévios da Agenda foram preservados.

## Publicação confirmada

- Commits de implementação/testes: `ae1ada9` e `8f654ca`, publicados em `fix/estab-009-agenda-authorization`.
- Conjunto isolado excluiu todas as alterações anteriores de autorização da Agenda; `202610050002` continua fora do banco remoto.
- Dry-run listou somente `202610080001_patient_enrollment_saving.sql`; aplicação e histórico remoto confirmados.
- RPC existente: `authenticated` pode executar, `anon` não pode executar, verificado no banco remoto.
- API `api` versão **76**, `ACTIVE`. `verify_jwt=false` foi preservado conforme configuração anterior da versão 75 e do repositório; middleware privado continua validando sessão com `auth.getUser`.
- Health público respondeu `healthy`; `/patients` sem sessão respondeu HTTP **401**.
- [Workflow Hostinger 37789060679](https://github.com/guilhermesantossousadev/ClinicaFisiofitSystem/actions/runs/37789060679): **success**, fonte `8f654ca26aa470501f370514adec399d93330a71`. Typecheck, lint, build e 52 testes Vitest + 34 testes Node aprovados no checkout limpo do CI.
- Branch de artefatos: `78edcb797178b5b4f08c1e4af70a90a233b1cf1a`.
- Portal público HTTP **200**; SHA-256 dos assets públicos iguais aos da branch publicada: `index-DbOjBsHo.js`, `FisiofitApp-WCQBLFE0.js`, `index-B6RfuHID.css`.
- PostgreSQL WASM com apenas as 36 migrations do commit publicado: 31 verificações novas aprovadas e reaplicação da migration bem-sucedida.

## Rollback preservado

Pacote anterior integral da Hostinger (`be062acb66a11ad5f8f09c0dea7fc6690985bccc`): `/private/tmp/fisiofit-patient-enrollment-hostinger-before.tar.gz`, SHA-256 `22baa7192840a2a7076c37a3aa2bf2a0e51e8fecfee2aad422c4026f669af0f7`. Código anterior da API no commit `c28beb8`: `/private/tmp/fisiofit-patient-enrollment-api-before.tar`, SHA-256 `16bde3618a5d21f4311191143a3d7e7fe9878d3dac8f74c62595344ed376bf38`. São backups temporários locais. Se necessário, restaurar API/portal anteriores em conjunto; a nova RPC é aditiva e pode permanecer sem chamadas. Não executar remoção de dados como rollback.

A revisão automática rejeitou inicialmente o flag `--no-verify-jwt` por interpretar mudança de segurança. A configuração remota v75 comprovou que já era `false`; reavaliação autorizou o comando preservando a configuração. Nenhuma rejeição pendente.
