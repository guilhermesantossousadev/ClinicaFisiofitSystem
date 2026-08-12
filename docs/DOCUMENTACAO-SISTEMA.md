# Documentação do Sistema Fisiofit

**Versão:** 1.1 · **Atualizado em:** 10/08/2026

## 1. Objetivo

O Fisiofit é um portal de gestão clínica para unidades, agenda, pacientes,
matrículas, prontuários, financeiro, relatórios, importações, privacidade e
administração de usuários.

## 2. Arquitetura

- `apps/site`: site público institucional.
- `apps/portal`: aplicação autenticada React/Vite usada pela equipe.
- `supabase/functions/api`: API HTTP com autenticação, validação, regras de negócio e auditoria.
- `supabase/migrations`: banco PostgreSQL, RLS, funções e trilha de auditoria.
- `packages/contracts`: contratos compartilhados entre frontend e API.

O portal usa sessão Supabase, MFA obrigatório para administradores, gestores e
financeiro, separação por clínica/unidade e bloqueio de contas arquivadas.

## 3. Módulos

| Módulo | Finalidade |
|---|---|
| Painel | indicadores e agenda do dia |
| Agenda | atendimentos, salas, profissionais e turmas |
| Pacientes | cadastro, responsáveis, consentimentos e histórico |
| Matrículas | planos, matrículas e cobranças |
| Prontuários | registros clínicos, anexos, assinatura e retificação |
| Financeiro | pagamentos, lançamentos, comissões e fechamentos |
| Relatórios | visão mensal e anual |
| Importações | cargas de planilhas/Notion e rollback |
| Usuários | convites, status, funções, unidades e permissões |
| Configurações | unidades, salas, serviços, profissionais e modelos |
| Privacidade | solicitações, incidentes e auditoria |

## 4. Perfis e permissões

Os perfis são Administrador, Gestor, Recepção, Profissional e Financeiro.
Além do perfil, cada usuário possui permissões individuais por módulo:

- **Visualizar:** permite abrir e consultar o módulo.
- **Editar:** permite executar alterações, quando a operação também estiver autorizada pelo perfil.

O administrador configura isso em **Usuários > Editar > Acesso por módulo**.
O menu é filtrado no frontend e a API repete a validação no backend. A conta
proprietária não pode ser rebaixada, bloqueada ou excluída.

Ao retirar o acesso, o usuário perde o módulo na próxima sessão/requisição;
históricos e registros não são apagados.

## 5. Fluxos críticos

1. **Convite:** administrador informa nome, e-mail, perfil e unidades; o sistema envia link seguro.
2. **Primeiro acesso:** usuário define senha e conclui MFA quando exigido.
3. **Operação:** usuário trabalha apenas nas unidades e módulos liberados.
4. **Auditoria:** alterações relevantes registram usuário, entidade, data e contexto.
5. **Bloqueio:** administrador bloqueia o acesso; os dados históricos permanecem preservados.

## 6. Segurança e privacidade

Não compartilhar senhas, não colocar dados clínicos em observações operacionais,
confirmar paciente/unidade antes de salvar e registrar consentimentos somente
após manifestação do paciente ou responsável. Prontuários assinados devem ser
retificados, nunca sobrescritos.

## 7. Operação e manutenção

Executar `npm run typecheck`, `npm run lint`, `npm test` e `npm run build` antes
de publicar. Alterações de banco devem ser novas migrations, acompanhadas de
teste SQL e validação dos contratos da API. O deploy do frontend e da API deve
ser validado em conjunto.
