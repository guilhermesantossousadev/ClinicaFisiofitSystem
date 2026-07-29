import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("gera site e portal no pacote único da Hostinger", async () => {
  await Promise.all([
    access(new URL("../dist/index.html", import.meta.url)),
    access(new URL("../dist/sistema/index.html", import.meta.url)),
    access(new URL("../dist/sistema/.htaccess", import.meta.url)),
  ]);
  const [site, portal] = await Promise.all([
    readFile(new URL("../dist/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/sistema/index.html", import.meta.url), "utf8"),
  ]);
  assert.match(site, /Clínica Fisiofit/);
  assert.match(portal, /Área da clínica/);
  assert.match(portal, /\/sistema\/assets\//);
});

test("mantém API, banco e integrações versionados", async () => {
  const [migration, api, providers] = await Promise.all([
    readFile(new URL("../supabase/migrations/202607290001_initial_schema.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/functions/api/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/functions/_shared/providers.ts", import.meta.url), "utf8"),
  ]);
  assert.match(migration, /create table public\.group_slots/);
  assert.match(migration, /capacity integer not null default 7/);
  assert.match(migration, /clinical_records_immutable/);
  assert.match(migration, /audit_append_only/);
  assert.match(migration, /register_payment/);
  assert.match(api, /GROUP_CAPACITY_REACHED/);
  assert.match(api, /\/reports\/annual/);
  assert.match(api, /\/users\/:id/);
  assert.match(api, /\/enrollments/);
  assert.match(api, /\/clinical-records\/:id\/rectify/);
  assert.match(api, /\/commissions\/:id\/approve/);
  assert.match(api, /\/imports\/patients/);
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
