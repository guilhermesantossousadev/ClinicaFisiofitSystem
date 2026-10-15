# Graph Report - fisiofit-ui-ux-v2-20261015  (2026-10-15)

## Corpus Check
- 263 files · ~1,809,728 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2302 nodes · 3214 edges · 160 communities (137 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 30 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8e9adda7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- OperationalAgenda.tsx
- FormPrimitives.tsx
- Design Systems
- Performance & Loading UX
- Additional Important Laws
- Data Tables & Lists
- Accessibility & WCAG 2.2
- Information Architecture
- MonthlyPayments.tsx
- site/package.json
- Forms & Input Design
- AI & LLM UX Patterns
- Ethical Design & Dark Patterns
- Interaction Design
- User Research Methods
- Visual Design
- lucide-react
- Mobile UX Design
- api
- Data Visualization & Dashboard UX
- Search UX
- Notification & Attention Design
- contracts/src/index.ts
- Canvas Apps: Objects, Performance & Patterns
- Quick Reference Checklist
- api/index.ts
- Nielsen's 10 Usability Heuristics
- FisiofitApp.tsx
- fixtures.mjs
- Collaborative UX: Conflict Resolution & Sync
- Emotional Design & Trust
- Collaborative UX: Presence & Awareness
- Release integrado de estabilização — Fisiofit
- compilerOptions
- Internationalization & Localization
- Voice & Multimodal Input
- Auditoria e evolução de UI/UX — Fisiofit
- compilerOptions
- Auditoria completa do Sistema de Controle Fisiofit
- 8. Achados funcionais e técnicos prioritários
- 9. UI, UX, acessibilidade e responsividade
- portal/package.json
- compilerOptions
- AGENDA-002 — Contratos canônicos de Scheduling e Pilates
- homologate-stabilization.mjs
- CONTEXT.md — Plataforma Fisiofit
- package.json
- portal/src/main.tsx
- scripts
- databaseResult
- registerAgendaRoutes
- Onboarding & User Activation
- planControl.ts
- value
- Manual de Usuário — Fisiofit
- homologate-financial-plans-http.mjs
- authorization.ts
- report.mjs
- compilerOptions
- Arquitetura do Fisiofit Platform
- Manual de Usuário — Recepção
- monthlyPaymentControl.ts
- inventory.mjs
- useResources
- Release candidato — Fisiofit UI/UX V2
- devDependencies
- Canvas Apps: Navigation & Interaction
- dialogFocus.ts
- OperationalEnrollments.tsx
- Plataforma Fisiofit
- 15. Regras para novas implementações
- 4. Ambientes, execução, build e deploy
- 10. Qualidade técnica, desempenho e design system
- Documentação do Sistema Fisiofit
- contracts/package.json
- FiscalProvider
- UX Designer Skill
- UX Writing & Microcopy
- Canvas Navigation
- 11. Frontend e experiência do usuário
- 10. Problemas comuns
- Cadastro e edição de pacientes e matrículas — 8 de outubro de 2026
- prepareNotionImport
- Writing for Common UI Elements
- authAccess.ts
- 13. Testes e estado de verificação
- 16. Workflow Git
- 3. Arquitetura atual
- 6. Banco de dados
- 7. Contratos e interfaces
- 9. Autenticação, autorização e privacidade
- ADR-010 — Arquitetura de calendário para Scheduling e Pilates
- 15. Plano de implementação por fases
- 18. Checklist de regressão para futuras correções
- Financeiro e planos — release único
- 6. Pacientes
- Auditoria da plataforma Fisiofit
- patient-saving.test.mjs
- prepare-financial-plans-release.mjs
- Content Design Process
- OperationalShared.tsx
- LoginPage.tsx
- Dark Pattern Taxonomy
- 10. Cache, mensageria e processamento assíncrono
- 8. Regras de negócio vigentes
- 5. Mapa dos principais fluxos por perfil
- 5. Agenda e turmas
- 7. Matrículas, cobranças e pagamentos
- design-system/package.json
- homologate-financial-plans.mjs
- Core Principles
- Form Copy
- SeoMetadata.tsx
- 14. Problemas conhecidos e débitos técnicos
- 2. Visão do produto
- 2. Primeiro acesso e login
- 3. Navegação do portal
- financial-errors.ts
- registerImportacoesRoutes
- Testing Microcopy
- Accessibility in Writing
- Voice and Tone
- AI Tools for UX Writing
- Resources
- occurrenceRoster.test.ts
- Design System Fisiofit V2
- FormAccessibility.tsx
- Fisiofit UI/UX V2 — inventário anterior à implementação
- 1. Finalidade e autoridade
- 2. Metodologia, evidências e limitações
- 3. Arquitetura, tecnologias e módulos
- 4. Mapa completo de páginas, rotas e integrações
- 8. Rotina recomendada da recepção
- Estabilização operacional integrada — registro de continuidade
- FRONTEND_FINDINGS.md
- portal/src/vite-env.d.ts
- site/src/main.tsx
- overrides
- assemble-hostinger.mjs
- operational-errors.ts
- application/README.md
- domain/README.md
- deno.sh
- Voice as a First-Class Input
- Regulatory Landscape
- portalSessionState.ts
- Children & Vulnerable Users
- Matriz de cobertura UI V2
- SURFACE_TREATMENT.md

## God Nodes (most connected - your core abstractions)
1. `api()` - 79 edges
2. `messageOf()` - 61 edges
3. `value()` - 42 edges
4. `OperationalAgenda()` - 39 edges
5. `useResources()` - 30 edges
6. `useDialogFocus()` - 29 edges
7. `confirmAction()` - 27 edges
8. `CONTEXT.md — Plataforma Fisiofit` - 25 edges
9. `TextField()` - 23 edges
10. `brl()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `AgendaDialog()` --calls--> `useDialogFocus()`  [EXTRACTED]
  apps/portal/src/presentation/modules/OperationalAgenda.tsx → packages/design-system/src/dialogFocus.ts
- `FisiofitApp()` --calls--> `useDialogFocus()`  [EXTRACTED]
  apps/portal/src/presentation/app/FisiofitApp.tsx → packages/design-system/src/dialogFocus.ts
- `FormAccessibility()` --calls--> `useDialogFocus()`  [EXTRACTED]
  apps/portal/src/presentation/components/FormAccessibility.tsx → packages/design-system/src/dialogFocus.ts
- `OperationalPatients()` --calls--> `useDialogFocus()`  [EXTRACTED]
  apps/portal/src/presentation/modules/OperationalPatients.tsx → packages/design-system/src/dialogFocus.ts
- `DrawerForm()` --calls--> `useDialogFocus()`  [EXTRACTED]
  apps/portal/src/presentation/modules/OperationalShared.tsx → packages/design-system/src/dialogFocus.ts

## Import Cycles
- None detected.

## Communities (160 total, 12 thin omitted)

### Community 0 - "OperationalAgenda.tsx"
Cohesion: 0.05
Nodes (47): agendaCapabilities(), AgendaResource, agendaResourcePaths(), AgendaRole, patientsAvailableForGroup(), professionalsForUnit(), professionalUnitIds(), resourcesForUnit() (+39 more)

### Community 1 - "FormPrimitives.tsx"
Cohesion: 0.14
Nodes (25): BaseProps, CheckboxField(), DEFAULT_WEEKDAYS, FieldLayoutProps, FormField(), FormSection(), SelectField(), TextareaField() (+17 more)

### Community 2 - "Design Systems"
Cohesion: 0.04
Nodes (45): Anatomy of a Component, Apple Human Interface Guidelines, Atlassian Design System, Building a Design System, Chakra UI, Change Log, Common Pitfalls, Component API Design (+37 more)

### Community 3 - "Performance & Loading UX"
Cohesion: 0.05
Nodes (43): Anti-Patterns, Avoid CLS-Causing Patterns, Basic Skeleton, Blur-Up / LQIP (Low Quality Image Placeholder), Button Loading States, Connection Status, Content Layout Shift Prevention, Core Web Vitals: CLS (+35 more)

### Community 4 - "Additional Important Laws"
Cohesion: 0.05
Nodes (41): Additional Important Laws, Aesthetic-Usability Effect, Application in UX, Application in UX, Application in UX, Application in UX, Application in UX, Application in UX (+33 more)

### Community 5 - "Data Tables & Lists"
Cohesion: 0.05
Nodes (41): Accessibility, Active Filter Display, Anti-Patterns, Basic Table Structure, Best Practices, Bulk Action Bar, Bulk Selection & Actions, Card Reflow Pattern (+33 more)

### Community 6 - "Accessibility & WCAG 2.2"
Cohesion: 0.05
Nodes (41): Accessibility & WCAG 2.2, Accessible Authentication (Enhanced) - 3.3.9 (AAA), Accessible Authentication (Minimum) - 3.3.8 (AA), ARIA (Accessible Rich Internet Applications), Auto-Playing Content, Automated Testing, Color and Contrast, Color Blindness (+33 more)

### Community 7 - "Information Architecture"
Cohesion: 0.05
Nodes (40): 2026 Trends, AI-Powered IA, Bottom Navigation (Mobile), Breadcrumbs, Card Sorting, Clarity Over Cleverness, Common IA Mistakes, Consistency (+32 more)

### Community 8 - "MonthlyPayments.tsx"
Cohesion: 0.15
Nodes (20): DecisionHost(), finish(), coverageLabel(), dateLabel(), monthLabel(), MonthlyPayments(), createCharge(), editCharge() (+12 more)

### Community 9 - "site/package.json"
Cohesion: 0.05
Nodes (39): dependencies, @fisiofit/contracts, @fisiofit/design-system, lucide-react, react, react-dom, tailwindcss-animate, wouter (+31 more)

### Community 10 - "Forms & Input Design"
Cohesion: 0.05
Nodes (39): Accessibility Checklist, Accessibility for Errors, Addresses, Autocomplete Values, Best Practices, Button Labels, Button Placement, Button States (+31 more)

### Community 11 - "AI & LLM UX Patterns"
Cohesion: 0.05
Nodes (40): Accept / Reject / Modify, Adaptive Layouts, Agent UX, AI as a Respectful Copilot, Not an Autopilot, AI Copilot Patterns, AI-Generated Interface Elements, "AI-Generated" Labels, AI & LLM UX Patterns (+32 more)

### Community 12 - "Ethical Design & Dark Patterns"
Cohesion: 0.11
Nodes (17): Banner Design, Button Parity, Consent Best Practices, Consent Design, Cookie / Privacy UX, Drip Pricing Avoidance, Ethical Design Checklist, Ethical Design & Dark Patterns (+9 more)

### Community 13 - "Interaction Design"
Cohesion: 0.05
Nodes (39): 1. Trigger, 2026 Trends, 2. Rules, 3. Feedback, 4. Loops and Modes, Accordion/Collapse, AI-Driven Interactions, Animation Principles (+31 more)

### Community 14 - "User Research Methods"
Cohesion: 0.05
Nodes (38): 1. User Interviews, 2026 Trends, 2. Usability Testing, 3. Surveys, 4. Card Sorting, 5. Tree Testing, 6. Analytics Review, 7. A/B Testing (+30 more)

### Community 15 - "Visual Design"
Cohesion: 0.05
Nodes (37): 2026 Trends, AI-Adaptive Interfaces, Applying Spacing, Color, Color Harmonies, Color Psychology, Color Theory, Colorblind-Safe Design (+29 more)

### Community 16 - "lucide-react"
Cohesion: 0.06
Nodes (19): applyAdvertisingConsent(), applyGoogleFontsConsent(), Consent, CookieConsent(), closeSettings(), handleKeyDown(), save(), isConsent() (+11 more)

### Community 17 - "Mobile UX Design"
Cohesion: 0.05
Nodes (36): Bottom Navigation Bar, Common Mobile Mistakes, Floating Action Button (FAB), Foldable Devices, Form Layout, Hamburger Menu, Handling Device Notches, Haptic Feedback (+28 more)

### Community 18 - "api"
Cohesion: 0.10
Nodes (42): api(), fallbackError(), confirmAction(), InternalNotifications(), mark(), addGroupMember(), cancelAppointment(), completeAppointment() (+34 more)

### Community 19 - "Data Visualization & Dashboard UX"
Cohesion: 0.06
Nodes (33): Accessibility, Anti-Patterns, Chart Accessibility, Chart Decision Tree, Chart Selection, Color in Data Visualization, Colorblind-Safe Palettes, Core Features (+25 more)

### Community 20 - "Search UX"
Cohesion: 0.06
Nodes (33): Active Filter Chips, Advanced Search, AI-Powered Search, AI Search Patterns, Anti-Patterns, Autocomplete, Faceted Search & Filters, Filter Counts (+25 more)

### Community 21 - "Notification & Attention Design"
Cohesion: 0.06
Nodes (32): Anti-Patterns, Attention Management, Badges, Banners (Persistent), Batching & Grouping, By Purpose, By Urgency, Channel Selection Guide (+24 more)

### Community 22 - "contracts/src/index.ts"
Cohesion: 0.11
Nodes (19): ids, ApiEnvelope, ApiError, appointmentInputSchema, clinicalRecordInputSchema, dataSubjectRequestInputSchema, DataSubjectRequestKind, DataSubjectRequestStatus (+11 more)

### Community 23 - "Canvas Apps: Objects, Performance & Patterns"
Cohesion: 0.06
Nodes (31): Accessibility, Alignment Guides, Anti-Patterns, Canvas Apps: Objects, Performance & Patterns, Canvas Elements, Canvas Size Limits, Clustering / Affinity Mapping, Connectors & Arrows (+23 more)

### Community 24 - "Quick Reference Checklist"
Cohesion: 0.06
Nodes (32): Accessibility, AI Interfaces, AI Interfaces, Anti-Patterns to Avoid, Before Designing, Calm & Clarity Over Complexity (2026), Canvas/Spatial Apps, Collaboration (+24 more)

### Community 25 - "api/index.ts"
Cohesion: 0.07
Nodes (19): adminDeletableResources, app, appointmentFields, appointmentSchema, clinicalRecordSchema, DatabaseClient, enrollmentCreateSchema, financialEntrySchema (+11 more)

### Community 26 - "Nielsen's 10 Usability Heuristics"
Cohesion: 0.07
Nodes (29): 10. Help and Documentation, 1. Visibility of System Status, 2. Match Between System and the Real World, 3. User Control and Freedom, 4. Consistency and Standards, 5. Error Prevention, 6. Recognition Rather Than Recall, 7. Flexibility and Efficiency of Use (+21 more)

### Community 27 - "FisiofitApp.tsx"
Cohesion: 0.07
Nodes (42): isView(), nav, NavigationItem, navModule, roleLabel, DashboardData, Patient, PermissionModule (+34 more)

### Community 28 - "fixtures.mjs"
Cohesion: 0.05
Nodes (40): checks, cwd, evidence, temp, axeSource, checks, children, chrome (+32 more)

### Community 29 - "Collaborative UX: Conflict Resolution & Sync"
Cohesion: 0.07
Nodes (27): Anti-Patterns, Change Attribution, Collaborative UX: Conflict Resolution & Sync, Component Locking, Concurrent Editing, Conflict Resolution Approaches, Connection Status Indicators, CRDTs (Conflict-free Replicated Data Types) (+19 more)

### Community 30 - "Emotional Design & Trust"
Cohesion: 0.07
Nodes (26): 1. Visceral Level — "I want it", 2. Behavioral Level — "I can use it", 3. Reflective Level — "I love it", 404 / Error Pages, Animation Character, Anti-Patterns, Blame-Free Language, Brand Personality in UI (+18 more)

### Community 31 - "Collaborative UX: Presence & Awareness"
Cohesion: 0.09
Nodes (22): Activity Feeds, Anonymous Voting, Anti-Patterns, Avatar Stacks, Best Practices, Collaborative UX: Presence & Awareness, Communication Features, Contextual Comments (Annotations) (+14 more)

### Community 32 - "Release integrado de estabilização — Fisiofit"
Cohesion: 0.18
Nodes (9): Integrações adicionais verificadas individualmente, Revalidação dos achados históricos, Banco, API e frontend, Comandos mínimos — executar somente após autorização final, Conferência da clínica em até 15 minutos, Homologação executável e limites, Produção: divergência identificada, sem mutação, Release integrado de estabilização — Fisiofit (+1 more)

### Community 33 - "compilerOptions"
Cohesion: 0.09
Nodes (21): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+13 more)

### Community 34 - "Internationalization & Localization"
Cohesion: 0.10
Nodes (19): Beyond format strings, Common Mistakes, Design for it, Forms that survive every locale, IBM's rule of thumb for expansion, Internationalization & Localization, Language Switching UX, Locale-Aware Formatting (+11 more)

### Community 35 - "Voice & Multimodal Input"
Cohesion: 0.17
Nodes (12): Accessibility Intersection, Combine voice + touch + pointer + keyboard, Common Mistakes, Cross-Device Continuity, Graceful degradation when a modality is unavailable, Modality-appropriate design per context, Multimodal Interaction, Quick Checklist (+4 more)

### Community 36 - "Auditoria e evolução de UI/UX — Fisiofit"
Cohesion: 0.10
Nodes (19): Acessibilidade e responsividade, Arquivos e componentes principais alterados, Auditoria e evolução de UI/UX — Fisiofit, Diagnóstico priorizado, Limitações remanescentes, Matriz de cobertura, Matriz final de cobertura, Onda 1 — Fundação (+11 more)

### Community 37 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+10 more)

### Community 38 - "Auditoria completa do Sistema de Controle Fisiofit"
Cohesion: 0.12
Nodes (16): 11. Aspectos positivos preserváveis, 12. Inconsistências documentais e decisões de produto, 13. Correções rápidas de alto impacto, 14. Melhorias estruturais de médio e longo prazo, 16. Dependências e risco de regressão, 17. Casos não testados e motivo, 19. Tabela consolidada de achados, 1. Resumo executivo (+8 more)

### Community 39 - "8. Achados funcionais e técnicos prioritários"
Cohesion: 0.12
Nodes (17): 8. Achados funcionais e técnicos prioritários, FIS-001 — Total exibido e cobrança de planos divergem, FIS-002 — Cobrança pode ser marcada paga sem recebimento, FIS-003 — Troca de plano não recalcula cobrança existente, FIS-004 — Matrícula e vínculo de turma não são atômicos, FIS-005 — Edição de paciente, plano e turma pode salvar parcialmente, FIS-006 — Detalhe pode exibir dados do paciente anterior durante carregamento, FIS-007 — Importação CSV ignora origem e unidade escolhidas (+9 more)

### Community 40 - "9. UI, UX, acessibilidade e responsividade"
Cohesion: 0.12
Nodes (17): 9. UI, UX, acessibilidade e responsividade, FIS-017 — Tabelas visuais não possuem semântica de tabela/lista, FIS-018 — Indicadores globais de foco têm contraste insuficiente, FIS-019 — PatientPicker tem corrida assíncrona e estado ARIA incoerente, FIS-020 — Módulos internos não têm URL/deep link, FIS-021 — Escolher resultado da busca global ignora o paciente, FIS-022 — Busca global aparece para perfis sem acesso a pacientes, FIS-023 — Ações rápidas do Painel não iniciam a ação prometida (+9 more)

### Community 41 - "portal/package.json"
Cohesion: 0.05
Nodes (39): dependencies, @fisiofit/contracts, @fisiofit/design-system, papaparse, react, react-dom, @supabase/supabase-js, wouter (+31 more)

### Community 42 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+7 more)

### Community 43 - "AGENDA-002 — Contratos canônicos de Scheduling e Pilates"
Cohesion: 0.12
Nodes (15): AGENDA-002 — Contratos canônicos de Scheduling e Pilates, Class e ClassSchedule, ClassOccurrence, Commands, segurança e transição, ConflictPolicy e projection, Fronteiras e leitura consolidada, Matriz de transição e strangler, Membership, roster e attendance (+7 more)

### Community 44 - "homologate-stabilization.mjs"
Cohesion: 0.14
Nodes (6): docker(), migrations, output, psql(), results, runtimeAcceptance()

### Community 45 - "CONTEXT.md — Plataforma Fisiofit"
Cohesion: 0.13
Nodes (15): 12.1 Decisões superadas, 12.2 Decisões ainda pendentes, 12. Decisões arquiteturais vigentes, 17. Referências executáveis, 18. Checklist de atualização do contexto, 19. Histórico de verdades estabelecidas — CoVe, 2026-10-15 — Release único financeiro e planos (candidato isolado), 5.1 Correção de estado anterior (+7 more)

### Community 46 - "package.json"
Cohesion: 0.13
Nodes (15): engines, node, react, react-dom, name, private, type, version (+7 more)

### Community 47 - "portal/src/main.tsx"
Cohesion: 0.19
Nodes (12): classifyAccessFailure(), container, ProtectedApp(), rootWindow, useAuth(), OnboardingPage(), submit(), SetPasswordPage() (+4 more)

### Community 48 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, admin:set-password, build, build:portal, build:site, dev, dev:site, homologate:ui-v2 (+7 more)

### Community 49 - "databaseResult"
Cohesion: 0.26
Nodes (14): audit(), createClinicResource(), databaseResult(), fail(), getAuthorizedAppointment(), hasUnitAccess(), isOwnProfessional(), listResource() (+6 more)

### Community 50 - "registerAgendaRoutes"
Cohesion: 0.19
Nodes (9): CLASS_DAYS, registerAgendaRoutes(), addDays(), classScheduleDatabaseResult(), generateGroupAppointments(), getOccurrenceDetail(), scheduleValidationError(), validateActiveProfessional() (+1 more)

### Community 51 - "Onboarding & User Activation"
Cohesion: 0.06
Nodes (33): Anti-Patterns, Blank Slate Design, Deferred Registration, Defining Activation Metrics, Drop-Off Analysis, Empty States as Onboarding, Feature Revelation Strategies, First-Run Experience (+25 more)

### Community 52 - "planControl.ts"
Cohesion: 0.24
Nodes (11): buildPlanControlRows(), dateKey(), dateOnly(), daysBetween(), inferredRenewalDate(), PaymentState, PlanControlRow, PlanControlSourceRow (+3 more)

### Community 53 - "value"
Cohesion: 0.14
Nodes (23): AgendaExceptions(), save(), MakeupPolicy(), save(), AdministrationSectionProps, AdministrationTab, administrationTabs, FormularioModeloClinico() (+15 more)

### Community 54 - "Manual de Usuário — Fisiofit"
Cohesion: 0.15
Nodes (12): Acesso comum, Administrador, Cadastros e rotinas rápidas, Financeiro, Gestor, Glossário, Manual de Usuário — Fisiofit, Navegação (+4 more)

### Community 55 - "homologate-financial-plans-http.mjs"
Cohesion: 0.15
Nodes (6): candidateSql, events, functions, out, runtimeEnv, userIds

### Community 56 - "authorization.ts"
Cohesion: 0.30
Nodes (8): defaultPermissionsForRole(), moduleForPath(), moduleForRolePath(), PermissionModule, Role, modulesFor(), requireRoles(), registerUsuariosRoutes()

### Community 57 - "report.mjs"
Cohesion: 0.16
Nodes (12): after, before, cards, current, escape(), failed, families, frames (+4 more)

### Community 58 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, allowJs, noImplicitAny, noUnusedLocals, noUnusedParameters, paths, skipLibCheck, strictNullChecks (+2 more)

### Community 59 - "Arquitetura do Fisiofit Platform"
Cohesion: 0.18
Nodes (10): Arquitetura do Fisiofit Platform, Backend Supabase, Estado de implantação verificado, Matriz de isolamento, Onde adicionar arquivos novos, Portal, Regras de dependência, Site institucional (+2 more)

### Community 60 - "Manual de Usuário — Recepção"
Cohesion: 0.18
Nodes (10): 11. Glossário rápido, 1. Visão geral e responsabilidades, 4. Painel, 9. Privacidade e segurança, Atalhos, Checklist de bolso, Manual de Usuário — Recepção, Regra de ouro (+2 more)

### Community 61 - "monthlyPaymentControl.ts"
Cohesion: 0.31
Nodes (8): buildMonthlyPaymentRows(), matchesMonth(), monthBounds(), MonthlyPaymentRow, MonthlyPaymentSourceRow, MonthlyPaymentState, plannedCoverageEnd(), base

### Community 62 - "inventory.mjs"
Cohesion: 0.28
Nodes (8): counts, current, files, kinds, root, surfaces, visit(), walk()

### Community 63 - "useResources"
Cohesion: 0.19
Nodes (16): getPortalSessionGeneration(), Decision, listeners, publish(), request(), requestText(), labels, MakeupBookings() (+8 more)

### Community 64 - "Release candidato — Fisiofit UI/UX V2"
Cohesion: 0.25
Nodes (7): Base e preservação, Entrega, Homologação única, Limites da evidência, Memória e autorização, Publicação proposta, somente após autorização, Release candidato — Fisiofit UI/UX V2

### Community 65 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, @eslint/js, globals, react, react-dom, supabase, @types/node (+2 more)

### Community 66 - "Canvas Apps: Navigation & Interaction"
Cohesion: 0.15
Nodes (12): Anti-Patterns, Canvas Apps: Navigation & Interaction, Drag and Drop, Key Metrics, Keyboard Movement, Object Manipulation, Object Selection, Selection Keyboard Shortcuts (+4 more)

### Community 67 - "dialogFocus.ts"
Cohesion: 0.32
Nodes (7): focusable(), focusin(), inertBefore, keydown(), Layer, layers, updateInert()

### Community 68 - "OperationalEnrollments.tsx"
Cohesion: 0.14
Nodes (17): buildAvailablePaymentPlans(), dateLabel(), EnrollmentHistoryPanel(), enrollmentStatusLabel(), OperationalEnrollments(), enroll(), updateControlledPlan(), PlanControlTable() (+9 more)

### Community 69 - "Plataforma Fisiofit"
Cohesion: 0.22
Nodes (7): Ambiente local, Estrutura, Início rápido, Plataforma Fisiofit, Publicação, Validação, Verificação completa

### Community 70 - "15. Regras para novas implementações"
Cohesion: 0.22
Nodes (9): 15.1 Backend, 15.2 Frontend, 15.3 Banco de dados, 15.4 Segurança, 15.5 Testes, 15.6 Documentação, 15.7 Observabilidade, 15.8 Compatibilidade (+1 more)

### Community 71 - "4. Ambientes, execução, build e deploy"
Cohesion: 0.22
Nodes (9): 4.1 Pré-requisitos, 4.2 Desenvolvimento local, 4.3 Variáveis de ambiente, 4.4 Banco de dados e migrations, 4.5 Testes, 4.6 Integração contínua, 4.7 Deploy, 4.8 Ambientes disponíveis (+1 more)

### Community 72 - "10. Qualidade técnica, desempenho e design system"
Cohesion: 0.22
Nodes (9): 10. Qualidade técnica, desempenho e design system, FIS-033 — Limites de 500 registros são silenciosos, FIS-034 — Mudança de unidade provoca cache incorreto/requisições duplicadas, FIS-035 — CSS do portal é excessivamente sobreposto, FIS-036 — Bundle e divisão por módulo podem melhorar, FIS-037 — Cobertura automatizada não protege os fluxos críticos, FIS-038 — MFA e step-up ausentes para dados sensíveis, FIS-039 — Ações existentes na API estão órfãs (+1 more)

### Community 73 - "Documentação do Sistema Fisiofit"
Cohesion: 0.22
Nodes (8): 1. Objetivo, 2. Arquitetura, 3. Módulos, 4. Perfis e permissões, 5. Fluxos críticos, 6. Segurança e privacidade, 7. Operação e manutenção, Documentação do Sistema Fisiofit

### Community 74 - "contracts/package.json"
Cohesion: 0.22
Nodes (8): dependencies, zod, exports, zod, name, private, type, version

### Community 75 - "FiscalProvider"
Cohesion: 0.22
Nodes (3): FiscalProvider, MessagingProvider, ProviderResult

### Community 76 - "UX Designer Skill"
Cohesion: 0.25
Nodes (7): Coverage Areas, Installation, SKILL.md Highlights, Sources, Structure, UX Designer Skill, What It Does

### Community 77 - "UX Writing & Microcopy"
Cohesion: 0.25
Nodes (7): Cultural Sensitivity, Localization Considerations, Sources, The Impact of Microcopy, UX Writing & Microcopy, What is Microcopy?, Writing for Translation

### Community 78 - "Canvas Navigation"
Cohesion: 0.25
Nodes (8): Canvas Navigation, Coordinate Systems, Minimap / Overview, Pan Methods, Pan/Scroll, Zoom Controls, Zoom Levels, Zoom UI

### Community 79 - "11. Frontend e experiência do usuário"
Cohesion: 0.25
Nodes (8): 11.1 Estrutura das páginas, 11.2 Gerenciamento de estado, 11.3 Componentes compartilhados, 11.4 Design system, 11.5 Responsividade, 11.6 Acessibilidade, 11.7 Restrições de interface, 11. Frontend e experiência do usuário

### Community 80 - "10. Problemas comuns"
Cohesion: 0.25
Nodes (8): 10. Problemas comuns, A opção esperada não aparece, Conflito ao criar agendamento, “E-mail ou senha inválidos”, “Não foi possível enviar o link”, Paciente não aparece na lista, Pagamento duplicado ou incorreto, Tela carregando ou dados ausentes

### Community 81 - "Cadastro e edição de pacientes e matrículas — 8 de outubro de 2026"
Cohesion: 0.25
Nodes (7): Cadastro e edição de pacientes e matrículas — 8 de outubro de 2026, Correção, Problemas confirmados no código, Publicação confirmada, Publicação e limites, Rollback preservado, Validação

### Community 82 - "prepareNotionImport"
Cohesion: 0.43
Nodes (8): normalizeCpf(), notionPlainPage(), notionProp(), notionText(), notionTitle(), notionValue(), prepareNotionImport(), validateNotionInventory()

### Community 83 - "Writing for Common UI Elements"
Cohesion: 0.29
Nodes (7): Buttons, Confirmation Dialogs, Empty States, Error Messages, Loading States, Success Messages, Writing for Common UI Elements

### Community 84 - "authAccess.ts"
Cohesion: 0.16
Nodes (13): AccessFailure, ApiRequestError, AuthRequestError, loginErrorMessage(), membershipCodes, normalizeLoginEmail(), passwordUpdatedNotice, recoveryErrorMessage() (+5 more)

### Community 85 - "13. Testes e estado de verificação"
Cohesion: 0.29
Nodes (7): 13.1 Testes do backend, 13.2 Testes do frontend, 13.3 Testes de integração, 13.4 Testes de banco e migrations, 13.5 Verificações do pipeline, 13.6 Lacunas de cobertura, 13. Testes e estado de verificação

### Community 86 - "16. Workflow Git"
Cohesion: 0.29
Nodes (7): 16.1 Branches, 16.2 Commits, 16.3 Pull requests ou merge requests, 16.4 Validação obrigatória, 16.5 Deploy para produção, 16.6 Limpeza de branches, 16. Workflow Git

### Community 87 - "3. Arquitetura atual"
Cohesion: 0.29
Nodes (7): 3.1 Diagrama textual da arquitetura, 3.2 Tecnologias utilizadas, 3.3 Organização do backend, 3.4 Organização do frontend, 3.5 Serviços externos e integrações, 3.6 Estrutura principal de diretórios, 3. Arquitetura atual

### Community 88 - "6. Banco de dados"
Cohesion: 0.29
Nodes (7): 6.1 Banco e versão, 6.2 Entidades ou tabelas centrais, 6.3 Histórico de migrations, 6.4 Relacionamentos importantes, 6.5 Regras de persistência, 6.6 Dados derivados, 6. Banco de dados

### Community 89 - "7. Contratos e interfaces"
Cohesion: 0.29
Nodes (7): 7.1 Endpoints da API, 7.2 Eventos e filas, 7.3 Webhooks, 7.4 Jobs e tarefas agendadas, 7.5 Padrão de respostas, 7.6 Padrão de erros, 7. Contratos e interfaces

### Community 90 - "9. Autenticação, autorização e privacidade"
Cohesion: 0.29
Nodes (7): 9.1 Autenticação, 9.2 Sessões e tokens, 9.3 Perfis de acesso, 9.4 Permissões, 9.5 Proteções de endpoints, 9.6 Privacidade e dados sensíveis, 9. Autenticação, autorização e privacidade

### Community 91 - "ADR-010 — Arquitetura de calendário para Scheduling e Pilates"
Cohesion: 0.29
Nodes (6): ADR-010 — Arquitetura de calendário para Scheduling e Pilates, Alternativas consideradas, Consequências, Contexto e problema, Decisão, Migração e ownership

### Community 92 - "15. Plano de implementação por fases"
Cohesion: 0.29
Nodes (7): 15. Plano de implementação por fases, Fase 0 — Contenção e decisão (1–3 dias), Fase 1 — Integridade crítica (1–2 semanas), Fase 2 — Segurança e governança (1–2 semanas), Fase 3 — Escala e navegação (2–3 semanas), Fase 4 — Acessibilidade, responsividade e design system (2–3 semanas), Fase 5 — Produto e automação (contínuo)

### Community 93 - "18. Checklist de regressão para futuras correções"
Cohesion: 0.29
Nodes (7): 18. Checklist de regressão para futuras correções, Acessibilidade e responsividade, Autorização, Financeiro e planos, Importação e usuários, Pacientes, agenda e prontuário, Resiliência e desempenho

### Community 94 - "Financeiro e planos — release único"
Cohesion: 0.29
Nodes (6): Comportamento entregue, Diagnóstico somente leitura, Financeiro e planos — release único, Homologação, Preparação e publicação, Recuperação

### Community 95 - "6. Pacientes"
Cohesion: 0.29
Nodes (7): 6.1 Buscar um paciente, 6.2 Cadastrar um novo paciente, 6.3 Editar um cadastro, 6.4 Abrir detalhes do paciente, 6.5 Responsável, 6.6 Consentimentos, 6. Pacientes

### Community 96 - "Auditoria da plataforma Fisiofit"
Cohesion: 0.29
Nodes (6): Auditoria da plataforma Fisiofit, Critério de limpeza, Escopo, Pontos de atenção, Resultado atual, Verificações executadas

### Community 97 - "patient-saving.test.mjs"
Cohesion: 0.33
Nodes (6): typescript, minimum, patientRequest(), register, schema, { z }

### Community 98 - "prepare-financial-plans-release.mjs"
Cohesion: 0.29
Nodes (5): commit, output, sha256, sql, summary

### Community 100 - "Content Design Process"
Cohesion: 0.33
Nodes (6): 1. Research, 2. Strategy, 3. Write, 4. Validate, 5. Maintain, Content Design Process

### Community 101 - "OperationalShared.tsx"
Cohesion: 0.13
Nodes (17): EditField, fieldLabel(), localDateAtNoonIso(), OperationalTable(), pagedResources, PLAN_PERIODS, PlanPeriod, PlanSelect() (+9 more)

### Community 102 - "LoginPage.tsx"
Cohesion: 0.24
Nodes (8): sessionExpiredNoticeKey, isSupabaseConfigured, passwordRecoveryRedirectUrl(), supabase, AuthContext, AuthState, RecoveryRequest, @supabase/supabase-js

### Community 103 - "Dark Pattern Taxonomy"
Cohesion: 0.17
Nodes (12): 10. Privacy Zuckering, 11. Sneak into Basket, 1. Roach Motel, 2. Confirmshaming, 3. Misdirection, 4. Forced Continuity, 5. Hidden Costs, 6. Trick Questions (+4 more)

### Community 104 - "10. Cache, mensageria e processamento assíncrono"
Cohesion: 0.33
Nodes (6): 10.1 Cache, 10.2 Filas, 10.3 Workers, 10.4 Eventos, 10.5 Invalidação e consistência, 10. Cache, mensageria e processamento assíncrono

### Community 105 - "8. Regras de negócio vigentes"
Cohesion: 0.33
Nodes (6): 8.1 Multiunidade e acesso, 8.2 Validações, 8.3 Estados e transições, 8.4 Cálculos, 8.5 Restrições, 8. Regras de negócio vigentes

### Community 106 - "5. Mapa dos principais fluxos por perfil"
Cohesion: 0.33
Nodes (6): 5. Mapa dos principais fluxos por perfil, Administrador, Financeiro, Gestor, Profissional, Recepção

### Community 107 - "5. Agenda e turmas"
Cohesion: 0.33
Nodes (6): 5.1 Consultar a semana, 5.2 Criar um agendamento individual, 5.3 Atualizar o status de um atendimento, 5.4 Criar uma turma com horário fixo, 5.5 Boas práticas da agenda, 5. Agenda e turmas

### Community 108 - "7. Matrículas, cobranças e pagamentos"
Cohesion: 0.33
Nodes (6): 7.1 Criar um plano, 7.2 Criar uma matrícula, 7.3 Registrar um pagamento, 7.4 Reverter uma matrícula, 7.5 Conferência antes de finalizar, 7. Matrículas, cobranças e pagamentos

### Community 109 - "design-system/package.json"
Cohesion: 0.15
Nodes (12): devDependencies, @types/react, exports, ./react, react, @types/react, name, peerDependencies (+4 more)

### Community 110 - "homologate-financial-plans.mjs"
Cohesion: 0.40
Nodes (4): docker(), output, psql(), results

### Community 111 - "Core Principles"
Cohesion: 0.40
Nodes (5): Clarity, Conciseness, Conversational (But Professional), Core Principles, Usefulness

### Community 112 - "Form Copy"
Cohesion: 0.40
Nodes (5): Form Copy, Help Text, Labels, Placeholder Text, Validation Messages

### Community 113 - "SeoMetadata.tsx"
Cohesion: 0.50
Nodes (4): defaults, pages, SeoMetadata(), upsertMeta()

### Community 115 - "14. Problemas conhecidos e débitos técnicos"
Cohesion: 0.40
Nodes (5): 14.1 Riscos de segurança, 14.2 Riscos de arquitetura, 14.3 Riscos operacionais, 14.4 Ordem recomendada de correção, 14. Problemas conhecidos e débitos técnicos

### Community 116 - "2. Visão do produto"
Cohesion: 0.40
Nodes (5): 2.1 Problema resolvido, 2.2 Usuários e perfis, 2.3 Principais aplicações ou interfaces, 2.4 Separação de responsabilidades, 2. Visão do produto

### Community 117 - "2. Primeiro acesso e login"
Cohesion: 0.40
Nodes (5): 2.1 O que você precisa, 2.2 Entrar no sistema, 2.3 Criar ou redefinir a senha, 2.4 Sair com segurança, 2. Primeiro acesso e login

### Community 118 - "3. Navegação do portal"
Cohesion: 0.40
Nodes (5): 3.1 Barra lateral, 3.2 Busca rápida de pacientes, 3.3 Filtro de unidade, 3.4 Formulários, avisos e tabelas, 3. Navegação do portal

### Community 119 - "financial-errors.ts"
Cohesion: 0.50
Nodes (3): financialError(), messages, expected

### Community 121 - "Testing Microcopy"
Cohesion: 0.50
Nodes (4): A/B Testing, Preference Testing, Testing Microcopy, Usability Testing

### Community 122 - "Accessibility in Writing"
Cohesion: 0.50
Nodes (4): Accessibility in Writing, Alt Text, Headings, Link Text

### Community 123 - "Voice and Tone"
Cohesion: 0.50
Nodes (4): Adapting Tone, Developing Brand Voice, Voice and Tone, Voice vs. Tone

### Community 124 - "AI Tools for UX Writing"
Cohesion: 0.50
Nodes (4): AI Tools for UX Writing, Content Generation, Important Note, Quality Checking

### Community 125 - "Resources"
Cohesion: 0.50
Nodes (4): Books, Communities, Courses, Resources

### Community 126 - "occurrenceRoster.test.ts"
Cohesion: 0.31
Nodes (8): membership(), participant(), patient(), EffectiveOccurrenceParticipant, effectiveOccurrenceRoster(), PersistedOccurrenceParticipant, RosterMembership, weekdayForDate()

### Community 127 - "Design System Fisiofit V2"
Cohesion: 0.50
Nodes (3): Contratos de interação, Design System Fisiofit V2, Organização do CSS

### Community 128 - "FormAccessibility.tsx"
Cohesion: 0.40
Nodes (8): configureField(), customMessage(), digits(), FormAccessibility(), FormError, messageFor(), setInlineError(), validateForm()

### Community 130 - "1. Finalidade e autoridade"
Cohesion: 0.50
Nodes (4): 1.1 Objetivo deste documento, 1.2 Ordem das fontes de verdade, 1.3 Como manter este documento, 1. Finalidade e autoridade

### Community 131 - "2. Metodologia, evidências e limitações"
Cohesion: 0.50
Nodes (4): 2. Metodologia, evidências e limitações, Consequência das limitações, Status de validação usado, Verificações executadas

### Community 132 - "3. Arquitetura, tecnologias e módulos"
Cohesion: 0.50
Nodes (4): 3. Arquitetura, tecnologias e módulos, Modelo de dados, Segurança e autorização, Topologia

### Community 133 - "4. Mapa completo de páginas, rotas e integrações"
Cohesion: 0.50
Nodes (4): 4. Mapa completo de páginas, rotas e integrações, Integrações, Portal autenticado, Site público

### Community 134 - "8. Rotina recomendada da recepção"
Cohesion: 0.50
Nodes (4): 8. Rotina recomendada da recepção, Abertura do dia, Durante o dia, Fechamento do dia

### Community 135 - "Estabilização operacional integrada — registro de continuidade"
Cohesion: 0.50
Nodes (3): Concluído e validado, Estabilização operacional integrada — registro de continuidade, Pendente antes da aprovação operacional de produção

### Community 139 - "overrides"
Cohesion: 0.67
Nodes (3): overrides, react, react-dom

### Community 154 - "Voice as a First-Class Input"
Cohesion: 0.25
Nodes (8): A complete voice interaction, end to end, Activation: wake words vs. push-to-talk, Confirmation & error recovery, Discoverability, Feedback: show every state, Privacy is part of voice UX, Recognition feedback in code, Voice as a First-Class Input

### Community 155 - "Regulatory Landscape"
Cohesion: 0.29
Nodes (7): California CPRA, COPPA (US Children's Privacy), EU Digital Fairness Act (Upcoming), EU Digital Services Act (DSA), FTC (United States), GDPR (EU), Regulatory Landscape

### Community 156 - "portalSessionState.ts"
Cohesion: 0.43
Nodes (5): bindPortalSessionToUser(), clearPortalSessionState(), clearPortalStorage(), operationalResourceCache, AuthProvider()

### Community 157 - "Children & Vulnerable Users"
Cohesion: 0.67
Nodes (3): Addictive Pattern Avoidance, Age-Appropriate Design (AADC / ICO Code), Children & Vulnerable Users

## Knowledge Gaps
- **1384 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+1379 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1493 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Accessibility & WCAG 2.2` connect `Accessibility & WCAG 2.2` to `SKILL.md`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `AI & LLM UX Patterns` connect `AI & LLM UX Patterns` to `SKILL.md`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _1384 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `OperationalAgenda.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.053551912568306013 - nodes in this community are weakly interconnected._
- **Should `FormPrimitives.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14174972314507198 - nodes in this community are weakly interconnected._
- **Should `Design Systems` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._
- **Should `Performance & Loading UX` be split into smaller, more focused modules?**
  _Cohesion score 0.045454545454545456 - nodes in this community are weakly interconnected._