# Arquitetura do Fisiofit Platform

## Visão geral

O repositório é um monorepo com dois frontends React independentes:

- `apps/portal`: aplicação autenticada de gestão clínica, publicada em `/sistema/`.
- `apps/site`: site institucional público.
- `packages/contracts`: contratos e schemas compartilhados entre frontend e backend.
- `packages/design-system`: tokens e utilitários visuais compartilhados.
- `supabase`: infraestrutura de dados, migrations e API/serverless functions.

A reorganização segue Clean Architecture de forma pragmática: cada app mantém seu próprio ciclo de build e deploy, e as dependências apontam para dentro. A organização não altera rotas, contratos HTTP, comportamento visual ou regras de negócio existentes.

## Portal

```text
apps/portal/src/
├── domain/
│   └── portal.ts                 # tipos e conceitos centrais do domínio
├── application/
│   └── portal/navigation.ts      # regras puras de navegação e permissões de UI
├── infrastructure/
│   ├── http/api.ts               # cliente HTTP da API Supabase
│   └── supabase/client.ts        # criação/configuração do cliente Supabase
├── presentation/
│   ├── app/FisiofitApp.tsx       # composição da área autenticada
│   ├── auth/                     # login, MFA, onboarding e provider de sessão
│   ├── components/               # primitives de formulário e acessibilidade
│   ├── modules/OperationalModules.tsx
│   └── styles/                   # CSS global e melhorias do portal
└── main.tsx                      # composition root e inicialização React
```

O portal usa `@fisiofit/contracts` como fonte compartilhada dos contratos da API. O backend correspondente fica em `supabase/functions/api`; a camada `infrastructure` é o adaptador que conecta a apresentação a esse backend.

## Site institucional

```text
apps/site/src/
├── domain/                       # reservado para regras/conceitos do site
├── application/                  # reservado para casos de uso e composição
├── presentation/
│   ├── app/App.tsx               # rotas e composição da aplicação
│   ├── pages/                    # páginas roteáveis
│   ├── components/               # layout e componentes reutilizáveis
│   ├── assets/                   # imagens importadas pelo frontend
│   └── styles/index.css
└── main.tsx
```

Como o site atualmente é uma aplicação de conteúdo sem persistência ou casos de uso próprios, `domain` e `application` ficam preparados para futuras regras sem criar abstrações artificiais.

## Regras de dependência

1. `domain` não importa React, Supabase, `fetch` ou componentes de apresentação.
2. `application` contém regras orquestradoras/puras e pode depender de `domain`, mas não de detalhes do navegador ou de fornecedores externos.
3. `infrastructure` implementa integrações externas e pode depender de `domain` e contratos compartilhados.
4. `presentation` renderiza a interface e coordena os casos de uso; não deve criar clientes externos diretamente.
5. `main.tsx` é o composition root: somente ele deve montar providers, router, CSS global e a árvore principal.

## Onde adicionar arquivos novos

- Entidade, tipo ou regra invariável do negócio: `apps/portal/src/domain`.
- Caso de uso, seletor, política ou transformação sem efeitos colaterais: `apps/portal/src/application`.
- API, storage, autenticação, Supabase ou integração com serviço externo: `apps/portal/src/infrastructure`.
- Página, módulo, hook visual, formulário ou componente React: `apps/portal/src/presentation`.
- Nova página pública: `apps/site/src/presentation/pages`.
- Componente compartilhado apenas dentro do site: `apps/site/src/presentation/components`.
- Contrato usado por mais de um app ou pelo backend: `packages/contracts`.
- Token, variável de marca ou utilitário de UI compartilhado: `packages/design-system`.

Ao criar um novo adaptador de infraestrutura, injete-o no ponto de composição ou exponha uma API pequena para a camada de aplicação. Evite importar Supabase diretamente em páginas e módulos novos.

## Validação

Os comandos principais continuam sendo:

```bash
npm run typecheck
npm run build
npm test
```

Eles validam os dois frontends, os pacotes compartilhados e os testes de plataforma.
