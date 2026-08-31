import { describe, expect, it } from "vitest";
import { render, statusLabel } from "./OperationalShared";

describe("microcopy operacional compartilhada", () => {
  it("traduz estados persistidos sem expor códigos internos conhecidos", () => {
    expect(statusLabel("scheduled")).toBe("Agendado");
    expect(statusLabel("rolled_back")).toBe("Revertido");
    expect(render("critical", "severity")).toBe("Crítica");
  });

  it("formata datas do domínio para português brasileiro", () => {
    expect(render("2026-08-30", "due_at")).toMatch(/^30\/08\/2026$/);
    expect(render("2026-08-30T15:30:00Z", "occurred_at")).toContain("30/08/2026");
  });
});
