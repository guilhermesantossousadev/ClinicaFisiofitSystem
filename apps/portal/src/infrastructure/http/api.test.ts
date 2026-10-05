import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../supabase/client", () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } },
}));

import { api } from "./api";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("consultas da API", () => {
  it("interrompe consultas penduradas e permite tentar novamente", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new Error("aborted")));
    })));
    const request = api("/appointments");
    const assertion = expect(request).rejects.toMatchObject({ apiError: { code: "REQUEST_TIMEOUT" } });
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [], error: null }), { headers: { "content-type": "application/json" } })));
    await expect(api("/appointments")).resolves.toMatchObject({ data: [] });
  });

  it("mantém o limite de espera até o corpo da resposta terminar", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => ({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new Error("aborted")));
      }),
    })));
    const assertion = expect(api("/payments")).rejects.toMatchObject({ apiError: { code: "REQUEST_TIMEOUT" } });
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
  });

  it("preserva o erro de permissão retornado pelo servidor", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "Sem permissão" } }), { status: 403, headers: { "content-type": "application/json" } })));
    await expect(api("/payments")).rejects.toMatchObject({ status: 403, apiError: { code: "FORBIDDEN" } });
  });
});
