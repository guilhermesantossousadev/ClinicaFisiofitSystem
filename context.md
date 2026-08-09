# CONTEXT.md — Plataforma Fisiofit

**Versão:** 2.0.0

**Data de referência:** 2 de agosto de 2026

**Classificação:** interno; contém arquitetura e riscos, mas não credenciais

**Idioma da aplicação:** português do Brasil (`pt-BR`); fuso operacional `America/Sao_Paulo`

**Status:** contexto normativo único do projeto

---

## 1. Finalidade e autoridade

### 1.1 Objetivo deste documento

Este documento é a **fonte única da verdade** contextual da Plataforma Fisiofit. Ele descreve o estado encontrado no repositório, distingue implementação de validação e orienta futuras alterações. Não substitui código, migrations nem testes como fontes executáveis.

O arquivo é versionado como `context.md` porque o teste de plataforma e o README usam esse caminho. O título `CONTEXT.md` representa sua função canônica; uma troca de caixa do nome precisa atualizar referências e ser validada em sistema de arquivos sensível a maiúsculas.

### 1.2 Ordem das fontes de verdade

Em conflito, prevalecem: código em uso; migrations/schema; infraestrutura e pipelines; configuração comprovada de ambientes; testes; decisões; relatórios; README; planos históricos. Alegações sobre Supabase remoto ou publicação que existam apenas em documentação são **não verificadas** nesta análise.

### 1.3 Como manter este documento

- Atualizar este arquivo na mesma mudança que alterar arquitetura, contrato, regra de negócio, ambiente ou estado funcional.
- Citar caminhos reais e evitar duplicar implementações extensas.
- Usar: **Implementado**, **Parcial**, **Correção necessária**, **Não verificado**, **Planejado**, **Desativado**, **Legado** ou **Removido**.
- Não registrar secrets, tokens, senhas, chaves, dados clínicos ou conteúdo de `.env`.
- Não declarar “funciona” sem dizer se a evidência é código, build, teste, validação manual ou implantação.

---

## 2. Visão do produto

### 2.1 Problema resolvido

A plataforma reúne o site público e a gestão interna multiunidade da Clínica Fisiofit. O domínio interno cobre pacientes, responsáveis, consentimentos, equipe, unidades, salas, serviços, planos, turmas semanais, matrículas, agenda, prontuário, cobranças, pagamentos, lançamentos, comissões, fechamentos, relatórios, importações, usuários, privacidade e auditoria.

### 2.2 Usuários e perfis

| Perfil | Uso previsto no código |
|---|---|
| `admin` | Administração completa, usuários, configurações e privacidade |
| `manager` | Operação e gestão; não convida nem altera usuários e não acessa incidentes |
| `reception` | Agenda, pacientes e matrículas |
| `professional` | Agenda e prontuário |
| `finance` | Matrículas, financeiro e relatórios |
| Visitante | Site institucional, contato, privacidade e consentimento de publicidade |

Não existe portal do paciente. Cadastro público no Supabase Auth está desativado.

### 2.3 Principais aplicações ou interfaces

- `apps/site`: site institucional SPA na raiz do domínio.
- `apps/portal`: portal interno SPA sob `/sistema/`.
- `supabase/functions/api`: API REST da Edge Function `api` sob `/functions/v1/api/v1`.
- PostgreSQL/Auth/Storage do Supabase: persistência, identidade e arquivos privados.

### 2.4 Separação de responsabilidades

O site é público e não acessa a API clínica. O portal autentica pelo SDK Supabase e usa exclusivamente a API para o domínio. A API valida sessão, perfil, MFA e papéis e persiste com Supabase. Migrations definem schema, funções transacionais, triggers e RLS. Contratos compartilhados em `packages/contracts` cobrem somente parte das entradas; a API ainda mantém schemas Zod próprios.

---

## 3. Arquitetura atual

### 3.1 Diagrama textual da arquitetura

```text
Visitante ──> Site React/Vite ───────────────> WhatsApp/Google Maps/Instagram
                         └── consentimento ──> Google Ads (somente após aceite)

Equipe ─────> Portal React/Vite ──> Supabase Auth
                      │                    │
                      └── JWT ──> Edge Function Hono ──> PostgreSQL
                                             │            ├── funções/triggers
                                             │            └── auditoria/RLS
                                             └──────────> Storage privado (schema apenas)
```

Não há aplicativo móvel, servidor Node próprio, cache, broker, worker ou fila executável no repositório.

### 3.2 Tecnologias utilizadas

