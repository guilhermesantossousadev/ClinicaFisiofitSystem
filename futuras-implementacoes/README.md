# Futuras implementações

Este diretório preserva recursos demonstrativos removidos do site ativo da Fisiofit. Ele é apenas referência técnica: seus nomes, preços, profissionais, endereços, horários e textos são fictícios e não podem voltar à produção sem validação.

## Inventário

- `autenticacao-e-conta/`: login, cadastro e painel do usuário.
- `agendamento/`: seleção, confirmação, reagendamento e cancelamento de sessões.
- `checkout-e-precos/`: checkout, contexto de compra, pacotes, assinaturas e preços.
- `profissionais/`: dados, listagem e perfis de profissionais demonstrativos.
- `supabase/`: cliente, tipos, configuração e migração da integração anterior.
- `paginas-extras/`: FAQ, termos, privacidade, diversidade, história anterior e bem-estar corporativo.
- `paginas-extras/componentes-ui/`: componentes de interface compartilhados pelos módulos arquivados.
- `paginas-extras/assets-legados/` e `public-legado/`: arquivos visuais demonstrativos removidos da aplicação.
- `PLANO-LEGADO.md`: descrição técnica original do fluxo de conta e sessões.

## Dependências anteriores

- React Router, React Hook Form, Zod, date-fns e componentes Radix/shadcn.
- Supabase para autenticação e tabela de agendamentos.
- TanStack React Query.
- Contexto React para checkout e abertura das folhas laterais.

## Rotas anteriores

`/login`, `/register`, `/account`, `/pricing`, `/practitioners`, `/practitioner/:slug`, `/new-members`, `/faq`, `/terms`, `/privacy`, `/diversity` e `/corporate-wellness`.

Essas rotas não existem na aplicação pública atual.

## Banco demonstrativo anterior

Tabela `bookings`:

- `id` UUID, chave primária;
- `user_id` UUID ligado ao usuário autenticado;
- `class_name`, `practitioner` e `location`;
- `date` e `time`;
- `status`;
- `created_at` e `updated_at`.

A política prevista restringia registros ao usuário autenticado. Antes de reutilizar, criar uma modelagem aprovada para a Fisiofit, revisar LGPD, permissões, retenção de dados e fluxos de cancelamento.

## Como reintegrar no futuro

1. Definir requisitos e dados reais no `CONTEXT.md`.
2. Validar LGPD, autenticação, pagamentos e regras operacionais.
3. Recriar os módulos dentro de `src/`; não importar diretamente deste arquivo morto.
4. Substituir integralmente dados demonstrativos.
5. Reinstalar somente as dependências necessárias.
6. Criar migrações e políticas de acesso revisadas.
7. Adicionar rotas, testes de unidade, integração e navegação.
8. Validar em ambiente separado antes de publicar.
