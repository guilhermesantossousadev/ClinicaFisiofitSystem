Vamos executar a Fase 6 e 7: Tratar acessibilidade, SEO, imagens e quebrar o código monolítico.

Nossos arquivos de arquitetura estão muito longos e ferem os princípios do Clean Architecture adotados [cite: 2]. O arquivo principal do portal, por exemplo, concentra 11 visões e precisa ser refatorado [cite: 3].
Modularização de OperationalModules.tsx e API (supabase/functions/api/index.ts):
Refatore o monólito de mais de 2.000 linhas dividindo-o em componentes menores dentro do diretório apps/portal/src/presentation/modules/ [cite: 2].
Separe os handlers de Hono na API em arquivos de rotas específicas (ex: pacientes.ts, financeiro.ts, agenda.ts), mantendo os contratos unificados via packages/contracts [cite: 2].
Acessibilidade e Componentes (apps/portal/src/presentation/components/FormPrimitives.tsx):
Adicione aria-describedby adequadamente nos formulários (inputs, selects, textareas).
Remova os falsos estados de carregamento globais (listeners com spinner global) em favor de carregamentos específicos de botões assíncronos.
SEO e Otimização (apps/site/index.html e Vite):
Desabilite a publicação de Source Maps em produção no vite.config.ts do portal.
Injete tags de metadados dinâmicas (canonical, og:url) e substitua imagens gigantes por carregamento com loading="lazy" ou resoluções WebP/AVIF.