# Cadastro e edição de pacientes e matrículas — 8 de outubro de 2026

Estado: correção local; publicação e homologação autenticada em produção pendentes.

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

Aplicar `202610080001_patient_enrollment_saving.sql` antes de publicar a API; publicar depois o portal. A API depende da RPC e o portal passa a enviar `null` nos campos opcionais do paciente. Não publicar apenas o portal contra a API antiga. Nenhum commit, push ou deploy realizado nesta tarefa.

Testes em PostgreSQL WASM não substituem homologação HTTP/browser com Supabase Auth real. Concorrência real e operação autenticada em produção não foram exercitadas. A integração de turmas usa o recurso legado `group_slots` já empregado pelo fluxo de matrículas. Decisões e trabalho local prévios da Agenda foram preservados.
