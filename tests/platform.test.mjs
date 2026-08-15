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
  assert.match(api, /app\.delete\("\/users\/:id"/);
  assert.match(api, /\/enrollments/);
  assert.match(api, /\/clinical-records\/:id\/rectify/);
  assert.match(api, /\/commissions\/:id\/approve/);
  assert.match(api, /\/imports\/patients/);
  assert.match(api, /PROTECTED_OWNER_ACCOUNT/);
  assert.match(api, /\/privacy\/requests/);
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
  assert.match(authClient, /sistema\/set-password/);
  assert.match(authClient, /flowType:\s*"pkce"/);
  assert.match(api, /redirectTo: `\$\{allowedOrigin\}\/sistema\/set-password`/);
  assert.match(setPassword, /password\.length < 10/);
  assert.match(portalApp, /\.from\("profile-avatars"\)/);
  assert.doesNotMatch(portalApp, /avatar_url: dataUrl/);
  assert.doesNotMatch(`${login}\n${setPassword}`, /password\s*[:=]\s*["'][^"']+["']/i);
  assert.doesNotMatch(siteHtml, /googletagmanager\.com\/gtag\/js/);
  assert.match(cookieConsent, /Aceitar/);
  assert.match(cookieConsent, /Recusar/);
  assert.match(cookieConsent, /Configurar/);
});

test("mantém autenticação da API compatível com JWT assimétrico", async () => {
  const [apiClient, functionConfig, apiSource, mfaPage] = await Promise.all([
    readFile(new URL("../apps/portal/src/infrastructure/http/api.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/config.toml", import.meta.url), "utf8"),
    readFile(new URL("../supabase/functions/api/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../apps/portal/src/presentation/auth/MfaPage.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(apiClient, /apikey:\s*apiKey/);
  assert.match(functionConfig, /\[functions\.api\][\s\S]*verify_jwt\s*=\s*false/);
  assert.match(apiSource, /auth\.getUser\(\)/);
  assert.match(apiSource, /if \(authError \|\| !authData\.user\)/);
  assert.match(functionConfig, /site_url\s*=\s*"https:\/\/clinicafisiofitsabara\.com\/sistema"/);
  assert.match(functionConfig, /\[auth\.mfa\.totp\][\s\S]*enroll_enabled\s*=\s*true[\s\S]*verify_enabled\s*=\s*true/);
  assert.match(mfaPage, /if \(loading\) return/);
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
  const timelineRoute = api.slice(
    api.indexOf('app.get("/patients/:id/timeline"'),
    api.indexOf('app.get("/appointments"'),
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