| Camada | Tecnologia | Versão declarada/resolvida | Evidência |
|---|---|---:|---|
| Runtime local/CI | Node.js | `>=20`; CI usa 22 | `package.json`, `.github/workflows/*.yml` |
| Linguagem | TypeScript | 5.9.3 | `package.json`, lockfile |
| Frontends | React / React DOM | 18.3.1 | manifests e árvore instalada |
| Build | Vite | 8.1.5 | manifests |
| Roteamento | Wouter | 3.10.0 | manifests |
| Site | Tailwind CSS | manifesto `^3.4.17`; resolvido 3.4.19 | `apps/site/package.json`, lockfile |
| Validação compartilhada | Zod | manifesto `^3.25.76`; resolvido 3.25.76 | `packages/contracts/package.json`, lockfile |
| SDK web Supabase | `@supabase/supabase-js` | manifesto `^2.86.0`; resolvido 2.111.0 | `apps/portal/package.json`, lockfile |
| API | Deno Edge Function, Hono, Zod | Hono 4.7.2; SDK 2.49.1; Zod 3.24.2 | imports fixos em `supabase/functions/api/index.ts` |
| Banco | PostgreSQL | 17 no ambiente local | `supabase/config.toml` |
| Backend gerenciado | Supabase CLI | manifesto `^2.48.3`; resolvido 2.110.0 | `package.json`, lockfile |
| Testes | Vitest / Node test / pgTAP | 4.1.10 / runtime Node / versão não identificada | manifests e testes |
| Hospedagem web | Hostinger via branch de artefatos | versão não aplicável | workflow manual |

Versões remotas efetivamente implantadas não foram verificadas.

### 3.3 Organização do backend

A API é um arquivo Hono único, com middleware global, schemas Zod locais, handlers e auxiliares. Usa `SUPABASE_SERVICE_ROLE_KEY` para o cliente de banco e aplica filtros de clínica em muitos handlers; por isso RLS não protege automaticamente chamadas da API. Funções SQL concentram conclusão de atendimento e pagamento. Não há camada formal de controllers/services/repositories.

### 3.4 Organização do frontend

O portal usa estado local React e chamadas `fetch` encapsuladas em `apps/portal/src/api.ts`. `FisiofitApp.tsx` monta shell, navegação e painel; `OperationalModules.tsx` concentra as dez interfaces operacionais. O site usa páginas e componentes React com Tailwind. Não há store global, biblioteca de consulta/cache nem SSR.

### 3.5 Serviços externos e integrações

- Supabase Auth, Edge Functions, PostgreSQL e Storage: implementados/configurados no repositório; estado remoto não verificado.
- Hostinger: empacotamento e workflow implementados; publicação efetiva não verificada.
- Google Ads: carregamento condicional após consentimento local.
- WhatsApp, Google Maps e Instagram: links públicos no site; não são integrações transacionais da API.
- NFS-e e mensageria: apenas interfaces de provider e tabelas; sem adapter, fornecedor, worker ou envio.

### 3.6 Estrutura principal de diretórios

```text
apps/site/                 site institucional
apps/portal/               portal interno
packages/contracts/        tipos e schemas compartilhados
packages/design-system/    tokens de marca e base path
supabase/functions/        API e contratos de providers
supabase/migrations/       schema versionado
supabase/tests/            testes pgTAP
scripts/                   montagem do pacote Hostinger
tests/                     testes estruturais/empacotamento
.github/workflows/         CI e preparação manual de publicação
```

---

## 4. Ambientes, execução, build e deploy

### 4.1 Pré-requisitos

Node.js 20 ou superior, npm e, para banco local, Supabase CLI mais runtime de containers suportado pela ferramenta. `npm ci` é o método reproduzível de instalação.

### 4.2 Desenvolvimento local

```bash
npm ci
npm run dev        # portal: http://localhost:3000/sistema/
npm run dev:site   # site: http://localhost:8080/
```

Sem variáveis públicas, o portal permite renderização de prévia sem sessão, mas chamadas reais usam uma URL inválida e não constituem ambiente funcional.

### 4.3 Variáveis de ambiente

| Variável | Consumidor | Observação |
|---|---|---|
| `VITE_SUPABASE_URL` | portal/build | pública para navegador; obrigatória para backend real |
| `VITE_SUPABASE_ANON_KEY` | portal/build | chave pública do cliente |
| `SUPABASE_URL` | Edge Function | obrigatória |
| `SUPABASE_ANON_KEY` | Edge Function | valida usuário |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function | secreta; nunca expor no frontend |
| `APP_ORIGIN` | Edge Function | origem CORS; há default do domínio institucional |

Somente arquivos `.env.example` foram usados para esta lista; valores reais não foram lidos nem registrados.

### 4.4 Banco de dados e migrations

```bash
npm run supabase:start
npm run supabase:reset
npm run supabase:test
```

