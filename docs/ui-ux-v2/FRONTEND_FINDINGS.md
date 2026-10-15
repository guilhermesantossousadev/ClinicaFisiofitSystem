# Achados frontend tratados durante a UI V2

| Achado | Evidência | Correção limitada ao frontend |
|---|---|---|
| Onboarding redirecionava antes da restauração da sessão | Cenário sintético abre `set-password`, restaura sessão válida e abre onboarding: a base redireciona ao login enquanto `session` ainda é null | Aguardar `loading` do AuthProvider antes de decidir o redirecionamento. Nenhum mecanismo Auth ou endpoint modificado |
| Escolha da busca global era descartada | `chooseSearchResult` ignorava o paciente e apenas abria a listagem | Aplicar o nome escolhido ao filtro existente de pacientes, no mesmo escopo de unidade/permissão |
| Falha de busca aparecia como ausência de pacientes | Catch limpava resultados e apresentava “Nenhum paciente” | Loading e mensagem segura de erro explícitos, sem representar falha como resultado válido |
| Fieldset de dias tinha atributo ARIA incompatível | axe-core `aria-allowed-attr` | Preservar fieldset/legend/validação; retirar apenas aria-required incompatível |
| Menu lateral reduzido perdia nomes acessíveis | axe-core `button-name` no tablet | Nome explícito nos controles, preservado quando o rótulo visual é oculto |
| Lista vazia de busca possuía semântica listbox inválida | axe-core `aria-required-children` | Separar opções de resultado e mensagem de status acessível |
| Envio repetido e confirmações sem padrão | Revisão dos handlers e testes de teclado/estado | Travas síncronas nos novos caminhos compartilhados, chamada/importação/notificações; preservar idempotência financeira existente; pilha de confirmação consistente |

Não foram alterados banco, migrations, RLS, Agenda Class, regras financeiras, contratos ou permissões. O teste operacional usa banco descartável e contas locais. Nenhum registro real foi utilizado.
