# Auditoria da plataforma Fisiofit

## Escopo

Auditoria estática do monorepositório: arquivos, dependências, scripts,
frontend, site, Edge Function, migrations, testes, CI e publicação.

## Resultado atual

| Área | Estado | Evidência |
|---|---|---|
| Site público | Implementado | `apps/site`, build Vite |
| Portal | Implementado com módulos parciais | `apps/portal/src` |
| API | Implementada e modularizada | `supabase/functions/api/index.ts`, `api/routes` |
| Banco | Versionado | `supabase/migrations` |
| Rollback financeiro | Implementado | `reverse_payment` |
| Rollback de importação | Implementado para itens registrados | `rollback_import_batch` |
| Rollback de matrícula | Implementado | `rollback_enrollment` |
| CI | Implementado | `.github/workflows/ci.yml` |
| E2E autenticado | Não verificado | requer sessão de homologação |

## Verificações executadas

- TypeScript do portal e site.
- ESLint das aplicações.
- Testes Vitest do portal.
- Testes de plataforma Node.
- Build completo do pacote Hostinger.
- Verificação HTTP dos endereços públicos.
- Bundle sintático da Edge Function e ausência de source maps no portal.
- Conversão das imagens públicas pesadas para AVIF e metadados SEO por rota.
- Configuração explícita do MIME `image/avif` na Hostinger.

## Pontos de atenção

1. A modularização do portal foi concluída: `OperationalModules.tsx` é uma fachada
   e as visões estão separadas por domínio.
2. A API ainda usa `any` no adaptador de registro das rotas; a migração gradual
   para tipos de domínio reduzirá regressões.
3. Listagens e fluxos clínicos precisam de E2E autenticado com perfis reais.
4. A importação só pode ser revertida para itens que tenham sido registrados em
   `migration_items`; lotes históricos anteriores ao registro não ganham IDs
   retroativos automaticamente.
5. O deploy do frontend e da API são pipelines separados e devem ser validados
   juntos após cada alteração de contrato.

## Critério de limpeza

Nenhum arquivo foi removido apenas por tamanho ou idade. A limpeza segura deve
ser baseada em referência comprovada, cobertura de testes e confirmação de que
o artefato não participa de build, deploy, migration ou documentação.