As migrations são aplicadas por ordem lexical. Alterações remotas (`db push`, deploy de função) exigem confirmação do ambiente e autorização explícita.

### 4.5 Testes

```bash
npm run typecheck
npm run build
npm test
npm run supabase:test   # requer stack local
```

O teste Node inspeciona `dist/`; portanto o build deve precedê-lo em validação limpa.

### 4.6 Integração contínua

`.github/workflows/ci.yml` roda em pull requests e pushes para `main`: `npm ci`, typecheck, build e testes. Não executa lint nem pgTAP.

### 4.7 Deploy

O workflow manual `.github/workflows/hostinger-build.yml` gera `dist/` e força a branch `hostinger-deploy` com apenas os artefatos. Não há workflow versionado para aplicar migrations ou publicar a Edge Function. A publicação e o estado remoto são **não verificados**.

### 4.8 Ambientes disponíveis

- **Local:** configurado no repositório.
- **Homologação:** não identificada em configuração executável.
- **Produção:** domínio e projeto Supabase são alegados no contexto anterior; o project ref `eeltguuoxpfttjznugla` é preservado apenas como referência histórica exigida por teste, não como prova de implantação atual.

---

## 5. Estado funcional dos módulos

| Módulo | Estado | Evidência | Observação |
|---|---|---|---|
| Site institucional | Implementado | `apps/site/src` | Buildável; conteúdo jurídico ainda provisório |
| Login/recuperação | Implementado | páginas Auth e Supabase config | Não testado contra Auth remoto nesta análise |
| MFA TOTP | Implementado | `MfaPage.tsx`, middleware API | Obrigatório para admin, manager e finance |
| Painel | Implementado | `/dashboard`, `FisiofitApp.tsx` | Dados reais da API |
| Agenda/turmas | Parcial | API e `OperationalAgenda` | CRUD incompleto; recorrência não é criada |
| Pacientes | Parcial | endpoints e `OperationalPatients` | Cria/edita paciente; detalhes associados sem edição/remoção completa |
| Matrículas/cobranças | Parcial | endpoints/UI | Criação e recebimento; sem gestão completa de estados |
| Prontuário | Parcial | endpoints/UI/triggers | Criação, assinatura e retificação; autorização profissional insuficiente |
| Financeiro | Parcial | endpoints/UI/funções SQL | Lançamentos, pagamentos, comissões e fechamento; sem estorno/reabertura |
| Relatórios | Parcial | endpoints/UI | Anual, CSV e impressão do navegador; sem PDF/XLSX gerado pelo backend |
| Importações | Parcial | endpoint/UI | XLSX/CSV por abas para unidades, salas, profissionais, serviços, planos, pacientes, matrículas, agenda, turmas, cobranças, pagamentos, financeiro, comissões, prontuários e modelos; validação e lote auditável, ainda sem transação única/rollback |
| Usuários | Parcial | endpoints/UI | Convite e alteração; não há remoção e o redirect do convite diverge do fluxo de senha |
| Configurações | Parcial | endpoints/UI | Somente criação/listagem de entidades centrais |
| Privacidade/auditoria | Parcial | migration, endpoints/UI | Solicitações e incidentes; política pública ainda provisória |
| Storage/anexos | Parcial | buckets/tabela | Sem endpoint ou interface de upload/download |
| NFS-e/notificações | Planejado | providers e tabelas | Sem implementação operacional |

### 5.1 Correção de estado anterior

O contexto anterior afirmava que grande parte do portal usava dados demonstrativos. O código atual de `OperationalModules.tsx` chama a API para agenda, pacientes, matrículas, prontuários, financeiro, relatórios, importações, usuários, configurações e privacidade. A verdade vigente é: interfaces e fluxos principais existem, mas são **parciais** e não possuem validação integrada suficiente para produção.

### 5.2 Critério de conclusão

“Implementado” nesta tabela significa que o fluxo principal existe no código, não que foi homologado ou implantado. Nenhum módulo clínico foi validado manualmente contra produção nesta análise.

---

## 6. Banco de dados

### 6.1 Banco e versão

PostgreSQL 17 é configurado para a stack Supabase local. O acesso web usa `@supabase/supabase-js`; não há ORM.

### 6.2 Entidades ou tabelas centrais

- Organização: `clinics`, `units`, `profiles`, `profile_units`.
- Catálogo/equipe: `rooms`, `professionals`, `professional_units`, `services`, `plans`.
- Paciente: `patients`, `responsibles`, `consents`, `attachments`.
- Operação: `group_slots`, `group_slot_memberships`, `enrollments`, `appointments`.
- Clínica: `record_templates`, `clinical_records`.
- Financeiro: `charges`, `payments`, `financial_entries`, `commissions`, `monthly_closings`.
- Integrações/governança: `fiscal_documents`, `notifications`, `import_batches`, `idempotency_keys`, `audit_events`, `data_subject_requests`, `privacy_incidents`.

