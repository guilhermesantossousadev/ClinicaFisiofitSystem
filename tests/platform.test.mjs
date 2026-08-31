import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function readApiSource() {
  const routeNames = ["usuarios", "privacidade", "pacientes", "agenda", "prontuarios", "financeiro", "importacoes"];
  const files = [
    new URL("../supabase/functions/api/index.ts", import.meta.url),
    ...routeNames.map((name) => new URL(`../supabase/functions/api/routes/${name}.ts`, import.meta.url)),
  ];
  return (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
}

test("gera site e portal no pacote único da Hostinger", async () => {
  await Promise.all([
    access(new URL("../dist/index.html", import.meta.url)),
    access(new URL("../dist/sistema/index.html", import.meta.url)),
    access(new URL("../dist/sistema/.htaccess", import.meta.url)),
  ]);
  const [site, portal, siteHeaders, portalHeaders] = await Promise.all([
    readFile(new URL("../dist/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/sistema/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/.htaccess", import.meta.url), "utf8"),
    readFile(new URL("../dist/sistema/.htaccess", import.meta.url), "utf8"),
  ]);
  assert.match(site, /Clínica Fisiofit/);
  assert.match(portal, /Área da clínica/);
  assert.match(portal, /\/sistema\/assets\//);
  assert.match(siteHeaders, /www\\\.clinicafisiofitsabara\\\.com/);
  assert.match(portalHeaders, /www\\\.clinicafisiofitsabara\\\.com/);
  assert.match(portalHeaders, /connect-src[^\n]+eeltguuoxpfttjznugla\.supabase\.co/);
});

test("mantém API, banco e integrações versionados", async () => {
  const [migration, ownerMigration, activityMigration, api, providers] = await Promise.all([
    readFile(new URL("../supabase/migrations/202607290001_initial_schema.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202608020001_owner_and_privacy.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202608020002_patient_activity.sql", import.meta.url), "utf8"),
    readApiSource(),
    readFile(new URL("../supabase/functions/_shared/providers.ts", import.meta.url), "utf8"),
  ]);
  assert.match(migration, /create table public\.group_slots/);
  assert.match(migration, /capacity integer not null default 7/);
  assert.match(migration, /clinical_records_immutable/);
  assert.match(migration, /audit_append_only/);
  assert.match(migration, /register_payment/);
  assert.match(ownerMigration, /owner_profile_id/);
  assert.match(ownerMigration, /PROTECTED_OWNER_ACCOUNT/);
  assert.match(ownerMigration, /create table public\.data_subject_requests/);
  assert.match(ownerMigration, /create table public\.privacy_incidents/);
  assert.match(activityMigration, /alter table public\.patients[\s\S]*add column active/);
  assert.match(api, /GROUP_CAPACITY_REACHED/);
  assert.match(api, /\/reports\/annual/);
  assert.match(api, /\/users\/:id/);
  assert.match(api, /\/users\/:id\/resend-access/);
  assert.match(api, /\/users\/:id\/password/);
  assert.match(api, /auth\.admin\.updateUserById\(id,\s*\{\s*password: input\.password/);
  assert.match(api, /user\.password_changed/);
  assert.doesNotMatch(api, /audit\([^\n]+password:\s*input\.password/);
  assert.match(api, /app\.delete\("\/users\/:id"/);
  assert.match(api, /\/enrollments/);
  assert.match(api, /\/clinical-records\/:id\/rectify/);
  assert.match(api, /\/commissions\/:id\/approve/);
  assert.match(api, /\/imports\/patients/);
  assert.match(api, /PROTECTED_OWNER_ACCOUNT/);
  assert.match(api, /\/privacy\/requests/);
  assert.match(api, /\/attendance\/daily/);
  assert.match(
    api,
    /"data_subject_requests",\s*"privacy_incidents",\s*\]\.includes\(table\)/,
    "recursos de privacidade sem deleted_at não devem receber o filtro de exclusão lógica",
  );
  for (const resource of ["units", "rooms", "professionals", "services", "plans", "group-slots", "record-templates"]) {
    assert.match(api, new RegExp(`app\\.patch\\("/${resource}/:id"`));
  }
  assert.doesNotMatch(
    api,
    /createClient\(url, serviceKey,[\s\S]{0,160}Authorization/,
    "o cliente administrativo não deve herdar o token do usuário",
  );
  assert.match(providers, /interface FiscalProvider/);
  assert.match(providers, /interface MessagingProvider/);
});

test("mantém context.md como fonte única da verdade e não restaura o legado", async () => {
  const context = await readFile(new URL("../context.md", import.meta.url), "utf8");
  assert.match(context, /fonte única da verdade/i);
  assert.match(context, /capacidade padrão e máxima: 7 alunos/i);
  assert.match(context, /eeltguuoxpfttjznugla/);

  await assert.rejects(access(new URL("../app/page.tsx", import.meta.url)));
  await assert.rejects(access(new URL("../worker/index.ts", import.meta.url)));
  await assert.rejects(access(new URL("../drizzle.config.ts", import.meta.url)));
  await assert.rejects(access(new URL("../.openai/hosting.json", import.meta.url)));
});

test("salva avaliações e apresenta os campos clínicos corretos", async () => {
  const [apiIndex, recordsRoute, recordsForm] = await Promise.all([
    readFile(new URL("../supabase/functions/api/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/functions/api/routes/prontuarios.ts", import.meta.url), "utf8"),
    readFile(new URL("../apps/portal/src/presentation/modules/OperationalRecords.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(apiIndex, /registerProntuariosRoutes\(app, \{[^}]*validateRelatedResourceScope/);
  assert.match(recordsRoute, /const \{[^}]*validateRelatedResourceScope[^}]*\} = dependencies/);
  assert.match(recordsForm, /name="functional_diagnosis" label="Diagnóstico funcional"/);
  assert.match(recordsForm, /name="treatment_plan" label="Plano de tratamento"/);
  assert.match(recordsForm, /name="text" label="Evolução"/);
  assert.doesNotMatch(recordsForm, /name="conduct" label="Conduta inicial"/);
});

test("mantém turmas distintas por dias dentro dos horários fixos", async () => {
  const [agenda, enrollments, agendaRoute, migration] = await Promise.all([
    readFile(new URL("../apps/portal/src/presentation/modules/OperationalAgenda.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/portal/src/presentation/modules/OperationalEnrollments.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/functions/api/routes/agenda.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202608230001_group_based_fixed_schedule.sql", import.meta.url), "utf8"),
  ]);

  assert.match(agenda, /Nova turma em horário fixo/);
  assert.match(agenda, /weekdays: form\.getAll\("weekdays"\)\.map\(Number\)/);
  assert.doesNotMatch(agenda, /updateGroupMember/);
  assert.match(enrollments, /label="Turma \(opcional\)"/);
  assert.doesNotMatch(enrollments, /form\.getAll\("weekdays"\)/);
  assert.match(agendaRoute, /GROUP_SLOT_CONFLICT/);
  assert.match(agendaRoute, /conflictingGroup:/);
  assert.match(agendaRoute, /Já existe outra turma nesta unidade para o mesmo dia e horário/);
  assert.match(agendaRoute, /function groupScheduleChanged/);
  assert.match(agendaRoute, /target\.active && groupScheduleChanged\(slot, target\)/);
  assert.match(agendaRoute, /weekdays: slot\.weekdays/);
  assert.doesNotMatch(agendaRoute, /Os horários são fixos e não podem ser cadastrados/);
  assert.match(migration, /sync_membership_weekdays_from_group/);
  assert.match(migration, /name ~\* '\^Horário fixo'/);
});

test("permite à administração, gestão e recepção gerenciar a grade de horários", async () => {
  const [agenda, agendaRoute] = await Promise.all([
    readFile(new URL("../apps/portal/src/presentation/modules/OperationalAgenda.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/functions/api/routes/agenda.ts", import.meta.url), "utf8"),
  ]);

  assert.match(agenda, /canManageGroups && <DrawerForm title="Criar grade de horários"/);
  assert.match(agenda, /api<\{ created: number \}>\("\/group-slots\/bulk"/);
  assert.match(agenda, /15 turmas serão criadas|bulkSlotCount/);
  assert.match(agenda, /Fisioterapeuta responsável \(opcional\)/);
  assert.match(agenda, /professional_id: value\(form, "professional_id"\) \|\| undefined/);
  assert.match(agenda, />Editar<\/button>/);
  assert.match(agenda, />Excluir<\/button>/);
  assert.match(agendaRoute, /app\.post\("\/group-slots\/bulk", requireRoles\(\["admin", "manager", "reception"\]\)/);
  assert.match(agendaRoute, /app\.delete\("\/group-slots\/:id", requireRoles\(\["admin", "manager", "reception"\]\)/);
  assert.match(agendaRoute, /GROUP_SLOT_HAS_MEMBERS/);
  assert.match(agendaRoute, /professional_id: z\.string\(\)\.uuid\(\)\.optional\(\)/);
  assert.match(agendaRoute, /professional_id: input\.professional_id \?\? null/);
  assert.match(agendaRoute, /group_slot\.created_bulk/);
});

test("mantém todos os recursos da agenda coerentes com a unidade selecionada", async () => {
  const [agenda, shared, administration, api, agendaRoute, repairMigration] = await Promise.all([
    readFile(new URL("../apps/portal/src/presentation/modules/OperationalAgenda.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/portal/src/presentation/modules/OperationalShared.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/portal/src/presentation/modules/OperationalAdministration.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/functions/api/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/functions/api/routes/agenda.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202608260001_repair_professional_units.sql", import.meta.url), "utf8"),
  ]);

  assert.match(agenda, /professionalsForUnit\(professionals, newGroupUnitId\)/);
  assert.match(agenda, /unitId=\{newAppointmentUnitId\}/);
  assert.match(agenda, /Salvar alterações da turma/);
  assert.match(agenda, /Cancelar agendamento/);
  assert.match(agenda, /toast-\$\{notice\.type\}/);
  assert.match(agenda, /GroupConflictAlert/);
  assert.match(agenda, /agenda-mobile-list/);
  assert.match(agenda, /canManageGroups/);
  assert.match(shared, /unitId \? `&unitId=/);
  assert.match(administration, /name: "unitIds", label: "Unidades em que atende", type: "checkbox-group"/);
  assert.match(api, /select\("\*,professional_units\(unit_id\)"\)/);
  assert.match(api, /unit_ids:/);
  assert.match(agendaRoute, /PROFESSIONAL_UNIT_NOT_LINKED/);
  assert.match(agendaRoute, /app\.patch\("\/group-slots\/:id"/);
  assert.match(agendaRoute, /weekdays: z\.array\(z\.number\(\)\.int\(\)\.min\(1\)\.max\(5\)\)/);
  assert.match(repairMigration, /insert into public\.professional_units/);
  assert.match(repairMigration, /from public\.group_slots/);
});

test("mantém o fluxo de matrícula da recepção funcional e sem expor o financeiro", async () => {
  const [authorization, api, enrollments, shared, migration] = await Promise.all([
    readFile(new URL("../supabase/functions/api/authorization.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/functions/api/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../apps/portal/src/presentation/modules/OperationalEnrollments.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/portal/src/presentation/modules/OperationalShared.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202608240001_reception_enrollment_flow.sql", import.meta.url), "utf8"),
  ]);
  assert.match(authorization, /reception:\s*\{[^}]*enrollments:\s*"edit"/);
  assert.match(api, /app\.post\("\/enrollments", requireRoles\(\["admin", "manager", "reception", "finance"\]\)/);
  assert.match(enrollments, /\.\.\.\(canViewCharges \? \["\/charges"\] : \[\]\)/);
  assert.match(enrollments, /canReceivePayments && <form/);
  assert.match(shared, /Promise\.allSettled\(paths\.map/);
  assert.match(migration, /profile\.role = 'reception'/);
  assert.match(migration, /create policy charges_insert/);
  const chargesSelectPolicy = migration.slice(
    migration.indexOf("create policy charges_select"),
    migration.indexOf("create policy charges_insert"),
  );
  assert.match(chargesSelectPolicy, /'admin','manager','finance'/);
  assert.doesNotMatch(chargesSelectPolicy, /'reception'/);
});

test("protege recuperação administrativa e consentimento de cookies", async () => {
  const [login, authClient, setPassword, portalApp, api, siteHtml, cookieConsent] = await Promise.all([
    readFile(new URL("../apps/portal/src/presentation/auth/LoginPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/portal/src/infrastructure/supabase/client.ts", import.meta.url), "utf8"),
    readFile(new URL("../apps/portal/src/presentation/auth/SetPasswordPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/portal/src/presentation/app/FisiofitApp.tsx", import.meta.url), "utf8"),
    readApiSource(),
    readFile(new URL("../apps/site/index.html", import.meta.url), "utf8"),
    readFile(new URL("../apps/site/src/presentation/components/CookieConsent.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(login, /resetPasswordForEmail/);
  assert.match(login, /recoveryCooldownSeconds = 60/);
  assert.match(login, /Pedido de redefinição registrado/);
  assert.match(login, /Reenviar em \$\{recoveryWait\}s/);
  assert.match(login, /Spam, Lixeira/);
  assert.match(authClient, /sistema\/set-password/);
  assert.match(authClient, /flowType:\s*"pkce"/);
  assert.match(api, /redirectTo: `\$\{allowedOrigin\}\/sistema\/set-password`/);
  assert.match(setPassword, /password\.length < 10/);
  assert.match(setPassword, /passwordUpdatedNotice/);
  assert.match(setPassword, /navigate\("\/login"/);
  assert.doesNotMatch(setPassword, /api\("\/me"\)/);
  assert.match(portalApp, /\.from\("profile-avatars"\)/);
  assert.doesNotMatch(portalApp, /avatar_url: dataUrl/);
  assert.doesNotMatch(`${login}\n${setPassword}`, /password\s*[:=]\s*["'][^"']+["']/i);
  assert.doesNotMatch(siteHtml, /googletagmanager\.com\/gtag\/js/);
  assert.match(cookieConsent, /Aceitar/);
  assert.match(cookieConsent, /Recusar/);
  assert.match(cookieConsent, /Configurar/);
});

test("mantém autenticação por e-mail e senha sem segundo fator", async () => {
  const [apiClient, functionConfig, apiSource, portalMain] = await Promise.all([
    readFile(new URL("../apps/portal/src/infrastructure/http/api.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/config.toml", import.meta.url), "utf8"),
    readFile(new URL("../supabase/functions/api/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../apps/portal/src/main.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(apiClient, /apikey:\s*apiKey/);
  assert.match(apiSource, /allowHeaders:\s*\[[^\]]*"apikey"/);
  assert.match(functionConfig, /\[functions\.api\][\s\S]*verify_jwt\s*=\s*false/);
  assert.match(apiSource, /auth\.getUser\(\)/);
  assert.match(apiSource, /if \(authError \|\| !authData\.user\)/);
  assert.match(functionConfig, /site_url\s*=\s*"https:\/\/clinicafisiofitsabara\.com\/sistema"/);
  assert.match(functionConfig, /\[auth\.mfa\.totp\][\s\S]*enroll_enabled\s*=\s*false[\s\S]*verify_enabled\s*=\s*false/);
  assert.doesNotMatch(apiSource, /MFA_REQUIRED|aal2|jwtClaim/);
  assert.doesNotMatch(portalMain, /MfaPage|path="\/mfa"/);
  await assert.rejects(access(new URL("../apps/portal/src/presentation/auth/MfaPage.tsx", import.meta.url)));
});

test("isola consultas operacionais por clínica", async () => {
  const api = await readApiSource();
  const patientsRoute = api.slice(
    api.indexOf('app.get("/patients"'),
    api.indexOf('app.post("/patients"'),
  );
  const appointmentsRoute = api.slice(
    api.indexOf('app.get("/appointments"'),
    api.indexOf('app.post("/appointments"'),
  );
  const timelineStart = api.indexOf('app.get("/patients/:id/timeline"');
  const timelineRoute = api.slice(
    timelineStart,
    api.indexOf("\n  });\n}", timelineStart),
  );
  assert.match(patientsRoute, /\.eq\("clinic_id", clinicId\)/);
  assert.match(appointmentsRoute, /\.eq\("clinic_id", context\.get\("profile"\)\.clinic_id\)/);
  assert.equal((timelineRoute.match(/\.eq\("clinic_id", clinicId\)/g) ?? []).length, 3);
});

test("preserva a área atual do portal entre recarregamentos", async () => {
  const portal = await readFile(
    new URL("../apps/portal/src/presentation/app/FisiofitApp.tsx", import.meta.url),
    "utf8",
  );
  assert.match(portal, /localStorage\.getItem\(key\)/);
  assert.match(portal, /localStorage\.setItem\(key, value\)/);
  assert.match(portal, /fisiofit:portal:/);
  assert.match(portal, /visibleNav\.some\(\(item\) => item\.label === view\)/);
});

test("mantém modularização, acessibilidade, SEO e build seguro", async () => {
  const [modules, fields, portalVite, seo, siteHtml] = await Promise.all([
    readFile(new URL("../apps/portal/src/presentation/modules/OperationalModules.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/portal/src/presentation/components/FormPrimitives.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/portal/vite.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../apps/site/src/presentation/components/SeoMetadata.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/site/index.html", import.meta.url), "utf8"),
  ]);
  assert.ok(modules.split("\n").length < 30, "OperationalModules deve permanecer apenas como fachada");
  assert.match(fields, /aria-describedby=\{describedBy\}/);
  assert.match(portalVite, /sourcemap:\s*false/);
  assert.match(seo, /og:url/);
  assert.match(seo, /link\[rel="canonical"\]/);
  assert.match(siteHtml, /https:\/\/clinicafisiofitsabara\.com\/og\.jpg/);
  assert.doesNotMatch(siteHtml, /og\.png/);
});
