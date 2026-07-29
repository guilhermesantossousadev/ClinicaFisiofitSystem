import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);

test("renderiza a gestão Fisiofit em português", async () => {
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(new Request("http://localhost/"), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Fisiofit/);
  assert.match(html, /Gestão clínica/);
  assert.match(html, /Agenda/);
  assert.match(html, /Financeiro/);
  assert.doesNotMatch(html, /codex-preview|Building your site/);
});