### 6.3 Histórico de migrations

1. `202607290001_initial_schema.sql`: tipos, tabelas, índices, funções, views, RLS e buckets.
2. `202607290002_bootstrap_admin.sql`: vincula uma conta Auth preexistente e cria/atualiza perfil administrador. É dependente de estado remoto e contém identidade nominal; exige revisão antes de reutilização em outro ambiente.
3. `202608020001_owner_and_privacy.sql`: proprietário protegido, consentimentos enriquecidos e domínio de privacidade.

Não foram encontradas migrations duplicadas, mas a segunda migration falha se o usuário Auth esperado não existir.

### 6.4 Relacionamentos importantes

Registros pertencem a `clinic_id`; entidades operacionais também se ligam a unidade. Matrícula liga paciente, plano e unidade; vínculo de turma liga matrícula/paciente a `group_slot`; atendimento pode ligar matrícula/turma. Prontuário liga paciente, profissional, unidade e opcionalmente atendimento/template. Pagamento pertence a cobrança e gera lançamento financeiro.

### 6.5 Regras de persistência

- Valores monetários são inteiros em centavos e não negativos/positivos conforme o domínio.
- Dados centrais possuem `deleted_at`, mas a API ainda não oferece os fluxos de exclusão lógica.
- Prontuário assinado é imutável por trigger; auditoria rejeita update/delete.
- CPF é único por clínica entre pacientes não excluídos.
- Pagamento é único por clínica e `idempotency_key`.
- Buckets clínico e financeiro são privados, com limites e MIME types definidos.

### 6.6 Dados derivados

`monthly_financial_summary` agrega previsto/realizado por competência. `enrollment_usage` deriva saldo. `complete_appointment` conclui e consome uma sessão uma única vez; `register_payment` registra recebimento e lançamento em transação SQL.

---

## 7. Contratos e interfaces

### 7.1 Endpoints da API

| Família | Prefixo | Operações principais |
|---|---|---|
| Infra | `/health`, `/openapi.json` | saúde e especificação parcial |
| Identidade | `/bootstrap`, `/me`, `/users` | onboarding, perfil, convite e atualização |
| Organização | `/units`, `/rooms`, `/professionals`, `/services`, `/plans` | listagem/criação |
| Pacientes | `/patients` | lista/cria/edita, responsáveis, consentimentos e timeline |
| Agenda | `/appointments`, `/group-slots` | agenda, status, conclusão, turmas e membros |
| Matrículas | `/enrollments`, `/charges`, `/payments` | matrícula, cobrança e recebimento |
| Clínica | `/record-templates`, `/clinical-records` | templates, rascunho, assinatura e retificação |
| Financeiro | `/financial-entries`, `/commissions`, `/closings`, `/reports` | movimentos, comissão, fechamento e relatórios |
| Dados | `/imports`, `/imports/workbook` | histórico de lotes e importação multi-entidade por abas |
| Governança | `/privacy`, `/audit` | titulares, incidentes e auditoria |
| Integrações | `/fiscal-documents`, `/notifications` | somente listagem |

`openapi.json` documenta apenas um subconjunto e não é contrato completo.

### 7.2 Eventos e filas

Não existem eventos ou filas executáveis. `notifications` e `fiscal_documents` modelam estado futuro.

### 7.3 Webhooks

Nenhum webhook foi encontrado.

### 7.4 Jobs e tarefas agendadas

Nenhum cron, job ou worker foi encontrado.

### 7.5 Padrão de respostas

Sucesso: `{ data, error: null, requestId }`. Falha: `{ data: null, error: { code, message, details? }, requestId }`. Pacientes retornam paginação dentro de `data`; as listagens genéricas retornam arrays limitados a 500, sem metadados.

### 7.6 Padrão de erros

Validação retorna 422; autenticação 401; MFA/papel 403; duplicidade 409; outros erros de banco são reduzidos a 400 `DATABASE_ERROR`; erro inesperado retorna 500. O mapeamento de erro de banco perde distinções como “não encontrado” e “acesso negado”. Não há rate limit.

---

## 8. Regras de negócio vigentes

### 8.1 Multiunidade e acesso

Admin consolida a clínica; demais perfis deveriam operar somente unidades de `profile_units`. `has_unit_access` existe no banco, mas, como a API usa service role, a restrição precisa ser aplicada explicitamente em cada handler. Isso não ocorre de forma uniforme e é risco vigente.

### 8.2 Validações

