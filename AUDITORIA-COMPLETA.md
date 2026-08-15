# Auditoria completa da Plataforma Fisiofit

**Data da auditoria:** 15 de agosto de 2026
**Escopo:** site institucional, portal interno, API, Supabase/PostgreSQL, autenticação, privacidade, acessibilidade, SEO, desempenho, testes, CI e publicação.

## Resumo executivo

A auditoria encontrou bloqueadores de segurança e privacidade. O site está online e o build passa, mas o portal não deve ser considerado pronto para tratar dados clínicos em produção antes da correção dos itens críticos descritos neste documento.

Nenhum arquivo da aplicação foi alterado durante a auditoria.

## Resultado das verificações

| Verificação | Resultado |
|---|---|
| TypeScript | Passou |
| ESLint | Passou |
| Testes JavaScript | 11 passaram |
| Build de produção | Passou com alerta de bundle grande |
| `npm audit` | Falhou: 1 vulnerabilidade alta |
| Testes PostgreSQL/RLS | Não executaram: banco Supabase local indisponível |
| Produção | [Site publicado](https://clinicafisiofitsabara.com/) corresponde ao build local |
| Auditoria visual | Navegador embutido indisponível; achados visuais foram baseados em CSS e markup |

## Críticos — bloqueiam produção segura

1. **RLS permite acesso amplo aos dados da clínica.** Qualquer usuário ativo pode consultar diretamente pelo Supabase dados clínicos, financeiros, pacientes, cobranças, auditoria e outros registros de toda a clínica. As políticas RLS verificam apenas `clinic_id`, sem papel ou unidade. Isso permite contornar a API usando a chave pública e o JWT do usuário. Evidência: `supabase/migrations/202607290001_initial_schema.sql:644`.

2. **A API usa `service_role` e ignora RLS.** Qualquer falha de autorização nos handlers vira acesso efetivo ao banco. Evidência: `supabase/functions/api/index.ts:80`.

3. **Rotas sensíveis não exigem papel apropriado.** `/dashboard`, pacientes, responsáveis, consentimentos, timeline clínica/financeira, agenda, cobranças, pagamentos, comissões e notificações possuem leituras sem restrição adequada. Uma recepcionista ou profissional pode obter dados financeiros; um financeiro pode consultar dados clínicos e agenda. Evidências: `supabase/functions/api/index.ts:181`, `:438` e `:835`.

4. **Isolamento por unidade inconsistente.** Listagens retornam a clínica inteira quando `unitId` não é enviado. Várias alterações e exclusões verificam a clínica, mas não se o usuário pode operar a unidade do registro. Isso afeta pacientes, agendamentos, pagamentos, relatórios, fechamentos, anexos e matrículas. Evidência: `supabase/functions/api/index.ts:1735`.

5. **Profissionais podem operar agendamentos que não lhes pertencem.** O endpoint de conclusão não verifica unidade nem vínculo com o profissional logado. Evidência: `supabase/functions/api/index.ts:1133`.

6. **Permissões de módulo usam “default allow”.** Se não existir uma linha em `profile_permissions`, a API permite a ação. Várias rotas personalizadas também não consultam a permissão. Evidência: `supabase/functions/api/index.ts:1797`.

7. **Política RLS de permissões permite inserções indevidas.** `profile_permissions` usa `WITH CHECK (true)`. Em inserções, usuários autenticados podem conseguir criar permissões diretamente pelo Supabase sem serem administradores. Evidência: `supabase/migrations/202608100002_module_permissions.sql:15`.

8. **Funções `SECURITY DEFINER` podem contornar a API.** Algumas funções não validam papel internamente. `register_payment` e `complete_appointment` podem ser chamadas diretamente sem as mesmas restrições da Edge Function. Não há `REVOKE EXECUTE FROM PUBLIC`. Evidência: `supabase/migrations/202607290001_initial_schema.sql:550`.

9. **RPCs são incompatíveis com o contexto de autenticação usado pela API.** A API chama funções usando o cliente `service_role`, mas as funções dependem de `auth.uid()` e `current_clinic_id()`. O usuário original não é propagado nesse cliente; pagamentos, reversões, conclusão e rollbacks podem falhar ou registrar ator nulo. É necessário teste integrado imediato.

10. **Cache não é isolado por usuário ou clínica.** Ao trocar de conta sem recarregar a página, dados clínicos do usuário anterior podem aparecer até o novo carregamento terminar. O cache também não é limpo no logout. Evidência: `apps/portal/src/presentation/modules/OperationalModules.tsx:69`.

## Alta prioridade

11. **Dependência `xlsx` vulnerável.** Foram encontradas vulnerabilidades conhecidas de Prototype Pollution e ReDoS, de severidade alta, sem correção disponível na versão usada. Arquivos maliciosos ou muito grandes podem comprometer ou travar a importação. Evidência: `apps/portal/package.json`.

12. **`xlsx` entra no bundle de todos os módulos.** O pacote vulnerável é importado no topo do módulo operacional, mesmo para usuários que nunca acessam importações. O chunk principal do portal chegou a aproximadamente 536 KB minificado.

13. **Importações contornam regras de negócio.** Pagamentos, prontuários, cobranças e movimentos são inseridos diretamente nas tabelas, sem passar pelas funções transacionais. Um pagamento importado pode não atualizar a cobrança nem gerar lançamento financeiro. Evidência: `supabase/functions/api/index.ts:1541`.

14. **Importação não é atômica.** Algumas entidades podem ser gravadas e outras falharem, deixando o sistema parcialmente migrado. O rollback depende de `migration_items` ter sido criado corretamente.

15. **Importação pode gerar carga excessiva.** Cada linha pode disparar várias consultas sequenciais. O limite máximo permite até 30 abas de 5.000 linhas, criando risco de timeout e negação de serviço.

16. **Relacionamentos não são sempre validados contra o tenant.** Identificadores de unidade, profissional, paciente, sala e serviço nem sempre são validados conjuntamente como pertencentes à mesma clínica e unidade antes da inserção com `service_role`.

17. **Integração Notion usa fontes globais fixas.** IDs de bases e token são globais. Em uma implantação multiclínica, outro administrador poderia importar dados da Fisiofit para sua clínica. Evidência: `supabase/functions/api/index.ts:1573`.

18. **Aprovação de comissão não é transacional.** O status é alterado antes da criação do lançamento financeiro. Se o segundo passo falhar, a comissão fica aprovada sem despesa. Comissão de zero centavos ainda vira despesa de um centavo. Evidência: `supabase/functions/api/index.ts:1335`.

19. **Convites não criam permissões iniciais.** Uma conta ativada pode entrar e encontrar a navegação vazia porque o frontend interpreta a lista vazia como ausência de acesso. Evidências: `supabase/functions/api/index.ts:236` e `apps/portal/src/presentation/app/FisiofitApp.tsx:199`.

20. **Avatar é armazenado dentro do JWT.** A fotografia é salva como Data URL em `user_metadata`, aumentando muito o JWT e podendo ultrapassar limites de cabeçalho, autenticação e Edge Functions. Deve ser armazenada no Storage. Evidência: `apps/portal/src/presentation/app/FisiofitApp.tsx:247`.

21. **Política de privacidade contradiz a implementação.** O texto público afirma que existe segregação por unidade, mas o sistema não garante isso. O documento publicado também informa que ainda está em validação jurídica. Evidência: `apps/site/src/presentation/pages/PrivacyPage.tsx:8`.

22. **Migration administrativa depende de usuário fixo.** Ela contém UUID e nome pessoal e falha em qualquer banco onde aquele usuário Auth não exista, impedindo restauração limpa. Evidência: `supabase/migrations/202607290002_bootstrap_admin.sql:1`.

23. **Não existem testes reais da API e autenticação.** Faltam testes executando handlers, Auth, MFA, isolamento por papel/unidade, Storage e fluxos completos.

24. **Testes SQL são insuficientes e não rodam no CI.** A suíte pgTAP possui apenas verificações de existência e defaults; não testa RLS, permissões, transações ou acessos indevidos. Evidência: `supabase/tests/database.test.sql:1`.

## Segurança e privacidade

25. **Não existe rate limiting na API**, inclusive em buscas, relatórios e importações do Notion.

26. **Mensagens cruas do banco são registradas.** A API coloca mensagens do banco nos logs e a importação pode devolvê-las ao frontend, expondo tabelas, constraints e identificadores. Evidência: `supabase/functions/api/index.ts:1836`.

27. **CORS aceita qualquer `http://localhost:*` em produção.** Isso deve ser limitado ao ambiente local. Evidência: `supabase/functions/api/index.ts:25`.

28. **Cabeçalhos de segurança ausentes no site público.** A produção não envia HSTS, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` ou `X-Content-Type-Options` para o site público. Evidência: `apps/site/public/.htaccess:1`.

29. **CSP ineficaz.** A política publicada contém somente `upgrade-insecure-requests`; não restringe scripts, conexões, frames, estilos ou imagens.

30. **Source maps são publicados.** Os mapas completos do portal estão acessíveis em produção, expondo aproximadamente 3,3 MB de código-fonte mapeado. Evidência: `apps/portal/vite.config.ts:10`.

31. **Google Fonts é carregado antes do consentimento.** Isso transfere IP e metadados ao Google apesar de o banner associar tecnologias Google à autorização publicitária. Evidência: `apps/site/src/presentation/styles/index.css:1`.

32. **Consentimento pode falhar quando o armazenamento é bloqueado.** `localStorage` é acessado sem tratamento de `SecurityError`. O modal também não gerencia foco, Escape ou restauração de foco. Evidência: `apps/site/src/presentation/components/CookieConsent.tsx:38`.

## Acessibilidade e experiência do usuário

33. **Contraste insuficiente nos botões e foco do site.** Branco sobre `#2788c9` tem contraste aproximado de 3,85:1, abaixo de 4,5:1 para texto normal. O foco azul a 35% sobre branco tem aproximadamente 1,54:1, abaixo de 3:1. Evidência: `apps/site/src/presentation/styles/index.css:31`.

34. **Contraste insuficiente no rodapé.** Texto pequeno com branco a 40% sobre azul-marinho tem contraste aproximado de 3,66:1. Evidência: `apps/site/src/presentation/components/Footer.tsx:43`.

35. **Tipografia muito pequena no portal.** O CSS contém textos entre 6 e 11 px, especialmente em tabelas, agenda, metadados e login. Evidência: `apps/portal/src/presentation/styles/index.css:16`.

36. **Modais sem gerenciamento de foco.** Faltam foco inicial, focus trap, fechamento por Escape e retorno de foco na agenda, edição, feedback e lista de turma. Evidência: `apps/portal/src/presentation/modules/OperationalModules.tsx:682`.

37. **Ajuda e erro não são associados aos campos.** Inputs, selects e textareas de `FormPrimitives` não recebem `aria-describedby`; somente checkbox recebe. Evidência: `apps/portal/src/presentation/components/FormPrimitives.tsx:42`.

38. **Todo botão recebe um falso estado de carregamento.** Um listener global coloca spinner e `aria-busy` por 450 ms até em navegação, abas, fechamento de modal e cookies. Evidências: `apps/portal/src/presentation/components/FormAccessibility.tsx:209` e `apps/site/src/presentation/app/App.tsx:13`.

39. **Busca global não implementa corretamente o padrão combobox.** Faltam navegação por setas, `aria-activedescendant`, item selecionado e estado “nenhum resultado”. `aria-controls` pode apontar para elemento inexistente. Evidência: `apps/portal/src/presentation/app/FisiofitApp.tsx:392`.

40. **Busca global é incompleta.** Ela carrega somente os primeiros 100 pacientes e filtra no cliente. Clicar em um resultado apenas abre o módulo de pacientes, sem selecionar o paciente escolhido.

41. **Erros genéricos redirecionam para onboarding.** Após falha de rede ou erro em `/me`, o portal pode redirecionar o usuário como se a clínica ainda precisasse ser criada. Evidência: `apps/portal/src/main.tsx:35`.

42. **Recuperação de MFA apresenta ação que não funciona.** Após código inválido aparece “Gerar um novo QR Code”, mas um fator já verificado é apenas reutilizado. Evidência: `apps/portal/src/presentation/auth/MfaPage.tsx:89`.

43. **HEIC/HEIF é aceito pela interface e rejeitado pela API.** O usuário seleciona um arquivo aparentemente permitido e recebe erro posteriormente. Evidências: `apps/portal/src/presentation/modules/OperationalModules.tsx:1555` e `supabase/functions/api/index.ts:1164`.

44. **Anexos podem ficar órfãos.** O registro é criado antes do upload terminar. Se o upload falhar, fica metadado sem arquivo. Na exclusão, o erro do Storage é ignorado e o registro pode ser ocultado enquanto o arquivo permanece.

45. **Consentimento usa destaque assimétrico.** “Aceitar” recebe maior destaque visual que “Recusar”, prejudicando a equivalência entre escolhas.

46. **Links externos não anunciam nova aba** em seu nome acessível.

47. **Módulos internos não possuem URL própria.** Botões Voltar/Avançar, favoritos e links diretos para uma área do portal não funcionam como esperado.

## SEO e desempenho

48. **Todas as páginas públicas compartilham os mesmos metadados.** Título, description e Open Graph não mudam entre serviços, unidades, contato e páginas jurídicas. Evidência: `apps/site/index.html:8`.

49. **Recursos SEO ausentes.** Não há canonical, `og:url`, dados estruturados `LocalBusiness`, `hreflang` ou `sitemap.xml`.

50. **Rotas inexistentes retornam HTTP 200.** O fallback SPA produz soft 404 para buscadores. Evidência: `apps/site/public/.htaccess:9`.

51. **Imagens excessivamente grandes.** As imagens originais das unidades têm aproximadamente 4 MB e 5 MB no build. Mesmo com redução pelo CDN, continuam pesadas e não usam `loading="lazy"`, `srcset`, WebP ou AVIF. O `og.png` entregue em produção tem aproximadamente 1,76 MB.

52. **Bundle grande no portal.** O portal gera aproximadamente 917 KB de JavaScript minificado antes de gzip, além dos source maps. `OperationalModules` e `xlsx` são carregados juntos.

53. **Cache curto para arquivos versionados.** Assets com hash recebem cache de apenas sete dias; poderiam usar `max-age=31536000, immutable`.

54. **Fonte carregada por `@import`.** Isso bloqueia a cascata de carregamento e atrasa a renderização.

## Arquitetura, testes e operação

55. **Arquivos monolíticos.** `OperationalModules.tsx` possui aproximadamente 2.917 linhas, o CSS de melhorias 2.338 e a API 2.143. Isso amplia risco de regressão e conflitos.

56. **Uso excessivo de `any`.** O problema aparece principalmente nos domínios clínico, financeiro e de importações, reduzindo a proteção oferecida pelo TypeScript.

57. **Contratos compartilhados não são a fonte única.** Eles usam camelCase enquanto a API mantém schemas próprios em snake_case; as regras já divergem. Evidência: `packages/contracts/src/index.ts:21`.

58. **OpenAPI incompleta.** A especificação cobre somente parte das rotas e não declara schemas, autenticação, respostas ou erros. Evidência: `supabase/functions/api/index.ts:2122`.

59. **Código desativado mantido em comentários.** Há grandes blocos de implementação antiga nas rotas de turmas, dificultando manutenção e revisão de segurança.

60. **CI incompleto.** Não executa lint, `npm audit`, testes do banco ou testes de segurança. Evidência: `.github/workflows/ci.yml:21`.

61. **Publicação não valida todo o sistema.** O workflow não executa lint/audit, publica por `git push --force` e não aplica migrations nem publica a Edge Function junto com o frontend. Evidência: `.github/workflows/hostinger-build.yml:30`.

62. **Faltam controles operacionais.** Não há ambiente de homologação configurado, teste E2E autenticado, teste de componentes, teste automatizado WCAG ou plano executável de restauração/PITR.

63. **Health check depende de credencial.** `/health` está atrás do `verify_jwt` do gateway Supabase, reduzindo sua utilidade para monitoramento externo simples.

## Ordem recomendada de correção

1. Fechar RLS, RPCs e autorização por papel e unidade.
2. Eliminar cache entre usuários e validar todos os IDs relacionados.
3. Corrigir pagamentos, conclusão, comissão e importações transacionais.
4. Substituir `xlsx` e criar testes integrados de segurança.
5. Corrigir a política jurídica e suas afirmações.
6. Tratar acessibilidade, SEO, imagens e bundles.
7. Modularizar depois de proteger os fluxos críticos.

## Critério mínimo antes de produção clínica

- Matriz de autorização testada para todos os papéis, unidades e recursos.
- RLS bloqueando acesso direto indevido pelo Supabase REST/RPC.
- Funções transacionais com autorização interna e ator auditável.
- Testes integrados de pagamento, prontuário, agenda, importação e anexos.
- Política de privacidade juridicamente validada e coerente com o sistema.
- Vulnerabilidade de `xlsx` removida ou mitigada com substituição da biblioteca.
- Cache sensível isolado por usuário e limpo no logout.
- Teste E2E autenticado em ambiente de homologação.
