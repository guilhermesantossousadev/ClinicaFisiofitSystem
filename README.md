# Plataforma Fisiofit

Monorepositório oficial do site institucional, portal interno, API e banco da
Clínica Fisiofit.

Leia primeiro [context.md](./context.md). Ele é a fonte única da verdade para
arquitetura, infraestrutura, regras de negócio, estado de implementação,
segurança, ambientes e publicação.

## Início rápido

```bash
npm install
npm run dev
```

Portal local: `http://localhost:3000/sistema/`

## Validação

```bash
npm run typecheck
npm test
npm run build
```

O build final fica em `dist/`, com o site na raiz e o portal em
`dist/sistema/`.

Nenhum push ou publicação deve acontecer sem autorização explícita.

## Estrutura

- `apps/site`: site institucional público, servido na raiz.
- `apps/portal`: portal autenticado, servido em `/sistema/`.
- `packages/contracts`: envelopes e contratos compartilhados.
- `packages/design-system`: tokens e configuração visual compartilhada.
- `supabase/functions/api`: Edge Function Hono com a API do portal.
- `supabase/functions/api/routes`: handlers organizados por domínio operacional.
- `supabase/migrations`: schema, RLS, funções SQL e operações transacionais.
- `scripts/assemble-hostinger.mjs`: monta o pacote final da Hostinger.
- `.github/workflows`: validação contínua e publicação manual da Hostinger.

## Ambiente local

Copie `.env.example` para `.env` apenas para desenvolvimento e configure as
variáveis públicas do portal. Nunca versione tokens, service keys ou arquivos
`.env` reais.

```bash
npm install
npm run dev          # portal
npm run dev:site    # site institucional
```

## Verificação completa

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

O lint faz parte do critério de qualidade; falhas devem ser corrigidas antes
de publicar. A validação automatizada cobre contratos, build e invariantes de
plataforma. A validação E2E autenticada ainda depende de uma sessão de
homologação disponível.

## Publicação

O workflow manual `hostinger-build.yml` gera `dist/` e atualiza a branch
`hostinger-deploy`, consumida pela Hostinger. A API é publicada separadamente:

```bash
supabase link --project-ref <PROJECT_REF>
supabase db push --linked
supabase functions deploy api --project-ref <PROJECT_REF>
```

Migrations de rollback e reversão de pagamentos são aplicadas antes da função.

O portal mantém cada visão em `presentation/modules/Operational*.tsx`; o arquivo
`OperationalModules.tsx` é somente o barrel público. O site publica imagens AVIF,
metadados canônicos por rota e o build de produção do portal não gera source maps.