Nomes e contatos possuem limites Zod; UUIDs e datas são validados; dinheiro é inteiro; pagamento deve ser positivo; solicitações de titular exigem e-mail ou telefone. Contratos compartilhados e schemas da API duplicam regras e já diferem na nomenclatura camelCase/snake_case.

### 8.3 Estados e transições

- Atendimento: `scheduled`, `confirmed`, `attending`, `completed`, `missed`, `cancelled`, `blocked`.
- Matrícula: `active`, `paused`, `expired`, `cancelled`.
- Cobrança: `pending`, `partial`, `paid`, `overdue`, `cancelled`.
- Prontuário: `draft` → `signed`; correção cria registro `rectification`.
- Comissão: `pending` → `approved` no fluxo implementado.
- Fechamento criado diretamente como `closed`; reabertura não implementada.

O endpoint genérico de status permite marcar atendimento `completed` sem chamar a função que consome sessão; esta transição é uma **correção necessária**.

### 8.4 Cálculos

- Cobrança de matrícula = preço do plano − desconto + acréscimo, com mínimo forçado de 1 centavo.
- Saldo de sessões = incluídas − utilizadas, mínimo zero.
- Pagamento parcial atualiza `paid_cents` e status.
- Relatório anual sempre normaliza 12 meses e soma previsto/realizado.
- Comissão aprovada gera despesa de pelo menos 1 centavo, embora a comissão aceite zero; inconsistência a corrigir.

### 8.5 Restrições

Turmas têm **capacidade padrão e máxima: 7 alunos** e mínimo configurável de 3. O servidor recusa novo membro quando a contagem ativa atinge a capacidade. A contagem não considera vigência (`starts_at`/`ends_at`), podendo bloquear um novo período por vínculos antigos ainda `active`.

---

## 9. Autenticação, autorização e privacidade

### 9.1 Autenticação

Supabase Auth com e-mail/senha, convite, recuperação e sessão persistida. Signup público está desativado. Retornos PKCE e tokens no fragmento são processados e removidos da URL.

### 9.2 Sessões e tokens

O portal envia Bearer JWT. A API confirma o usuário com `auth.getUser()`. MFA é decidido pela claim `aal` do token já autenticado. Expiração configurada localmente: 3600 segundos.

### 9.3 Perfis de acesso

MFA TOTP é exigido pela API para `admin`, `manager` e `finance`. `reception` e `professional` usam AAL1. Perfil deve estar `active` e não excluído.

### 9.4 Permissões

Papéis protegem mutações sensíveis e a navegação do portal. A conta proprietária não pode ser rebaixada, bloqueada, removida da clínica, ter MFA desativado nem perder unidades, por validação de API e triggers.

### 9.5 Proteções de endpoints

`/health`, `/openapi.json` e `/bootstrap` precedem o middleware geral; bootstrap valida seu próprio Bearer. Os demais exigem sessão e perfil. Não há rate limiting, proteção CSRF específica ou checagem central de unidade. CORS aceita a origem configurada e qualquer `localhost`.

### 9.6 Privacidade e dados sensíveis

O site registra consentimento publicitário em `localStorage` e só injeta Google Ads após aceite. A política de privacidade declara dados institucionais pendentes, logo não está pronta para produção. Dados clínicos/financeiros são sensíveis; logs da API incluem mensagem de erro do banco e devem ser revisados para evitar vazamento operacional.

---

## 10. Cache, mensageria e processamento assíncrono

### 10.1 Cache

Não implementado. A API define `cache-control: no-store`.

### 10.2 Filas

Planejadas pelo modelo de notificações/fiscal, mas não implementadas.

### 10.3 Workers

Não implementados.

### 10.4 Eventos

Não há barramento. `audit_events` é trilha persistente síncrona.

### 10.5 Invalidação e consistência

O frontend recarrega recursos após mutações. Pagamento/conclusão usam transações SQL; outras operações compostas (convite+perfil+unidades, profissional+unidades, matrícula+cobrança, aprovação+lançamento, importação+lote) são múltiplas chamadas sem transação única e podem deixar estado parcial.

---

## 11. Frontend e experiência do usuário

### 11.1 Estrutura das páginas

Site: início, sobre, serviços, unidades, contato, links, privacidade, cookies e 404. Portal: login, definição de senha, MFA, onboarding e shell com 11 visões conforme o papel.

### 11.2 Gerenciamento de estado

Hooks locais (`useState`, `useEffect`, `useMemo`) e contexto somente para Auth. Não há cache de servidor nem roteamento URL para módulos internos; recarregar retorna ao Painel.

### 11.3 Componentes compartilhados

O site compartilha layout, header, footer e primitivas. O portal compartilha helpers e estruturas dentro de arquivos grandes. `OperationalModules.tsx` com mais de 2.000 linhas é débito de manutenção.

