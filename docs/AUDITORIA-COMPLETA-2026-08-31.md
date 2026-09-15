# Auditoria completa do Sistema de Controle Fisiofit

**Data da auditoria:** 31 de agosto de 2026

**Escopo:** site público, portal autenticado, API, banco PostgreSQL/Supabase, autenticação, armazenamento, integrações, CI/CD, UI, UX, acessibilidade e responsividade

**Natureza deste documento:** diagnóstico e plano; nenhuma correção de produto foi implementada

**Branch examinada:** `agent/fix-auth-production` (sincronizada com `origin/agent/fix-auth-production`)
**Estado do Git:** worktree inicialmente limpo; ao final, apenas este relatório foi adicionado como arquivo não rastreado. Nenhuma alteração preexistente foi descartada ou sobrescrita

## 1. Resumo executivo

O sistema tem uma base arquitetural coerente e várias defesas importantes já implementadas: autenticação centralizada no Supabase, API com validação Zod, autorização por papel e módulo, RLS no banco, escopo por clínica/unidade, operações financeiras críticas em RPC transacional, trilha de auditoria, CSP e cabeçalhos de segurança, consentimento de cookies equilibrado e componentes de modal com controle de foco. Typecheck, lint, testes e os dois builds passam. Todas as 23 migrações locais estão aplicadas no banco remoto e o `supabase db lint --linked --level warning` não encontrou erros de esquema.

Apesar dessa boa fundação, o sistema ainda não deve ser considerado pronto para operação financeira e clínica sem uma rodada de correções. O achado mais grave é a divergência entre o valor total apresentado para planos trimestrais/semestrais e o valor efetivamente cobrado: a interface multiplica o preço pelos meses, enquanto a API gera a cobrança usando apenas `price_cents`. Isso pode produzir subcobrança sistemática. Também é possível marcar uma cobrança como paga sem registrar recebimento; trocar o plano de uma matrícula sem recalcular sua cobrança; e executar operações compostas que terminam parcialmente.

Os fluxos de anexos, importação, privacidade e fechamento financeiro estão incompletos na interface. Há risco de exibição temporária dos dados do paciente anteriormente aberto, limites silenciosos de 100/500 registros, controle de permissões configurável em estado contraditório, ausência de MFA para dados clínicos e financeiros e cobertura automatizada insuficiente para as regras mais críticas.

### Distribuição dos achados

| Severidade | Quantidade | Leitura executiva |
|---|---:|---|
| Crítico | 1 | Divergência de cálculo com potencial de perda financeira sistêmica |
| Alto | 21 | Integridade financeira/clínica, atomicidade, segurança e fluxos essenciais incompletos |
| Médio | 15 | Acessibilidade, navegação, escala, responsividade, feedback e manutenção |
| Baixo | 3 | Refinamentos de conteúdo, SEO e consistência |
| **Total** | **40** | Inclui defeitos, riscos confirmados e oportunidades claramente identificadas |

### Cinco prioridades imediatas

1. Unificar a regra de preço total e geração de cobrança de planos; criar testes de contrato para mensal, trimestral e semestral.
2. Proibir `status=paid` fora do fluxo transacional de pagamentos e reconciliar dados já existentes.
3. Tornar atômicos matrícula + cobrança + turma, edição paciente + plano + turma e atualização de usuário + unidades + permissões.
4. Corrigir anexos (confirmação pós-upload, download, exclusão, MIME e auditoria) e a troca de detalhes entre pacientes.
5. Fechar a matriz de autorização: `can_edit` deve implicar `can_view`, frontend deve falhar fechado e MFA/step-up devem ser decididos antes de produção plena.

## 2. Metodologia, evidências e limitações

### Verificações executadas

| Verificação | Resultado |
|---|---|
| `git status --short --branch` | Limpo antes e depois da auditoria |
| `npm run typecheck` | Aprovado |
| `npm run lint` | Aprovado |
| `npm test` | Aprovado: 4 arquivos, 24 testes Vitest, mais 13 testes de plataforma |
| `npm run build` | Aprovado para site e portal |
| `npm audit --offline --omit=dev` | Nenhuma vulnerabilidade presente no cache local |
| `npm audit --omit=dev` online | Inconclusivo: timeout no registro npm |
| Migrações Supabase remotas | 23/23 migrações locais presentes remotamente |
| `supabase db lint --linked --level warning` | Nenhum erro de esquema |
| Testes pgTAP locais | Não executados: Docker indisponível |
| `deno check` da Edge Function | Inconclusivo: resolução/download de dependências não terminou |
| Site em `localhost:8080` | HTTP 200 confirmado para raiz e fallback SPA |
| Portal Fisiofit em `localhost:3001/sistema/` | HTTP 200 confirmado; porta 3000 estava ocupada por outro projeto (“Jana Modas”) |
| Navegação visual automatizada | Bloqueada por incompatibilidade do conector: cliente 26.818 apontava para serviço inexistente enquanto o plugin instalado era 26.825 |

### Consequência das limitações

Não foram geradas capturas confiáveis nem executados testes reais de clique, teclado, leitor de tela, console e rede nos breakpoints. Portanto, este relatório não afirma que esses aspectos “passaram”. Achados visuais e de interação são marcados como inspeção de código ou risco a validar. Também não foram utilizados dados reais, não foram enviados WhatsApps/e-mails, não houve cobrança, exclusão, upload ou acionamento do Notion.

### Status de validação usado

- **Execução:** confirmado por comando ou resposta HTTP.
- **Código:** comportamento determinado diretamente pelo caminho executável do código.
- **Banco remoto:** presença/aplicação do esquema confirmada no projeto vinculado, sem leitura de dados pessoais.
- **Risco provável:** conclusão lógica forte, mas que requer sessão/dados reais ou navegador funcional.
- **Oportunidade:** melhoria de produto/design, não necessariamente defeito.

## 3. Arquitetura, tecnologias e módulos

### Topologia

| Camada | Implementação | Responsabilidade |
|---|---|---|
| Site público | React 18, Vite 8, Wouter, Tailwind, Lucide | Marketing, serviços, unidades, contato, privacidade e cookies |
| Portal | React 18, Vite 8, Wouter, CSS próprio, Supabase JS, Zod | Operação clínica, agenda, pacientes, prontuários, planos, financeiro e administração |
| Contratos | `packages/contracts` | Tipos, envelopes, schemas e política de privacidade compartilhada |
| Design system | `packages/design-system` | Variáveis de marca e base path do portal |
| API | Deno Edge Function, Hono, Zod | REST `/functions/v1/api/v1`, autenticação, autorização, validação e auditoria |
| Persistência | Supabase PostgreSQL 17 | Tabelas relacionais, RLS, views e RPCs transacionais |
| Arquivos | Supabase Storage | `clinical-files`, `financial-files` e `profile-avatars` |
| Publicação | GitHub Actions + Hostinger | Build estático consolidado e branch `hostinger-deploy` |

### Segurança e autorização

