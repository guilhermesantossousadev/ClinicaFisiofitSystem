# Fisiofit — contexto oficial do projeto

Atualizado em: 29 de julho de 2026  
Responsável pelo produto: Clínica Fisiofit  
Status: desenvolvimento e homologação; front-end ainda não publicado

Este arquivo é a fonte única da verdade do projeto. Decisões de arquitetura,
regras de negócio, estado de implementação e procedimentos operacionais devem
ser atualizados aqui na mesma alteração que modificar o sistema. Se outro
documento divergir deste arquivo, `context.md` prevalece.

## Objetivo

A plataforma administra a operação multiunidade da Clínica Fisiofit:
pacientes, responsáveis, consentimentos, profissionais, salas, serviços,
planos, turmas semanais, matrículas, agenda, prontuário, pagamentos, fluxo
financeiro, comissões, fechamentos, relatórios, importações e auditoria.

O portal é exclusivo da equipe nesta fase. Não existe portal do paciente.
WhatsApp e NFS-e possuem contratos preparados, mas não têm fornecedor ativo.

## Repositório único

Este diretório é o monorepositório oficial. A antiga cópia separada do site não
deve receber novas alterações.

```text
apps/
├── site/                 site institucional React/Vite
└── portal/               sistema interno React/Vite em /sistema
packages/
├── contracts/            tipos e validações Zod compartilhados
└── design-system/        tokens oficiais da marca e base path
supabase/
├── functions/api/        API REST TypeScript
├── migrations/           esquema PostgreSQL versionado
├── tests/                testes de banco
├── config.toml           Auth, MFA, Storage e função
└── seed.sql              seed seguro, sem pessoas fictícias
scripts/
└── assemble-hostinger.mjs
```

Repositório GitHub usado pela Hostinger:
`guilhermesantossousadev/ClinicaFisiofitSystem`.

Remotes locais:

- `origin`: repositório GitHub oficial e fonte da Hostinger.
- `sites`: histórico da demonstração inicial; não é destino de produção.

Nenhum push, merge ou publicação deve acontecer sem autorização explícita.

## Arquitetura vigente

Toda a plataforma usa TypeScript.

- Front-end: React 18, Vite 8 e Wouter.
- Estilo do site: Tailwind CSS.
- Estilo do portal: CSS responsivo com tokens compartilhados.
- Contratos: Zod.
- Backend: Supabase Edge Functions com Hono.
- Banco: PostgreSQL 17.
- Autenticação: Supabase Auth, convite e MFA TOTP.
- Arquivos: Supabase Storage privado.
- Hospedagem do front-end: Hostinger.
- API, Auth, banco e Storage: Supabase em São Paulo.

O portal nunca acessa tabelas clínicas diretamente. Ele usa:

```text
/functions/v1/api/v1/...
```

O gateway da Edge Function exige JWT e a API repete a autorização por clínica,
unidade, papel, propriedade e nível de MFA. RLS é a segunda barreira.

## Infraestrutura Supabase

- Organização: `Fisiofit`
- ID da organização: `irhbjafwogvjppyjsqwo`
- Projeto: `Fisiofit Clinic Management`
- Project ref: `eeltguuoxpfttjznugla`
- Região: `sa-east-1` — São Paulo
- Dashboard:
  `https://supabase.com/dashboard/project/eeltguuoxpfttjznugla`
- URL pública:
  `https://eeltguuoxpfttjznugla.supabase.co`
- Edge Function: `api`
- Domínio permitido pela API:
  `https://clinicafisiofitsabara.com`

O projeto está vinculado localmente pela Supabase CLI. Migrations e
configurações iniciais já foram aplicadas. A API respondeu `healthy` após o
deploy.

A primeira conta administrativa foi convidada em 29 de julho de 2026. O
usuário existe no Supabase Auth, mas o perfil `admin` permanece pendente até o
aceite do convite, conclusão do onboarding e configuração do MFA.

Segredos nunca entram no Git. Somente a URL e a chave `publishable` podem ser
usadas no navegador. Chaves `secret`, `service_role`, senha do banco, tokens de
acesso e credenciais da Hostinger não podem aparecer em código, documentação,
logs ou mensagens.

## Ambientes

### Local