### 11.4 Design system

`packages/design-system/src/index.ts` define tokens de cor e `/sistema`. Manrope é carregada via Google Fonts no CSS do site. O portal usa CSS próprio e tokens.

### 11.5 Responsividade

Há media queries/classes responsivas e navegação móvel. Não foi feita validação visual manual nesta análise.

### 11.6 Acessibilidade

Existem labels, skip link no site e textos alternativos em pontos principais. Não há teste automatizado de acessibilidade; ícones textuais e estados dinâmicos precisam de auditoria.

### 11.7 Restrições de interface

A visibilidade de menu melhora UX, mas não substitui autorização do backend. A busca global carrega no máximo 100 pacientes e filtra no cliente; não escala nem localiza registros fora dessa página.

---

## 12. Decisões arquiteturais vigentes

| ID | Decisão | Motivo/evidência | Estado |
|---|---|---|---|
| ARCH-01 | Monorepositório npm workspaces | build e contratos comuns | Vigente |
| FRONT-01 | Site na raiz e portal em `/sistema/` | Vite base e `.htaccess` separados | Vigente |
| API-01 | Portal acessa domínio pela Edge Function | `api.ts`; nenhum acesso direto a tabelas | Vigente |
| AUTH-01 | Convite + MFA por papel | Auth config, UI e middleware | Vigente |
| DB-01 | PostgreSQL versionado por migrations | `supabase/migrations` | Vigente |
| DB-02 | Dinheiro em centavos; tempo absoluto em `timestamptz` | schema e API | Vigente |
| CLIN-01 | Prontuário assinado imutável e retificado por novo registro | trigger e endpoints | Vigente |
| AUDIT-01 | Auditoria append-only | trigger | Vigente |
| DEPLOY-01 | Artefato Hostinger único em branch dedicada | script/workflow | Vigente, implantação não verificada |
| INTEG-01 | Providers fiscal/mensagem desacoplados | interfaces compartilhadas | Planejado, sem adapter |

### 12.1 Decisões superadas

Páginas demonstrativas como implementação principal do portal estão superadas pelo atual `OperationalModules.tsx`. A alegação antiga de que pacientes eram o único módulo conectado não é vigente.

### 12.2 Decisões ainda pendentes

Fornecedor de NFS-e/mensageria; política central de escopo por unidade; homologação; backup/PITR; geração de documentos fiscais; E2E autenticado completo.

---

## 13. Testes e estado de verificação

### 13.1 Testes do backend

Não há testes que executem handlers Hono. `tests/platform.test.mjs` valida invariantes de plataforma e padrões no arquivo da API.

### 13.2 Testes do frontend

Cinco testes Vitest validam schemas compartilhados. Não há teste de componentes, fluxos Auth ou E2E.

### 13.3 Testes de integração

Ausentes para API↔PostgreSQL, Auth/MFA, papéis, unidades, Storage e providers.

### 13.4 Testes de banco e migrations

`supabase/tests/database.test.sql` contém 12 asserções pgTAP de existência/default; não exercita RLS, transações, triggers negativas ou migrations do zero no CI.

### 13.5 Verificações do pipeline

CI executa typecheck, build e testes JavaScript. Build não prova operação remota. Lint está declarado nas apps, mas ESLint não aparece como dependência e o CI não o chama.

### 13.6 Lacunas de cobertura

Prioridade: autorização por unidade/papel; prontuário; idempotência; matrícula+cobrança; conflito/capacidade; fechamento; importação parcial; conta proprietária; recuperação/MFA; consentimento de Ads.

---

## 14. Problemas conhecidos e débitos técnicos