- E-mail/senha pelo Supabase Auth; cadastro público desativado.
- Convite e recuperação com redirect PKCE para `/sistema/set-password`.
- Papéis: `admin`, `manager`, `reception`, `professional`, `finance`.
- Permissões por módulo em `profile_permissions` (`can_view`, `can_edit`).
- Escopo por clínica e por unidades vinculadas.
- Profissional vinculado a um registro `professionals` e restrito às próprias agendas/prontuários por API/RLS.
- MFA TOTP explicitamente desativado em `supabase/config.toml` e removido por migração.
- CSP, HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy` e `Permissions-Policy` na publicação Hostinger.

### Modelo de dados

Os principais domínios são:

- Organização: `clinics`, `units`, `rooms`, `profiles`, `profile_units`, `profile_permissions`.
- Clínica: `professionals`, `professional_units`, `patients`, `responsibles`, `consents`, `services`.
- Operação: `plans`, `enrollments`, `group_slots`, `group_slot_memberships`, `appointments`, `class_attendances`.
- Prontuário: `record_templates`, `clinical_records`, `attachments`.
- Financeiro: `charges`, `payments`, `financial_entries`, `commissions`, `monthly_closings`, `fiscal_documents`.
- Governança: `notifications`, `import_batches`, `migration_items`, `idempotency_keys`, `audit_events`, `data_subject_requests`, `privacy_incidents`.

## 4. Mapa completo de páginas, rotas e integrações

### Site público

| Rota | Entrada | Objetivo | Principais ações/saídas | Estado auditado |
|---|---|---|---|---|
| `/` | URL, logo, menu | Apresentar proposta e serviços | Contato, serviços, sobre | Código + HTTP |
| `/sobre` | Menu/rodapé | História, valores e diferenciais | Contato | Código + HTTP |
| `/servicos` | Menu/cards | Pilates, fisioterapia e reabilitação | Âncoras e contato | Código + HTTP |
| `/unidades` | Menu/rodapé | Endereços, horários e telefone | `tel:` e Google Maps | Código + HTTP |
| `/contato` | CTA/menu | Preparar solicitação | WhatsApp externo | Código; envio não acionado |
| `/links` | Rodapé/URL social | Link-in-bio | WhatsApp, Instagram, Maps | Código |
| `/privacidade` | Rodapé/formulário | Política de privacidade | E-mail da controladora | Código |
| `/cookies` | Rodapé/banner | Política e preferências | Reabrir diálogo | Código |
| fallback 404 | URL inexistente | Recuperação | Voltar ao início | Código + HTTP 200 (soft 404) |

Componentes transversais: header desktop/mobile, rodapé, skip link, CTA band, metadados SEO e diálogo de cookies. O consentimento bloqueia Google Ads e Google Fonts até decisão positiva.

### Portal autenticado

Rotas URL reais:

| Rota | Acesso | Objetivo |
|---|---|---|
| `/sistema/login` | Público | Login e solicitação de redefinição |
| `/sistema/set-password` | Callback de convite/recuperação | Definir senha |
| `/sistema/onboarding` | Primeiro usuário quando bootstrap disponível | Criar clínica e administrador |
| `/sistema/*` | Protegido | Shell da aplicação |

Os módulos abaixo não têm rotas próprias; são estados internos persistidos em `localStorage`:

| Módulo | Admin | Gestor | Recepção | Profissional | Financeiro |
|---|:---:|:---:|:---:|:---:|:---:|
| Painel | E | E | — | — | — |
| Agenda | E | E | E | E própria | — |
| Chamada diária | E | E | E | E própria | — |
| Pacientes | E | E | E | **permissão/API, mas sem item de menu** | — |
| Matrículas | E | E | E sem financeiro | — | V |
| Prontuários | E | E | — | E próprios | — |
| Financeiro | E | E | — | — | E |
| Relatórios | E | V | — | — | V |
| Importações | E | E | — | — | — |
| Usuários | E | V | — | — | — |
| Configurações | E | E (exceto unidade/exclusão) | — | — | — |
| Privacidade | E | E solicitações/auditoria | — | — | — |
| Meu perfil | E | E | E | E | E |

Legenda: E = edição conforme permissões; V = visualização; — = sem acesso padrão.

### Integrações

| Integração | Uso | Reversibilidade/observação |
|---|---|---|
| Supabase Auth | Login, convite, recuperação, senha e sessão | Não foram criados/alterados usuários |
| Supabase Database | Dados operacionais e RLS | Esquema remoto verificado sem ler PII |
| Supabase Storage | Anexos clínicos e avatares | Fluxo de anexo incompleto; nenhum upload realizado |
| Notion | Importação direta de fontes com IDs fixos | Não acionada; depende de `NOTION_TOKEN` |
| WhatsApp/Meta | Contato público | Não acionado |
| Google Ads/Fonts | Medição/fonte após consentimento | Código auditado; chamadas não acionadas |
| Google Maps/Instagram | Links públicos externos | Não acionados |
| Hostinger/GitHub Actions | Publicação | Configuração auditada; nenhum deploy realizado |
| Fiscal/notificações | Apenas tabelas e GETs | Sem adaptador operacional ou UI completa |

## 5. Mapa dos principais fluxos por perfil

### Administrador

Configura clínica/unidades/equipe, convida e administra usuários, opera todos os módulos, registra incidentes, consulta auditoria, importa dados e controla financeiro. É o único papel com bypass total de `profile_permissions` e proteção de conta proprietária.

### Gestor

Opera agenda, pacientes, matrículas, prontuários, financeiro, configurações e privacidade. Consulta usuários e relatórios. Não convida, bloqueia ou exclui usuários; não cria/exclui unidades; não vê incidentes.

### Recepção

Opera agenda, chamada, pacientes e matrículas. A documentação afirma acesso ao Painel e possibilidade de recebimento, mas o código atual não concede `dashboard` nem `finance`, e a UI oculta cobranças/pagamentos. É necessária decisão de produto e atualização documental.

### Profissional

Consulta e altera a própria agenda/chamada, lê pacientes por API/permissão e cria/assina/retifica os próprios prontuários. O módulo Pacientes não aparece no menu apesar da permissão padrão; os pacientes são acessados indiretamente pelos seletores de Agenda/Prontuário.

### Financeiro

Consulta matrículas sem editar por padrão, registra pagamentos e movimentos, aprova comissões e consulta relatórios. Endpoints de estorno, fechamento e reabertura existem, mas não há interface para executá-los.

## 6. Matriz de páginas versus funcionalidades

| Área | Consulta | Busca/filtro | Criar | Editar | Inativar/excluir | Exportar/imprimir | Estado vazio/erro |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Site público | ✓ | — | Contato | — | — | — | 404 |
| Painel | ✓ | Unidade | — | — | — | — | Parcial |
| Agenda | ✓ | Unidade/semana | ✓ | ✓ | ✓ | — | ✓ |
| Chamada | ✓ | Unidade/data/turma | Presença | Reposição | — | — | ✓ |
| Pacientes | ✓ | Servidor/paginação | ✓ | ✓ | ✓ | — | ✓ |
| Matrículas | ✓ | Cliente/unidade/status | ✓ | ✓ | Reversão | — | ✓ |
| Prontuários | ✓ | Seletor limitado | ✓ | Retificação | — | — | ✓ |
| Financeiro | ✓ | Mês/unidade global | ✓ | API órfã | ✓ movimento | — | ✓ |
| Relatórios | ✓ | Ano/unidade global | — | — | — | CSV/print | ✓ |
| Importações | ✓ | — | CSV/Notion | — | Reversão | — | Parcial |
| Usuários | ✓ | — | Convite | ✓ | Bloqueio/exclusão | — | ✓ |
| Configurações | ✓ | Abas | ✓ | ✓ | Inativar/excluir | — | ✓ |
| Privacidade | ✓ | — | Solicitação/incidente | API órfã p/ solicitação | — | — | ✓ |

## 7. Inventário de ações e formulários

### Site público

- Navegação: Início, Sobre, Serviços, Unidades, Contato, Área da clínica e CTA de agendamento.
- Home: “Agendar minha avaliação”, “Conhecer tratamentos”, três “Saiba mais”, “Conheça a Fisiofit” e CTA final.
- Unidades: telefone e Google Maps por unidade.
- Contato: nome, WhatsApp, unidade, serviço e mensagem; gera texto e abre WhatsApp.
- Links: quatro links externos e voltar ao site.
- Cookies: aceitar, recusar, configurar, checkbox de publicidade/fonte, salvar, fechar e política.

### Portal

- Login: e-mail, senha, entrar, solicitar/reenviar redefinição, trocar e-mail e suporte.
- Onboarding: nome da clínica e nome do administrador.
- Senha: nova senha, confirmação e conclusão.
- Shell: menu, menu móvel, recolher sidebar, busca global, unidade ativa, perfil, avatar e logout.
- Agenda: semana anterior/próxima/hoje; criar turma; criar grade; agendar/bloquear; abrir, editar, confirmar, iniciar, faltar, cancelar e concluir; adicionar/remover aluno; editar/excluir turma.
- Chamada: unidade, data, horário; veio/faltou; reposição realizada/dispensada.
- Pacientes: busca, paginação, criar, editar, inativar, excluir, detalhes, consentimentos e responsável.
- Matrículas: criar/editar/inativar/excluir plano; matricular; filtro do controle; editar uso/status; alterar status de cobrança; receber; reverter matrícula.
- Prontuários: paciente; criar avaliação/evolução; anexar; assinar; retificar.
- Financeiro: novo movimento, excluir movimento, nova comissão e aprovar comissão.
- Relatórios: ano, exportar CSV e imprimir/gerar PDF.
- Importações: unidade/origem/arquivo/tipo; pré-validar/importar CSV; validar/importar Notion; reverter lote.
- Usuários: convidar; editar nome/papel/status/unidades/permissões; ativar, bloquear, reenviar acesso, definir senha e excluir.
- Configurações: abas Unidades, Salas, Serviços, Profissionais e Modelos; CRUD conforme papel.
- Privacidade: criar solicitação; criar incidente (admin); listar solicitações, incidentes e auditoria.

## 8. Achados funcionais e técnicos prioritários

### FIS-001 — Total exibido e cobrança de planos divergem

- **Validação:** código; crítico.
- **Fluxo:** Matrículas > Novo plano > período trimestral/semestral > matricular paciente.
- **Perfis:** admin, gestor; impacto financeiro sobre pacientes e clínica.
- **Esperado:** valor apresentado como total e cobrança gerada usam a mesma regra.
- **Observado:** `planTotalCents` multiplica `price_cents` por meses (`OperationalShared.tsx:77`), mas a API cria cobrança usando somente `plan.price_cents` (`supabase/functions/api/index.ts:519`). Ex.: R$100 trimestral aparece como R$300 e gera cobrança de R$100.
- **Impacto:** subcobrança, divergência de contrato e relatório, perda de receita.
- **Recomendação:** definir explicitamente se o campo é preço mensal ou total; calcular uma única vez no domínio/backend; persistir preço contratado na matrícula; testar todos os períodos/descontos/acréscimos.
- **Esforço:** médio; exige decisão de produto e possível reconciliação.

### FIS-002 — Cobrança pode ser marcada paga sem recebimento

- **Validação:** código; alto.
- **Fluxo:** Matrículas > Controle de planos > Situação do pagamento.
- **Observado:** a UI envia `PATCH /charges/:id/status` e a API aceita `paid` sem alterar `paid_cents`, criar `payment` ou `financial_entry` (`OperationalEnrollments.tsx:138`; `api/index.ts:610`). A própria UI admite “pago; recebimento ainda não lançado”.
- **Impacto:** inadimplência e caixa ficam contraditórios; relatórios e auditoria perdem confiabilidade.
- **Recomendação:** remover `paid` do endpoint manual; pagamento apenas pela RPC `register_payment`; reservar status manual para cancelamento/vencimento com regras; criar reconciliação.
- **Esforço:** médio.

### FIS-003 — Troca de plano não recalcula cobrança existente

- **Validação:** código; alto.
- **Fluxo:** Pacientes > Editar > Plano atual ou API `PATCH /enrollments/:id`.
- **Observado:** a matrícula recebe novo `plan_id`, mas a cobrança vinculada mantém descrição e valor do plano anterior (`api/index.ts:538-574`).
- **Impacto:** cobrança incorreta após alteração comercial.
- **Recomendação:** criar operação transacional de mudança de plano com política para cobrança pendente/parcial/paga e registro de diferença.
- **Esforço:** grande; decisão de produto.

### FIS-004 — Matrícula e vínculo de turma não são atômicos

- **Validação:** código; alto.
- **Fluxo:** Matrículas > Nova matrícula com turma.
- **Observado:** cria matrícula/cobrança e só depois chama `/group-slots/:id/members` (`OperationalEnrollments.tsx:58-75`). Falha na segunda chamada deixa matrícula sem turma.
- **Impacto:** usuário recebe erro após parte da operação ter sido salva e pode repetir/cobrar em duplicidade.
- **Recomendação:** uma RPC/endpoint único para matrícula, cobrança e vínculo, com idempotência e rollback integral.
- **Esforço:** médio.

### FIS-005 — Edição de paciente, plano e turma pode salvar parcialmente

- **Validação:** código; alto.
- **Fluxo:** Pacientes > Editar.
- **Observado:** atualiza paciente, depois matrícula, depois membership em requisições separadas (`OperationalPatients.tsx:133-169`).
- **Impacto:** mudança de unidade/dados pode ser salva mesmo se plano/turma falhar; interface reporta erro sem explicar o que persistiu.
- **Recomendação:** separar operações na UI ou criar comando transacional explícito; apresentar resumo antes de confirmar.
- **Esforço:** grande.

### FIS-006 — Detalhe pode exibir dados do paciente anterior durante carregamento

- **Validação:** código; alto.
- **Fluxo:** abrir detalhes de A, fechar e abrir B.
- **Observado:** `setSelected(row)` ocorre antes de limpar `detail`; responsáveis/consentimentos/timeline de A permanecem até as requisições de B terminarem (`OperationalPatients.tsx:68-91`). Respostas fora de ordem também não são descartadas.
- **Impacto:** exposição de dados pessoais no contexto errado e risco de decisão operacional incorreta.
- **Recomendação:** limpar dados antes de abrir, exibir skeleton vinculado ao ID e versionar/cancelar requisições.
- **Esforço:** pequeno.

### FIS-007 — Importação CSV ignora origem e unidade escolhidas

- **Validação:** código; alto.
- **Fluxo:** Importações > selecionar origem/unidade > CSV.
- **Observado:** `source` e `unit_id` existem no formulário, mas `run()` envia apenas arquivo, dry-run e sheets (`OperationalImports.tsx:102-112`); backend chama RPC com `p_unit_id: null` (`routes/importacoes.ts:148`).
- **Impacto:** promessa da interface não corresponde ao destino aplicado; linhas podem falhar ou depender de IDs no próprio CSV.
- **Recomendação:** enviar e validar origem/unidade; aplicar unidade somente a entidades compatíveis; mostrar mapeamento final por coluna.
- **Esforço:** médio.

### FIS-008 — Pré-validação pode ficar obsoleta

- **Validação:** código; alto.
- **Fluxo:** pré-validar CSV/Notion, mudar tipo ou unidade e importar.
- **Observado:** mudar `entity` não limpa `preview`; mudar unidade não invalida `notionValidated`; os estados de preview CSV e Notion são compartilhados.
- **Impacto:** importação final pode não corresponder ao cenário pré-validado.
- **Recomendação:** hash do payload validado; invalidar ao alterar qualquer entrada; backend exigir token de preview ou repetir validação no commit.
- **Esforço:** médio.

### FIS-009 — Anexos são gravados antes do upload e não podem ser usados pela UI

- **Validação:** código; alto.
- **Fluxo:** Prontuários > Anexos.
- **Observado:** API insere metadado ao emitir URL, antes de o cliente concluir o upload (`routes/prontuarios.ts:27-38`); falha deixa registro fantasma. A tela apenas lista nome/tamanho, sem abrir, baixar ou excluir, apesar de existir DELETE. Exclusão remove storage antes de confirmar soft delete. UI aceita HEIC/HEIF, API rejeita esses MIME types (`OperationalRecords.tsx:188`; API:31).
- **Impacto:** prontuário contém documentos inacessíveis/fantasmas e operações não atômicas.
- **Recomendação:** fluxo prepare/finalize; confirmar objeto antes de inserir/ativar metadado; download assinado, exclusão e auditoria; MIME único.
- **Esforço:** grande.

### FIS-010 — Convite e edição de usuários não são atômicos

- **Validação:** código; alto.
- **Fluxo:** Usuários > Convidar/Editar.
- **Observado:** convite cria Auth, profile, unidades e permissões sequencialmente; atualização altera profile, apaga/reinsere unidades e faz upsert de permissões em passos independentes (`routes/usuarios.ts:7-47`, `162-211`).
- **Impacto:** conta órfã, perfil incompleto, perda temporária de unidades ou combinação de papel/permissões inconsistente.
- **Recomendação:** validar todas as unidades/módulos antes; RPC para dados internos; compensação explícita para Auth; idempotência.
- **Esforço:** grande.

### FIS-011 — `editar` pode ser concedido sem `visualizar`

- **Validação:** código; alto.
- **Fluxo:** Usuários > Editar permissões.
- **Observado:** checkboxes são independentes e backend aceita `{canView:false, canEdit:true}`, embora a interface diga “Editar inclui visualizar” (`OperationalUsers.tsx:271`; `routes/usuarios.ts:168-172`). GET será negado, mutação poderá ser autorizada.
- **Impacto:** política contraditória, UI escondida e capacidade de alteração por chamada direta.
- **Recomendação:** normalizar no cliente, API e constraint/RPC: `can_edit => can_view`.
- **Esforço:** pequeno.

### FIS-012 — Frontend falha aberto quando permissões não vêm na resposta

- **Validação:** código; alto.
- **Fluxo:** carregamento do shell.
- **Observado:** `canViewModule`/`canEditModule` retornam verdadeiro para não-admin se `profile_permissions` estiver ausente (`FisiofitApp.tsx:44-50`); servidor falha fechado.
- **Impacto:** menus/ações enganosos e tentativas bloqueadas só após envio.
- **Recomendação:** ausência significa negar; estado de permissão deve ser obrigatório e tipado.
- **Esforço:** pequeno.

### FIS-013 — Datas de agenda dependem do fuso do dispositivo

- **Validação:** código; alto.
- **Fluxo:** criar/editar agendamento em dispositivo fora de São Paulo.
- **Observado:** `datetime-local` é convertido por `new Date(raw).toISOString()` (`OperationalShared.tsx:83`), usando o fuso do navegador, embora a operação da clínica use `America/Sao_Paulo`.
- **Impacto:** horário salvo deslocado para usuários/dispositivos em outro fuso.
- **Recomendação:** converter explicitamente no fuso da clínica no backend; transportar local datetime + timezone; testar DST/políticas futuras.
- **Esforço:** médio.

### FIS-014 — Seletores e busca global cobrem no máximo 100 pacientes

- **Validação:** código; alto.
- **Fluxo:** Agenda, Matrículas, Prontuários e busca global.
- **Observado:** módulos carregam `/patients?page=1&pageSize=100`; busca global filtra apenas esse array. PatientPicker consulta no máximo 100 resultados.
- **Impacto:** pacientes além dos primeiros 100 podem não ser encontrados/selecionados, especialmente no Prontuário.
- **Recomendação:** autocomplete exclusivamente server-side, paginado e abortável; busca global deve abrir o ID selecionado.
- **Esforço:** médio.

### FIS-015 — Fechamento financeiro não bloqueia alterações e não tem UI

- **Validação:** código; alto.
- **Fluxo:** endpoints `/closings` e lançamentos/pagamentos.
- **Observado:** fechamento grava snapshot/versionamento, mas criação/edição/exclusão de movimentos e pagamentos não consultam mês fechado. Nenhuma tela cria, consulta ou reabre fechamento.
- **Impacto:** o “fechamento” não garante imutabilidade contábil; snapshot diverge do razão posterior.
- **Recomendação:** decidir semântica; se fechamento contábil, bloquear mutações ou exigir reabertura; entregar UI e testes concorrentes.
- **Esforço:** grande.

### FIS-016 — Assinatura/retificação clínica têm proteção insuficiente

- **Validação:** código; alto.
- **Fluxo:** Prontuário > Assinar/Retificar.
- **Observado:** assinatura irreversível não pede confirmação; retificação usa dois `prompt()` e envia apenas `{text}`, descartando a estrutura rica da avaliação/evolução no novo registro (`OperationalRecords.tsx:89-115`).
- **Impacto:** assinatura acidental e retificação incompleta de documento clínico.
- **Recomendação:** diálogo dedicado com revisão, confirmação e motivo; formulário pré-preenchido com payload original; step-up para assinatura se exigido.
- **Esforço:** médio.

## 9. UI, UX, acessibilidade e responsividade

### FIS-017 — Tabelas visuais não possuem semântica de tabela/lista

- **Validação:** código; médio.
- `EditableOperationalTable`, `OperationalTable` e tabelas específicas usam `div`; cabeçalhos são `aria-hidden`, sem associação célula-coluna (`OperationalShared.tsx:720-850`).
- Leitor de tela recebe uma sequência de textos e botões sem estrutura.
- **Recomendação:** `<table>` para dados tabulares; cards/listas semânticas no mobile; caption, `th scope`, nomes de ação contextualizados.
- **Esforço:** médio e sistêmico.

### FIS-018 — Indicadores globais de foco têm contraste insuficiente

- **Validação:** código + cálculo; médio.
- Site: azul a 35% sobre branco resulta aproximadamente 1,54:1; portal: `#e8a83e` sobre branco, 2,08:1. Ambos ficam abaixo de 3:1 para componente/indicador.
- Evidência: `apps/site/.../index.css:41`; `portal-enhancements.css:2337`.
- **Recomendação:** anel opaco de alto contraste, preferencialmente duplo para múltiplos fundos.
- **Esforço:** pequeno.

### FIS-019 — PatientPicker tem corrida assíncrona e estado ARIA incoerente

- **Validação:** código; médio.
- Requisições não são canceladas/versionadas; resposta antiga pode substituir busca nova. Popup vazio pode estar visível com `aria-expanded=false`; não fecha ao perder foco (`OperationalShared.tsx:245-374`).
- **Recomendação:** AbortController/request ID, controlar blur relacionado, manter `aria-expanded` coerente e anunciar carregando/sem resultados.
- **Esforço:** pequeno.

### FIS-020 — Módulos internos não têm URL/deep link

- **Validação:** código; médio.
- Back/forward não percorrem módulos; links não podem ser compartilhados; refresh depende de `localStorage` e não da URL.
- **Recomendação:** rotas `/sistema/agenda`, `/pacientes/:id`, etc., preservando filtros em query string.
- **Esforço:** grande.

### FIS-021 — Escolher resultado da busca global ignora o paciente

- **Validação:** código; médio.
- `chooseSearchResult(_patient)` apenas navega para Pacientes e limpa a busca (`FisiofitApp.tsx:239`).
- **Impacto:** seleção específica não abre nem filtra o cadastro escolhido.
- **Recomendação:** rota/estado com `patientId` e abertura direta do detalhe.
- **Esforço:** pequeno após rotas; médio isoladamente.

### FIS-022 — Busca global aparece para perfis sem acesso a pacientes

- **Validação:** código; médio.
- Financeiro e outros perfis podem ver a caixa, mas não carregam pacientes; qualquer busca retorna vazio.
- **Recomendação:** ocultar conforme permissão ou ampliar propósito com resultados autorizados.
- **Esforço:** pequeno.

### FIS-023 — Ações rápidas do Painel não iniciam a ação prometida

- **Validação:** código; baixo.
- “Novo paciente” e “Novo agendamento” apenas trocam de módulo; exigem outro clique.
- **Recomendação:** abrir drawer correspondente ou renomear para “Abrir pacientes/agenda”.
- **Esforço:** pequeno.

### FIS-024 — Grade de dias não permite sábado/domingo e pode apagar dados existentes

- **Validação:** código; alto.
- `WeekdayCheckboxGroup` só renderiza segunda–sexta, enquanto banco/API aceitam 0–6. Ao editar turma antiga com fim de semana, o valor não tem controle visível e pode desaparecer no submit (`FormPrimitives.tsx:104-171`).
- **Recomendação:** renderizar os sete dias e preservar valores; regra de dias úteis deve ser configuração de produto, não ausência estrutural.
- **Esforço:** pequeno.

### FIS-025 — Capacidade de turma não considera vigências ao adicionar membro

- **Validação:** código; médio.
- UI calcula lotação na data selecionada; API conta todos os memberships ativos, mesmo com períodos não sobrepostos (`routes/agenda.ts:560-635`).
- **Impacto:** vaga exibida pode ser rejeitada; reutilização histórica da capacidade fica bloqueada.
- **Recomendação:** contar intervalos sobrepostos ao vínculo solicitado e aplicar mesma função no frontend/backend.
- **Esforço:** médio.

### FIS-026 — Modelos clínicos são uma affordance sem comportamento

- **Validação:** código; alto.
- Modelo é criado com `schema:{}`; formulário clínico é hardcoded e selecionar modelo apenas salva seu ID (`OperationalAdministration.tsx:91`; `OperationalRecords.tsx:142-184`).
- **Impacto:** usuário administra “modelos” que não alteram o prontuário.
- **Recomendação:** ocultar até implementação ou entregar construtor/versionamento/renderização de schema.
- **Esforço:** grande; decisão de produto.

### FIS-027 — Responsáveis e consentimentos não mostram o estado necessário

- **Validação:** código; médio.
- Responsáveis são carregados mas não listados. Consentimentos mostram apenas quantidade, sem estado atual, data, finalidade ou origem; ações imediatas não têm confirmação/busy.
- **Impacto:** duplicidade e decisões de contato sem evidência visível.
- **Recomendação:** timeline por finalidade, estado vigente, autor/data e lista/edit de responsáveis.
- **Esforço:** médio.

### FIS-028 — Solicitações LGPD não podem ser concluídas pela interface

- **Validação:** código; alto.
- API tem `PATCH /privacy/requests/:id`, mas UI apenas cria/lista. Incidentes também só criam/listam; auditoria mostra UUID do usuário e pouca contextualização.
- **Impacto:** workflow regulatório fica sem responsável, atualização, evidência de atendimento ou conclusão.
- **Recomendação:** detalhe com status, prazo, responsável, notas/evidências, exportação e trilha legível.
- **Esforço:** grande.

### FIS-029 — Formulário de contato aceita telefone arbitrário e depende de popup

- **Validação:** código; médio.
- `required type=tel` sem pattern/máscara; `window.open` não verifica bloqueio. Não há confirmação de que WhatsApp abriu.
- **Recomendação:** validação brasileira tolerante, alternativa link normal, feedback e preservação dos campos.
- **Esforço:** pequeno.

### FIS-030 — Links externos não avisam mudança de contexto

- **Validação:** código; baixo.
- Maps, Instagram, WhatsApp e link hub abrem nova aba sem texto acessível indicando isso.
- **Recomendação:** incluir “abre em nova aba” no nome acessível/visível quando útil.
- **Esforço:** pequeno.

### FIS-031 — Menu móvel do site bloqueia scroll sem se comportar como diálogo

- **Validação:** código; risco provável, médio.
- Foco inicial e Escape existem, mas Tab não é contido; body fica bloqueado e conteúdo atrás segue alcançável.
- **Recomendação:** ou não tratar como overlay/bloquear body, ou implementar disclosure/dialog completo com foco contido e `inert` no restante.
- **Esforço:** pequeno.

### FIS-032 — Ausência de validação visual real nos breakpoints

- **Validação:** limitação, não defeito; status pendente.
- CSS contém breakpoints 600/640/680/720/850/1050 e layouts alternativos, mas o conector impossibilitou medir 360, 768, 1024 e 1440 px.
- **Recomendação:** executar matriz manual/Playwright quando o conector for corrigido, incluindo zoom 200/400%, teclado e textos longos.
- **Esforço:** pequeno para teste; correções desconhecidas.

## 10. Qualidade técnica, desempenho e design system

### FIS-033 — Limites de 500 registros são silenciosos

- **Validação:** código; alto.
- `listResource` usa `.limit(500)` sem paginação/metadados (`api/index.ts:704`); módulos mostram “500 registros” como se fosse total.
- **Impacto:** dados além do limite desaparecem de cobranças, turmas, auditoria, importações e configurações.
- **Recomendação:** paginação cursor/offset padronizada, total e aviso; filtros/ordenação no servidor.
- **Esforço:** grande e sistêmico.

### FIS-034 — Mudança de unidade provoca cache incorreto/requisições duplicadas

- **Validação:** código; médio.
- `useResources` deriva cache key diretamente de `localStorage`, enquanto a unidade é gravada/emitida em effect do pai; listener pode recarregar com chave antiga e dados novos, seguido de novo fetch (`OperationalShared.tsx:95-140`).
- **Recomendação:** contexto React de unidade como dependência explícita; deduplicação e AbortController.
- **Esforço:** médio.

### FIS-035 — CSS do portal é excessivamente sobreposto

- **Validação:** código/build; médio.
- `index.css` legado minificado contém tipografia de 6–11 px; `portal-enhancements.css` tem 2.688 linhas e várias ondas de override. Build gera 131,8 kB de CSS.
- **Impacto:** especificidade, regressões responsivas e inconsistência; o estado final corrige boa parte da tipografia, mas mantém dívida alta.
- **Recomendação:** extrair tokens/componentes, remover regras mortas após regressão visual e impedir novos hex/spacing fora de tokens.
- **Esforço:** grande.

### FIS-036 — Bundle e divisão por módulo podem melhorar

- **Validação:** build; médio.
- Portal: `index` 386,54 kB (111,54 kB gzip), `FisiofitApp` 148,32 kB; só Importações é lazy entre módulos. Site: JS 254,04 kB (75,89 kB gzip); todas as páginas são eager.
- **Recomendação:** lazy por rota/módulo, especialmente papéis restritos; medir LCP/INP em produção antes/depois.
- **Esforço:** médio.

### FIS-037 — Cobertura automatizada não protege os fluxos críticos

- **Validação:** execução/configuração; alto.
- CI executa lint/tipos/build/testes JS, mas não pgTAP, migração em banco efêmero, `deno check`, E2E, axe, responsividade ou contratos financeiros. Os 24 testes Vitest se concentram em helpers.
- **Recomendação:** Supabase local no CI, testes de RPC/autorização, E2E por perfil e testes de cálculo/idempotência/atomicidade.
- **Esforço:** grande.

### FIS-038 — MFA e step-up ausentes para dados sensíveis

- **Validação:** código/configuração; risco de segurança alto.
- MFA está desativado; administrador pode definir diretamente a senha de qualquer conta ativa, inclusive proprietária, sem reautenticação/step-up (`config.toml`; `OperationalUsers.tsx:215`; `routes/usuarios.ts:80`).
- **Impacto:** comprometimento de sessão admin amplia-se para dados de saúde e financeiro.
- **Recomendação:** MFA obrigatório para admin/gestor/financeiro/profissional; reautenticação para senha, permissões, estorno, fechamento e assinatura; alertas de segurança.
- **Esforço:** grande; decisão de produto/operação.

### FIS-039 — Ações existentes na API estão órfãs

- **Validação:** código; médio.
- Sem UI: estorno de pagamento, fechamento/reabertura, relatório mensal, edição de lançamento, atualização de solicitação LGPD, exclusão/download de anexo, documentos fiscais e notificações.
- **Recomendação:** priorizar por necessidade real; remover/ocultar promessas não suportadas ou entregar interfaces completas.
- **Esforço:** varia de médio a grande.

### FIS-040 — 404 público é soft 404 e não há sitemap

- **Validação:** HTTP + código; baixo.
- URL inexistente devolveu HTTP 200 pelo fallback; metadata cria canonical da URL inválida e não aplica `noindex`. `robots.txt` existe, mas não referencia sitemap e nenhum sitemap foi encontrado.
- **Impacto:** indexação/SEO menos confiável.
- **Recomendação:** estratégia de 404 no host quando possível, `noindex` dinâmico no fallback, canonical adequado e sitemap.
- **Esforço:** pequeno/médio.

## 11. Aspectos positivos preserváveis

- RLS está habilitado e endurecido por domínio; profissional tem escopo próprio em agenda/prontuário.
- `requireRoles` combina papel e permissão de módulo e falha fechado no servidor.
- Pagamento, estorno, conclusão de atendimento, aprovação de comissão e rollback de importação têm RPCs transacionais/idempotência em pontos importantes.
- A API não devolve mensagens SQL brutas ao cliente; logs usam request ID.
- Modais principais controlam foco, Escape, retorno de foco e bloqueio de scroll.
- Form primitives têm labels, hints, `aria-describedby`, validação próxima do campo e preservação de dados.
- Agenda valida conflito de profissional/sala e capacidade na API.
- Consentimento de cookies oferece aceitar/recusar com peso semelhante, gerencia storage bloqueado e respeita redução de movimento.
- Site possui `lang=pt-BR`, landmarks, skip link, imagens com dimensões/alt e AVIF.
- Portal é `noindex,nofollow`; publicação possui CSP e demais cabeçalhos defensivos.

## 12. Inconsistências documentais e decisões de produto

1. Manuais dizem que Recepção acessa Painel e registra pagamentos; permissões e UI atuais não permitem.
2. Permissão padrão de Profissional inclui Pacientes, mas o menu não inclui o papel.
3. Manual cita estorno e fechamento, mas a interface não expõe esses endpoints.
4. “Modelos clínicos” sugere formulários configuráveis, mas schema é vazio e não usado.
5. “Fechamento” precisa ser definido: snapshot histórico ou trava contábil.
6. “Preço do plano” precisa ser definido: mensalidade base ou preço total do período.
7. Horários fixos só permitem horas cheias e segunda–sexta na UI; confirmar se é regra real.
8. Incidentes e solicitações LGPD precisam de responsáveis, SLA e estados aprovados pelo produto/jurídico.

## 13. Correções rápidas de alto impacto

| Ordem | Correção | Achados | Esforço |
|---:|---|---|---|
| 1 | Bloquear status `paid` manual e filtrar cobrança quitada/cancelada no recebimento | 002 | Pequeno |
| 2 | Limpar/versionar detalhe do paciente | 006 | Pequeno |
| 3 | Impor `can_edit => can_view` e frontend fail-closed | 011–012 | Pequeno |
| 4 | Incluir sábado/domingo e preservar dias | 024 | Pequeno |
| 5 | Corrigir foco para contraste ≥3:1 | 018 | Pequeno |
| 6 | Invalidar preview de importação em toda mudança | 008 | Pequeno |
| 7 | Ocultar busca global sem permissão e usar paciente escolhido | 021–022 | Pequeno/médio |
| 8 | Confirmar assinatura clínica e adicionar busy a ações monetárias/importação | 016 e duplicidade | Pequeno |
| 9 | Corrigir MIME aceito de anexos até o novo fluxo | 009 | Pequeno |
| 10 | Atualizar manuais conforme matriz decidida | Documentação | Pequeno |

## 14. Melhorias estruturais de médio e longo prazo

- Camada de comandos transacionais no backend para operações compostas.
- Domínio financeiro explícito: contrato de plano, parcelas, reajuste, desconto, estorno, fechamento e reconciliação.
- Rotas reais e estado serializável no portal.
- Data grid semântico, paginado e filtrado no servidor.
- Autocomplete único de pacientes, abortável e com seleção por ID.
- Prontuário configurável/versionado, assinatura com step-up e anexos íntegros.
- Workflow de LGPD com SLA, responsável, evidência e exportação.
- Design system consolidado e remoção do CSS legado.
- Testes E2E por papel/dispositivo, axe e banco efêmero no CI.
- Observabilidade: métricas de erro/latência, tracing por request ID e alertas de jobs/integradores.

## 15. Plano de implementação por fases

### Fase 0 — Contenção e decisão (1–3 dias)

- Congelar criação/alteração de planos trimestrais/semestrais até definir preço.
- Consultar/reconciliar cobranças marcadas pagas sem `paid_cents` e planos com total divergente.
- Decidir matriz de papéis, fechamento, fim de semana e preço.
- Adicionar casos de regressão antes das correções.

### Fase 1 — Integridade crítica (1–2 semanas)

- Corrigir cálculo/persistência de preço contratado.
- Fechar fluxo de status/pagamento e duplicidade.
- RPC de matrícula/cobrança/turma e mudança de plano.
- Corrigir detalhe de paciente e autorização contraditória.
- Refazer anexos prepare/finalize/download/delete.

### Fase 2 — Segurança e governança (1–2 semanas)

- MFA e step-up.
- Atualização atômica de usuários/permissões.
- Workflow LGPD e auditoria legível.
- Definir/enforçar fechamento financeiro.

### Fase 3 — Escala e navegação (2–3 semanas)

- Paginação/total/filtros server-side.
- Rotas profundas e busca global por ID.
- PatientPicker abortável.
- Interface para endpoints financeiros prioritários.

### Fase 4 — Acessibilidade, responsividade e design system (2–3 semanas)

- Tabelas semânticas/card mobile.
- Foco/contraste/teclado/zoom.
- Testes reais em 360, 768, 1024 e 1440 px.
- Consolidar CSS/tokens/componentes.

### Fase 5 — Produto e automação (contínuo)

- Modelos clínicos reais ou remoção da affordance.
- CI com Supabase, E2E, axe e performance budgets.
- Sitemap/SEO, telemetria e documentação viva.

## 16. Dependências e risco de regressão

- Cálculo de plano afeta matrícula, cobrança, controle, relatório e migração.
- Atomicidade de matrícula afeta rollback e importação.
- Alterar `profile_permissions` afeta menu, API e RLS; precisa de matriz por papel.
- Paginação afeta todos os módulos que assumem arrays completos.
- Rotas profundas afetam persistência atual em localStorage e navegação mobile.
- Refatorar CSS exige baseline visual; sem capturas atuais, primeiro restaurar ferramenta de navegador.
- Fechamento financeiro e retificação clínica exigem validação de negócio/jurídica.

## 17. Casos não testados e motivo

- Login, convite, recuperação, onboarding e troca de senha com e-mail real: não usar contas/mensagens reais.
- CRUD com dados reais por papel: não havia credenciais/dados de teste autorizados.
- Pagamento, estorno, fechamento e comissão: efeitos financeiros proibidos sem sandbox dedicado.
- Upload/download/exclusão: não criar/anular documentos clínicos reais.
- Notion: integração externa e token real; nenhuma chamada feita.
- WhatsApp/Instagram/Maps/Google Ads: não acionar serviços externos.
- Console/rede/teclado/screenshots/breakpoints: conector de navegador incompatível.
- pgTAP local: Docker ausente.
- Audit npm online: timeout; o resultado offline não prova ausência de CVEs atuais.
- Deno check: download/resolução não terminou; CI atual também não o cobre.
- Tema escuro: não existe no produto; não tratado como defeito.
- Compatibilidade Safari/Firefox/Chrome real: pendente de ambiente de navegador funcional.

## 18. Checklist de regressão para futuras correções

### Financeiro e planos

- [ ] Mensal, trimestral e semestral exibem/cobram o mesmo total.
- [ ] Desconto/acréscimo não geram negativo nem centavo artificial em plano gratuito.
- [ ] Alterar plano trata cobrança pendente, parcial e paga conforme política.
- [ ] Cobrança só fica paga quando `paid_cents == amount_cents` e há payment/entry válidos.
- [ ] Duplo clique/retry não duplica recebimento, comissão, importação ou matrícula.
- [ ] Estorno atualiza cobrança e razão uma única vez.
- [ ] Mês fechado bloqueia mutação ou exige reabertura auditada.

### Autorização

- [ ] Cada papel vê apenas módulos autorizados.
- [ ] API e RLS negam chamadas diretas não autorizadas.
- [ ] `can_edit` sempre implica `can_view`.
- [ ] Ausência/falha de permissões oculta ações e mostra erro seguro.
- [ ] Profissional só vê/opera próprios atendimentos, turmas e prontuários.
- [ ] Troca de unidade nunca expõe dados de unidade anterior.

### Pacientes, agenda e prontuário

- [ ] Detalhe nunca mostra dados do paciente anterior.
- [ ] Autocomplete encontra registros após 100/500 e descarta respostas antigas.
- [ ] Agendamento conserva horário no fuso da clínica em dispositivo externo.
- [ ] Sábado/domingo criam, editam e preservam turma.
- [ ] Capacidade respeita intervalos de vigência.
- [ ] Conclusão consome sessão uma vez.
- [ ] Assinatura requer confirmação e registro imutável.
- [ ] Retificação preserva estrutura e referência ao original.
- [ ] Upload falho não cria anexo; download/delete funcionam e auditam.

### Importação e usuários

- [ ] Unidade/origem selecionadas chegam ao backend.
- [ ] Alterar campo invalida preview.
- [ ] Commit revalida o mesmo payload e é idempotente.
- [ ] Falha em convite/edição não deixa estado parcial.
- [ ] Conta proprietária e sessão atual continuam protegidas.

### Acessibilidade e responsividade

- [ ] Todo fluxo é concluível só com teclado.
- [ ] Foco é visível com contraste suficiente em todos os fundos.
- [ ] Modais contêm/restauram foco; menus usam padrão coerente.
- [ ] Tabelas têm headers/caption e alternativa mobile sem perda.
- [ ] Erros são próximos ao campo e anunciados sem interrupção excessiva.
- [ ] 320/360/768/1024/1440 px, zoom 200/400%, texto longo e teclado passam.
- [ ] `prefers-reduced-motion` e forced colors passam.

### Resiliência e desempenho

- [ ] Rede lenta/offline preserva formulário e diferencia falha de resultado.
- [ ] Requests obsoletos são abortados e troca de unidade não duplica chamadas.
- [ ] Paginação informa total real e não trunca silenciosamente.
- [ ] Budgets de JS/CSS/imagem e LCP/INP são monitorados.
- [ ] CI executa migrações, pgTAP, Deno, E2E e axe.

## 19. Tabela consolidada de achados

| ID | Área | Página/fluxo | Achado | Evidência | Impacto | Severidade | Recomendação | Esforço | Status de validação |
|---|---|---|---|---|---|---|---|---|---|
| FIS-001 | Financeiro | Plano/matrícula | Total multiplicado na UI, cobrança não | Shared:77; API:519 | Perda financeira | Crítico | Regra única e reconciliação | Médio | Código |
| FIS-002 | Financeiro | Status cobrança | Pago sem payment/entry | Enrollments:138; API:610 | Caixa inconsistente | Alto | Pago só via RPC | Médio | Código |
| FIS-003 | Financeiro | Troca de plano | Cobrança não é recalculada | API:538-574 | Valor incorreto | Alto | Comando transacional | Grande | Código |
| FIS-004 | Matrícula | Criar com turma | Operação parcial | Enrollments:58-75 | Retrabalho/duplicidade | Alto | Endpoint/RPC único | Médio | Código |
| FIS-005 | Pacientes | Editar cadastro/plano/turma | Três commits independentes | Patients:133-169 | Estado parcial | Alto | Separar ou transacionar | Grande | Código |
| FIS-006 | Privacidade | Detalhe paciente | Dados anteriores durante load/race | Patients:68-91 | Exposição cruzada | Alto | Limpar/versionar | Pequeno | Código |
| FIS-007 | Importação | CSV | Origem/unidade ignoradas | Imports:102-112; API import:148 | Destino divergente | Alto | Enviar/aplicar campos | Médio | Código |
| FIS-008 | Importação | Preview/commit | Preview obsoleto | Imports state handlers | Importação não validada | Alto | Hash/token de preview | Médio | Código |
| FIS-009 | Prontuário | Anexos | Fantasma, sem abrir/delete, MIME divergente | Records:188; API prontuário:27-48 | Documento inacessível | Alto | Prepare/finalize + UI | Grande | Código |
| FIS-010 | Usuários | Convite/edição | Operações não atômicas | usuarios.ts:7-47,162-211 | Conta/permissão parcial | Alto | RPC + compensação | Grande | Código |
| FIS-011 | Autorização | Permissões | Editar sem visualizar | Users:271; API schema | Política contraditória | Alto | Constraint/normalização | Pequeno | Código |
| FIS-012 | Autorização | Shell | Frontend falha aberto | FisiofitApp:44-50 | Ações enganosas | Alto | Fail closed | Pequeno | Código |
| FIS-013 | Agenda | Data/hora | Fuso do navegador | Shared:83 | Horário deslocado | Alto | Timezone explícito | Médio | Código |
| FIS-014 | Escala | Seletores/busca | Só 100 pacientes | resource paths | Paciente inacessível | Alto | Autocomplete paginado | Médio | Código |
| FIS-015 | Financeiro | Fechamento | Snapshot não bloqueia; sem UI | financeiro.ts:102-149 | Razão mutável | Alto | Semântica + trava/UI | Grande | Código |
| FIS-016 | Clínico | Assinar/retificar | Sem confirmação; payload lossy | Records:89-115 | Documento inadequado | Alto | Diálogo/form completo | Médio | Código |
| FIS-017 | Acessibilidade | Tabelas | Sem semântica | Shared:720-850 | Leitor de tela | Médio | Table/list semântico | Médio | Código |
| FIS-018 | Acessibilidade | Foco | 1,54:1 e 2,08:1 | CSS + cálculo | Foco pouco visível | Médio | Anel ≥3:1 | Pequeno | Código/cálculo |
| FIS-019 | Formulários | PatientPicker | Race e ARIA incoerente | Shared:245-374 | Seleção errada | Médio | Abort/versionamento | Pequeno | Código |
| FIS-020 | Navegação | Portal | Sem deep link/history | main/FisiofitApp | Contexto não compartilhável | Médio | Rotas reais | Grande | Código |
| FIS-021 | Busca | Resultado global | Paciente escolhido ignorado | FisiofitApp:239 | Passo extra/perda seleção | Médio | Abrir por ID | Pequeno | Código |
| FIS-022 | Permissão/UX | Busca global | Visível sem acesso/dados | FisiofitApp load/topbar | Controle inútil | Médio | Condicionar permissão | Pequeno | Código |
| FIS-023 | UX | Painel | CTA não inicia cadastro | Dashboard buttons | Passo extra | Baixo | Abrir drawer/renomear | Pequeno | Código |
| FIS-024 | Agenda | Dias turma | Sem fim de semana; perda em edit | FormPrimitives:104-171 | Dados apagados | Alto | Sete dias/preservação | Pequeno | Código |
| FIS-025 | Agenda | Lotação | Vigência ignorada no count | agenda API:560-635 | Vaga falsa/rejeição | Médio | Overlap temporal | Médio | Código |
| FIS-026 | Prontuário | Modelos | Schema vazio/não renderizado | Admin:91; Records form | Recurso ilusório | Alto | Implementar/ocultar | Grande | Código |
| FIS-027 | Pacientes | Responsáveis/consentimentos | Só contagem, sem estado | Patients detail | Decisão sem evidência | Médio | Timeline/estado vigente | Médio | Código |
| FIS-028 | LGPD | Solicitações | Não atualiza/conclui na UI | API PATCH vs UI | Workflow incompleto | Alto | Gestão de caso | Grande | Código |
| FIS-029 | Site | Contato | Telefone livre/popup | ContactPage:13-20 | Falha silenciosa | Médio | Validar + fallback | Pequeno | Código |
| FIS-030 | Site | Links externos | Nova aba não anunciada | Links/Studios/Footer | Mudança inesperada | Baixo | Nome acessível | Pequeno | Código |
| FIS-031 | Site mobile | Menu | Scroll lock sem foco contido | Header effects | Teclado alcança fundo | Médio | Disclosure ou dialog | Pequeno | Risco provável |
| FIS-032 | Responsividade | Todos | Execução visual bloqueada | Erro do conector | Cobertura incompleta | Médio | Matriz manual/E2E | Pequeno teste | Limitação |
| FIS-033 | Escala | Listagens | Limite silencioso 500 | API listResource | Dados omitidos | Alto | Paginação/total | Grande | Código |
| FIS-034 | Estado/rede | Unidade global | Cache key antiga/duplicidade | Shared:95-140 | Requests/dados instáveis | Médio | Contexto + abort | Médio | Código |
| FIS-035 | Design system | CSS portal | 2.688 linhas de overrides | Build/CSS | Regressão/manutenção | Médio | Consolidar tokens | Grande | Código/build |
| FIS-036 | Performance | Carregamento | Pouco code splitting | Build chunks | Carga desnecessária | Médio | Lazy por módulo | Médio | Execução build |
| FIS-037 | Testes | CI | Sem DB/E2E/a11y/Deno | workflows/tests | Regressão crítica | Alto | Pirâmide completa | Grande | Execução/config |
| FIS-038 | Segurança | Auth/admin | Sem MFA/step-up | config + password route | Tomada de contas | Alto | MFA + reauth | Grande | Código/risco |
| FIS-039 | Produto | Endpoints órfãos | Recursos sem UI | Inventário API/UI | Fluxos incompletos | Médio | Priorizar/entregar | Médio/grande | Código |
| FIS-040 | SEO | 404/indexação | Soft 404, canonical inválido, sem sitemap | HTTP/SeoMetadata/public | Indexação ruim | Baixo | noindex/host/sitemap | Pequeno/médio | Execução/código |

## 20. Conclusão

A plataforma tem controles de segurança e uma organização de código melhores do que a cobertura atual de testes e a maturidade dos fluxos sugerem. O risco principal não está em falhas básicas de build ou ausência total de autorização; está nas divergências entre telas e regras financeiras, nas operações compostas não atômicas e em funcionalidades parcialmente expostas. A sequência recomendada é conter o cálculo/cobrança, proteger integridade e autorização, completar anexos/LGPD/fechamento e só então avançar para refatoração visual e expansão funcional.

Nenhuma correção foi implementada. Este relatório deve servir como baseline; qualquer implementação deve começar pelos casos de regressão da Fase 0 e por uma decisão explícita sobre preço do plano, matriz de papéis e semântica do fechamento financeiro.