- Portal: `http://localhost:3000/sistema/`
- Login: `http://localhost:3000/sistema/login`
- Site institucional: porta 8080 quando executado separadamente.
- O portal usa `apps/portal/.env.local`, ignorado pelo Git.
- Dados reais não devem ser copiados para fixtures ou testes.

### Homologação

Ainda não há endereço de front-end dedicado. Antes da produção, deve existir
uma homologação com dados sintéticos, perfis reais de teste e validação da
equipe.

### Produção

- Site: `https://clinicafisiofitsabara.com/`
- Portal planejado:
  `https://clinicafisiofitsabara.com/sistema/`
- O front-end ainda não foi publicado por este monorepositório.
- Produção exige aprovação manual.

## Build e Hostinger

`npm run build` executa:

1. build do site;
2. build do portal com base `/sistema/`;
3. montagem do pacote único em `dist/`.

Resultado:

```text
dist/
├── index.html            site na raiz
├── assets/
└── sistema/
    ├── index.html
    ├── assets/
    └── .htaccess
```

O `.htaccess` da raiz preserva arquivos e diretórios físicos. O `.htaccess` de
`/sistema` faz fallback para o roteador do portal.

O workflow `Preparar publicação para a Hostinger` é exclusivamente manual. Ele
valida, compila e atualiza a branch `hostinger-deploy`. Os secrets
`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` precisam estar configurados no
GitHub antes do primeiro acionamento. O workflow de CI apenas valida; não
publica.

## Identidade visual

Fonte: Manrope.

| Token | Valor | Uso |
|---|---:|---|
| navy | `#17324d` | texto e navegação |
| navyDeep | `#10263a` | títulos e contraste |
| blue | `#2788c9` | ações principais |
| blueDark | `#176da8` | hover e contraste |
| aqua | `#23aa94` | sucesso e cuidado |
| mint | `#e6f7f3` | fundos de confirmação |
| sky | `#eaf5fc` | fundos azuis suaves |
| surface | `#f5f9fc` | superfície geral |
| line | `#dce8ef` | bordas |

Os valores em código vivem em `packages/design-system`. A logo oficial não
deve ser redesenhada. Usa-se a versão completa no login, a versão compacta na
navegação e aplicação suave em fundos institucionais.

## Perfis e acesso

- Administrador: todas as unidades e módulos.
- Gestor: unidades autorizadas e módulos de gestão.
- Recepção: operação de pacientes, matrículas, agenda e pagamentos permitidos;
  não acessa conteúdo clínico.
- Profissional: agenda e prontuários dos atendimentos permitidos.
- Financeiro: cobranças, pagamentos, financeiro e relatórios.

Cadastro público está desativado. Usuários entram por convite. MFA TOTP é
obrigatório para Administrador, Gestor e Financeiro. As sessões são validadas
na API antes de qualquer acesso protegido.

Convites e recuperações de conta direcionam para `/sistema/set-password`. A
senha é definida diretamente entre usuário e Supabase, exige no mínimo 10
caracteres e nunca é criada, lida ou armazenada pela aplicação. O portal
processa tanto retornos PKCE (`code`) quanto retornos com tokens no fragmento,
preserva a sessão antes de renderizar a rota e remove os dados sensíveis da
URL. A própria tela de login permite solicitar um novo link por e-mail.

O administrador inicial é Guilherme Santos de Sousa, vinculado ao usuário Auth
`d0422411-434d-43c8-af22-f8f163c9a3eb`. O perfil administrativo é criado por
migration versionada, ativo, com papel `admin` e MFA obrigatório. Senhas nunca
fazem parte das migrations.

## Regras de negócio obrigatórias

### Multiunidade

Registros aplicáveis carregam `clinic_id` e `unit_id`. Toda leitura ou escrita
sensível valida a unidade na API e por RLS. A administração pode consolidar
todas as unidades.

### Turmas e planos semanais

Os planos da clínica são baseados em horários fixos semanais, por exemplo:

- segunda e quarta às 09:00: `weekdays = [1, 3]`;
- terça e quinta às 09:00: `weekdays = [2, 4]`.

`group_slots` representa uma turma fixa por unidade, sala, profissional,
serviço, dias, horário e duração. `group_slot_memberships` vincula paciente e
matrícula durante uma vigência.

Regras:

- capacidade padrão e máxima: 7 alunos;
- capacidade operacional mínima: 3 alunos;
- a 8ª matrícula deve ser recusada no servidor;
- profissionais e salas podem ser compartilhados somente por alunos do mesmo
  `group_slot_id`;
- presença, falta, sessão e evolução permanecem individuais;
- concluir um atendimento reduz o saldo exatamente uma vez.

### Agenda

Visões obrigatórias:

- semana por profissional;
- equipe hoje;
- semana filtrada por unidade;
- dia por unidades, com profissionais lado a lado e iniciais dos pacientes.

Filtros: data, unidade, profissional, sala, serviço e situação. Conflitos
consideram profissional, sala, unidade, intervalo, bloqueio, recorrência e
capacidade da turma.

### Prontuário

Avaliações e evoluções pertencem ao paciente, profissional, unidade e
atendimento. Registros finalizados armazenam identidade, data, conteúdo
canônico e hash. Não podem ser sobrescritos. Correções são retificações
vinculadas, justificadas e auditadas.

### Financeiro

Valores são inteiros em centavos. Datas são armazenadas em UTC e exibidas em
`America/Sao_Paulo`. Pagamentos compostos usam transação e idempotency key.
Previsto e realizado permanecem separados. Fechamentos aprovados são
versionados e bloqueados; reabertura exige auditoria.

### Exclusão e auditoria

Dados clínicos e financeiros usam exclusão lógica. Auditoria é append-only.
Consultas, alterações, assinaturas, exportações, estornos e exclusões sensíveis
devem registrar usuário, clínica, unidade, ação, entidade, data e request ID.

## Estado real da implementação

### Concluído

- monorepositório e build único;
- identidade visual compartilhada;
- rotas de site e portal;
- Supabase em São Paulo;
- migration inicial e RLS;
- Auth por convite e MFA;
- API REST base e envelope padronizado;
- Storage privado;
- tabelas e funções transacionais principais;
- contratos de gateway fiscal e mensageria;
- modelo de turmas com limite 7;
- quatro apresentações previstas para a agenda no front;
- testes de contratos e do pacote Hostinger;
- CI sem publicação e workflow manual da Hostinger.

### Parcial

- o portal visual cobre todos os módulos, mas grande parte dos cartões,
  agenda, matrículas, prontuário, financeiro e relatórios ainda usa dados
  demonstrativos;
- pacientes possuem conexão inicial com a API, mas faltam formulários e fluxos
  completos;
- endpoints principais existem, porém precisam de testes de integração contra
  perfis e dados reais de homologação;
- templates clínicos, PDFs, XLSX, importador e filas precisam de interface
  operacional completa.

### Pendente antes de produção

- aceitar o convite da primeira conta, executar o bootstrap da clínica e
  configurar MFA;
- cadastrar unidades, equipe, salas, serviços e planos reais;
- substituir todo dado demonstrativo por API;
- concluir CRUDs e estados de erro/carregamento/vazio;
- executar testes de permissão por perfil e unidade;
- validar transações, RLS e restauração de backup;
- executar migração piloto;
- configurar secrets públicos no GitHub;
- homologar com administradora, recepção, profissional e financeiro;
- escolher fornecedores de NFS-e e WhatsApp;
- definir plano pago, PITR e política de retenção para produção;
- obter aceite formal antes de publicar.

## Comandos oficiais

```bash
npm install
npm run dev
npm run dev:site
npm run typecheck
npm test
npm run build
npx supabase db push --linked --dry-run
npx supabase functions deploy api
```

Comandos que alteram Supabase remoto, GitHub ou Hostinger exigem confirmação do
ambiente e autorização explícita.

## Critérios mínimos de aceite

A equipe precisa conseguir, sem controles paralelos:

1. convidar e autorizar usuários;
2. cadastrar paciente e responsável;
3. criar plano e matricular em turma semanal;
4. agendar sem conflito e respeitar 7 vagas;
5. registrar presença, atendimento, avaliação e evolução;
6. assinar e retificar prontuário;
7. registrar pagamento e despesa;
8. fechar o mês;
9. conferir relatório mensal e anual;
10. exportar dados e auditar operações.

Não declarar o sistema pronto para produção enquanto qualquer fluxo acima
depender de dados demonstrativos ou operação manual não documentada.