| Prioridade | Problema | Impacto | Evidência | Correção recomendada |
|---|---|---|---|---|
| P0 | API usa service role sem escopo central por unidade | Perfil pode acessar/escrever unidade não autorizada | middleware e handlers não chamam `has_unit_access` | cliente com RLS efetiva ou guard central obrigatório |
| P0 | Profissional pode consultar/criar/assinar prontuário de qualquer paciente/profissional da clínica | Violação clínica/LGPD | endpoints filtram por paciente/id, não por profissional/unidade | autorizar vínculo de profissional, atendimento e unidade |
| P1 | Status genérico permite `completed` sem consumir sessão | saldo divergente | PATCH status versus RPC de conclusão | proibir transição ou delegar à RPC |
| P1 | Algumas operações compostas não são atômicas | registros órfãos/parciais | múltiplos inserts nos handlers | RPC/transação compensável; rollback de importações e matrículas já possui RPC dedicada |
| P1 | Convite redireciona a `/sistema/login` | usuário convidado pode não entrar no fluxo de definição de senha | `users/invite` versus `SetPasswordPage` | alinhar redirect a `/set-password` e testar |
| P1 | Migration de bootstrap depende de UUID Auth preexistente | reset/novo ambiente pode falhar | `202607290002_bootstrap_admin.sql` | separar bootstrap de estado específico ou documentar pré-condição automatizada |
| P1 | Sem testes reais de autorização/RLS | regressões críticas não detectadas | suíte atual | integração com perfis e unidades |
| P2 | Capacidade de turma ignora vigência dos membros | bloqueio indevido de vaga futura | consulta de membros ativos | considerar intervalo e normalizar status |
| P2 | Comissão zero vira despesa de 1 centavo | distorção financeira | schema aceita zero e aprovação usa `Math.max` | proibir zero ou manter valor exatamente |
| P2 | OpenAPI incompleta e schemas duplicados | deriva contratual | documento parcial e Zod duplicado | gerar/compartilhar contratos |
| P2 | Listagens genéricas sem paginação e busca global limitada | escala/UX | limite 500 e primeira página de 100 | paginação consistente no servidor |
| P2 | Política pública contém dados pendentes | risco jurídico de publicação | `PrivacyPage.tsx` | validação jurídica e dados da controladora |
| P3 | Arquivos monolíticos | manutenção difícil | API ~1.186 linhas; módulos ~2.056 | modularizar por domínio sem alterar contratos |
| P3 | Arquivos monolíticos | manutenção difícil | API e módulos operacionais concentram muitos domínios | modularizar por domínio sem alterar contratos |

### 14.1 Riscos de segurança

Os dois riscos P0 são bloqueadores de produção. Também faltam rate limit e testes de isolamento. A service role deve permanecer somente no backend.

### 14.2 Riscos de arquitetura

Duplicação de contratos, arquivos monolíticos e operações compostas sem transação aumentam divergência e falhas parciais.

### 14.3 Riscos operacionais

Deploy de banco/API não está automatizado; homologação, restauração e estado remoto não foram comprovados; workflows podem publicar artefatos por force push após acionamento manual.

### 14.4 Ordem recomendada de correção

1. Isolamento por unidade e prontuário.
2. Transições/atomicidade financeiras e clínicas.
3. Testes integrados de Auth, RLS e migrations.
4. Convites, bootstrap e ambiente de homologação.
5. Contratos/paginação/modularização.
6. Integrações e documentos somente após segurança operacional.

---

## 15. Regras para novas implementações

### 15.1 Backend

- Todo handler deve validar clínica, unidade, papel e propriedade do recurso; service role nunca é autorização.
- Operações compostas críticas devem ser transacionais e idempotentes.
- Não permitir caminhos alternativos que contornem funções de domínio.
- Preservar envelope e `requestId`; ampliar OpenAPI junto com endpoints.

### 15.2 Frontend

- Acessar domínio somente por `api.ts`; não consultar tabelas clínicas diretamente.
- Manter menu por papel, mas tratar 401/403 no backend como autoridade.
- Implementar loading, erro, vazio, confirmação e acessibilidade.
- Paginar buscas no servidor; não adicionar dados demonstrativos a fluxos reais.

### 15.3 Banco de dados

- Toda mudança de schema exige migration incremental e teste.
- Preservar centavos, timestamps com fuso, imutabilidade clínica e auditoria append-only.
- Não editar migration já aplicada sem plano explícito; não inserir credenciais/senhas.

### 15.4 Segurança

- Secrets apenas no provedor de ambiente; somente URL e chave pública no browser.
- Testar matriz papel×unidade×recurso para toda função sensível.
- Dados clínicos, financeiros, CPF e contato não entram em fixtures, logs ou documentação.

### 15.5 Testes

Regra nova exige sucesso, falha, autorização, isolamento e idempotência quando aplicável. Build não substitui testes. Alteração de migration deve ser testada em banco limpo.

### 15.6 Documentação

Atualizar este contexto, exemplos de ambiente, OpenAPI e README quando seus contratos mudarem. Planejado nunca deve ser descrito como implementado.

### 15.7 Observabilidade

Manter `requestId` e auditoria de ações sensíveis; não registrar payload clínico nem valores de secrets. Definir métricas/alertas antes de produção.

### 15.8 Compatibilidade

Preservar Node `>=20`, CI Node 22, base `/sistema/`, SPA fallbacks e formato de artefato Hostinger até decisão substituta versionada.

---

## 16. Workflow Git

### 16.1 Branches

`main` recebe CI. `hostinger-deploy` é branch de artefatos atualizada apenas pelo workflow manual. Não editar manualmente a branch de deploy.

### 16.2 Commits

Commits devem ser coesos, sem secrets, builds, `.env` ou dados reais. Esta análise não autoriza commit.

### 16.3 Pull requests ou merge requests

Explicar regra alterada, riscos, migrations, evidências de teste e impacto por perfil/unidade. Mudanças sensíveis requerem revisão humana.

### 16.4 Validação obrigatória

Antes de merge: `npm ci` quando necessário, typecheck, build, testes e `git diff --check`; migrations exigem pgTAP/reset local. Lint somente após sua configuração ser corrigida.

### 16.5 Deploy para produção

Exige autorização explícita, secrets configurados, migrations/API compatíveis, homologação e plano de rollback. O workflow Hostinger não publica banco nem Edge Function.

### 16.6 Limpeza de branches

Excluir branches de trabalho somente após merge confirmado. Preservar `hostinger-deploy` enquanto a Hostinger depender dela.

---

## 17. Referências executáveis

| Tema | Fonte oficial |
|---|---|
| Scripts, engines e workspaces | `package.json` |
| Lock de dependências | `package-lock.json` |
| Portal/rotas Auth | `apps/portal/src/main.tsx`, `apps/portal/src/AuthProvider.tsx` |
| Portal operacional | `apps/portal/src/FisiofitApp.tsx`, `apps/portal/src/OperationalModules.tsx` |
| Cliente API | `apps/portal/src/api.ts`, `apps/portal/src/supabase.ts` |
| Site e rotas | `apps/site/src/App.tsx`, `apps/site/src/pages`, `apps/site/src/components` |
| Design | `packages/design-system/src/index.ts`, CSS das apps |
| Contratos compartilhados | `packages/contracts/src/index.ts` |
| API/rotas/regras | `supabase/functions/api/index.ts` |
| Providers planejados | `supabase/functions/_shared/providers.ts` |
| Banco/migrations/RLS | `supabase/migrations/*.sql` |
| Seed | `supabase/seed.sql` |
| Supabase local/Auth/Storage | `supabase/config.toml` |
| Variáveis permitidas | `.env.example`, `apps/portal/.env.example` |
| Testes frontend/contratos | `apps/portal/src/contracts.test.ts` |
| Testes de banco | `supabase/tests/database.test.sql` |
| Testes de plataforma | `tests/platform.test.mjs` |
| CI | `.github/workflows/ci.yml` |
| Build/Hostinger | `scripts/assemble-hostinger.mjs`, `.github/workflows/hostinger-build.yml` |
| SPA rewrite | `apps/site/public/.htaccess`, `apps/portal/public/.htaccess` |

Não existem fontes executáveis para containers, Kubernetes, Terraform, cache, filas, workers, webhooks ou deploy automatizado do backend.

---

## 18. Checklist de atualização do contexto

- [x] Conferir implementação, dependências e entradas.
- [x] Conferir migrations, schemas, seed e testes pgTAP.
- [x] Conferir containers/manifests: ausentes.
- [x] Conferir pipelines e empacotamento.
- [x] Distinguir implementado, testado, implantado e planejado.
- [x] Corrigir afirmações superadas do contexto anterior.
- [x] Registrar problemas somente com evidência.
- [x] Validar que caminhos citados existem.
- [x] Não incluir valores de secrets nem ler `.env.local`.
- [ ] Validar Supabase remoto, Hostinger, Auth real e entrega de e-mail: fora do escopo local/não verificado.
- [ ] Executar testes de banco: depende da stack Supabase local.

---

## 19. Histórico de verdades estabelecidas — CoVe

| Data | Contexto | Verdade estabelecida | Evidência |
|---|---|---|---|
| 2026-08-02 | Estado do portal | Módulos principais usam API; descrição de “dados demonstrativos” foi superada | chamadas em `OperationalModules.tsx` |
| 2026-08-02 | Segurança | RLS não é segunda barreira efetiva nas chamadas feitas com service role; escopo por unidade não é uniforme | criação do cliente API e handlers |
| 2026-08-02 | Funcionalidade | Código existente é amplo, mas CRUDs, transições, anexos e integrações permanecem parciais | famílias de endpoints e UI |
| 2026-08-02 | Infraestrutura | Há CI e empacotamento Hostinger, mas não há deploy versionado de migration/Edge Function nem homologação configurada | workflows e ausência de manifests |
| 2026-08-02 | Verificação | Alegações antigas sobre conta, MFA, função e front remoto não foram tratadas como prova atual | ausência de evidência executável/local |
| 2026-08-02 | Privacidade | Consentimento de Ads está implementado; texto jurídico público ainda tem campos pendentes | `CookieConsent.tsx`, `PrivacyPage.tsx` |

---

*Fim do contexto normativo único do projeto.*
